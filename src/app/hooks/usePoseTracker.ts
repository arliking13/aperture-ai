import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

// Helper for motion math
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
            delegate: "GPU" // Switch to "CPU" if iPhone crashes
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
        
        // Draw Red Skeleton
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawLandmarks(landmarks, { radius: 3, color: 'red', fillColor: 'white' });
        drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: 'red', lineWidth: 2 });

        // Motion Logic
        const movement = calculateMovement(landmarks, previousLandmarks.current);
        
        if (movement < 0.008) {
            stillFrames.current++;
            if (!isStill) setIsStill(true);
            
            if (stillFrames.current === 30 && !countdownTimer.current) {
              startCountdown();
            }
        } else {
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