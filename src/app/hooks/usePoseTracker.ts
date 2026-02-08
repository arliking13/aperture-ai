// src/app/hooks/usePoseTracker.ts
import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { calculateMovement } from '../utils/cameraHelpers'; // Make sure this path is correct

// Helper type to make Refs easier to work with
type RefObj<T> = React.RefObject<T | null>;

export function usePoseTracker(
  videoRef: RefObj<HTMLVideoElement>,
  canvasRef: RefObj<HTMLCanvasElement>,
  onCaptureTrigger: () => void,
  timerDuration: number,
  isAutoEnabled: boolean
) {
  const [isAiReady, setIsAiReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const captureRef = useRef(onCaptureTrigger);

  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

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
        landmarkerRef.current = marker;
        setIsAiReady(true);
      } catch (err) { console.error(err); }
    }
    loadAI();
  }, []);

  const detectPose = () => {
    if (landmarkerRef.current && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;

        if (isAutoEnabled) {
          if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

            if (!countdownTimer.current) {
               if (calculateMovement(landmarks, previousLandmarks.current) < 0.008) {
                 stillFrames.current++;
                 setIsStill(true);
                 if (stillFrames.current > 30) startCountdown();
               } else { 
                 stillFrames.current = 0; 
                 setIsStill(false); 
               }
               previousLandmarks.current = landmarks;
            }
          } else { 
            setIsStill(false); 
            stillFrames.current = 0; 
          }
        }
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
        if (captureRef.current) captureRef.current();
      } else { setCountdown(count); }
    }, 1000);
  };

  const startTracking = () => { if (!requestRef.current) detectPose(); };
  const stopTracking = () => { 
    if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; } 
  };

  useEffect(() => { return () => stopTracking(); }, []);

  return { isAiReady, startTracking, stopTracking, countdown, isStill };
}