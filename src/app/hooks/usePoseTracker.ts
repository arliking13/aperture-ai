import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

// --- CONFIGURATION ---
const MOVEMENT_THRESHOLD = 0.005; 
const FRAMES_TO_LOCK = 60; // ~2 Seconds

const calculateMovement = (current: any[], previous: any[] | null): number => {
  if (!previous) return 999;
  const keyPoints = [0, 11, 12, 23, 24]; 
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
  const [stability, setStability] = useState(0); 

  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  
  // LOGIC FIX: A ref is faster than state for stopping loops
  const shouldTrackRef = useRef(false);

  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU"
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

  const detectPose = useCallback(() => {
    // 1. GATEKEEPER: Stop if we turned it off
    if (!shouldTrackRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!landmarker || !video || !canvas || video.readyState < 2) {
      requestRef.current = requestAnimationFrame(detectPose);
      return;
    }

    const results = landmarker.detectForVideo(video, performance.now());
    const ctx = canvas.getContext('2d');
    
    // 2. GATEKEEPER: Check AGAIN before drawing
    if (ctx && shouldTrackRef.current) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const movement = calculateMovement(landmarks, previousLandmarks.current);
        
        if (movement < MOVEMENT_THRESHOLD) {
            stillFrames.current = Math.min(FRAMES_TO_LOCK, stillFrames.current + 1);
        } else {
            stillFrames.current = Math.max(0, stillFrames.current - 5);
            if (countdownTimer.current) {
              clearInterval(countdownTimer.current);
              countdownTimer.current = null;
              setCountdown(null);
            }
        }

        const percent = Math.round((stillFrames.current / FRAMES_TO_LOCK) * 100);
        setStability(percent);

        if (stillFrames.current >= FRAMES_TO_LOCK && !countdownTimer.current) {
           startCountdown();
        }

        const color = percent > 50 ? '#00ff88' : 'rgba(255, 255, 255, 0.4)';
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawLandmarks(landmarks, { radius: 3, color: color, fillColor: color });
        drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: color, lineWidth: 2 });

        previousLandmarks.current = landmarks;
      }
    }
    
    if (shouldTrackRef.current) {
      requestRef.current = requestAnimationFrame(detectPose);
    }
  }, [landmarker, timerDuration, onCaptureTrigger]);

  const startCountdown = () => {
    let count = timerDuration;
    setCountdown(count);
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

  const startTracking = useCallback(() => {
    if (!shouldTrackRef.current) {
        shouldTrackRef.current = true;
        detectPose();
    }
  }, [detectPose]);

  const stopTracking = useCallback(() => {
    shouldTrackRef.current = false;
    
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }

    setStability(0);
    setCountdown(null);
    stillFrames.current = 0;

    // Force Wipe
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  useEffect(() => { return () => stopTracking(); }, [stopTracking]);

  // Return exactly what the components expect
  return { 
    isAiReady, 
    startTracking, 
    stopTracking, 
    countdown, 
    stability, 
    isStill: stability > 20 
  };
}