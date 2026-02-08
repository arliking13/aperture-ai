import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { calculateMovement } from '../utils/motionLogic'; // Ensure utils/motionLogic.ts also exists!

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCaptureTrigger: () => void,
  timerDuration: number
) {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);

  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const captureRef = useRef(onCaptureTrigger);

  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        setLandmarker(marker);
        setIsAiLoading(false);
      } catch (err) { console.error(err); }
    }
    loadAI();
  }, []);

  const detectPose = () => {
    if (landmarker && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const results = landmarker.detectForVideo(videoRef.current, performance.now());
      const ctx = canvasRef.current.getContext('2d');
      
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (results.landmarks?.[0]) {
          const landmarks = results.landmarks[0];
          new DrawingUtils(ctx).drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });
          
          const movement = calculateMovement(landmarks, previousLandmarks.current);
          if (movement < 0.008) {
            stillFrames.current++;
            if (!isStill) setIsStill(true);
            if (stillFrames.current === 30 && !countdownTimer.current) {
               let count = timerDuration;
               setCountdown(count);
               countdownTimer.current = setInterval(() => {
                 count--;
                 if (count <= 0) {
                   clearInterval(countdownTimer.current!);
                   countdownTimer.current = null;
                   setCountdown(null);
                   stillFrames.current = 0;
                   if (captureRef.current) captureRef.current();
                 } else {
                   setCountdown(count);
                 }
               }, 1000);
            }
          } else {
             if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
             stillFrames.current = 0;
             setCountdown(null);
             setIsStill(false);
          }
          previousLandmarks.current = landmarks;
        }
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  };

  const startTracking = () => { if (!requestRef.current) detectPose(); };
  const stopTracking = () => { if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; } };

  useEffect(() => { return () => stopTracking(); }, []);

  return { isAiLoading, startTracking, stopTracking, countdown, isStill };
}