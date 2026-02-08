import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

// --- CONFIGURATION ---
const MOVEMENT_THRESHOLD = 0.005; // Lower = You must be more still (Stricter)
const FRAMES_TO_LOCK = 60;        // Higher = AI waits longer before triggering (~2 seconds)

// Helper for motion math
const calculateMovement = (current: any[], previous: any[] | null): number => {
  if (!previous) return 999;
  const keyPoints = [0, 11, 12, 23, 24]; // Nose, Shoulders, Hips
  let total = 0;
  keyPoints.forEach(i => {
    if (current[i] && previous[i]) {
      const dx = current[i].x - previous[i].x;
      const dy = current[i].y - previous[i].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
  });
  return total / keyPoints.length;
};

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onCaptureTrigger: () => void,
  timerDuration: number
) {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isAiReady, setIsAiReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);

  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Load AI
  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU" // Change to "CPU" if iPhone crashes
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        setLandmarker(marker);
        setIsAiReady(true);
      } catch (err) {
        console.error("AI Load Error:", err);
      }
    }
    loadAI();
  }, []);

  // 2. Detection Loop
  const detectPose = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!landmarker || !video || !canvas || video.readyState < 2) {
      requestRef.current = requestAnimationFrame(detectPose);
      return;
    }

    const results = landmarker.detectForVideo(video, performance.now());
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Draw Skeleton (Green when locked, Red when moving)
        const isLocked = stillFrames.current > (FRAMES_TO_LOCK / 2); // Visual feedback halfway through
        const color = isLocked ? '#00ff88' : 'rgba(255, 255, 255, 0.5)';
        
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawLandmarks(landmarks, { radius: 3, color: color, fillColor: color });
        drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: color, lineWidth: 2 });

        // Motion Logic
        const movement = calculateMovement(landmarks, previousLandmarks.current);
        
        if (movement < MOVEMENT_THRESHOLD) {
            stillFrames.current++;
            
            // Only show "Hold Still" text if they have been still for a moment (15 frames)
            if (stillFrames.current > 15 && !isStill) setIsStill(true);
            
            // TRIGGER: Must hold for FRAMES_TO_LOCK (e.g. 60 frames / 2 seconds)
            if (stillFrames.current === FRAMES_TO_LOCK && !countdownTimer.current) {
              startCountdown();
            }
        } else {
            // MOVED: Cancel everything immediately
            if (countdownTimer.current) {
              clearInterval(countdownTimer.current);
              countdownTimer.current = null;
            }
            stillFrames.current = 0;
            setCountdown(null);
            setIsStill(false);
        }
        previousLandmarks.current = landmarks;
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  };

  const startCountdown = () => {
    let count = timerDuration;
    setCountdown(count);
    
    // Safety clear
    if (countdownTimer.current) clearInterval(countdownTimer.current);

    countdownTimer.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownTimer.current!);
        countdownTimer.current = null;
        setCountdown(null);
        stillFrames.current = 0; 
        onCaptureTrigger();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const startTracking = () => {
    if (!requestRef.current) detectPose();
  };

  const stopTracking = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  };

  useEffect(() => { return () => stopTracking(); }, []);

  return { isAiReady, startTracking, stopTracking, countdown, isStill };
}