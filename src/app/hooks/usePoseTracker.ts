// src/app/hooks/usePoseTracker.ts
import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { calculateMovement } from '../utils/cameraHelpers';

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
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

  // Update capture callback ref
  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  // 1. Load AI
  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task", delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        landmarkerRef.current = marker;
        setIsAiReady(true);
      } catch (err) { console.error(err); }
    }
    loadAI();
  }, []);

  // 2. Detection Loop
  const detectPose = () => {
    if (!landmarkerRef.current || !videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      requestRef.current = requestAnimationFrame(detectPose);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // FIX: If Auto is disabled, just clear canvas and skip logic
        if (!isAutoEnabled) {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             setIsStill(false);
             stillFrames.current = 0;
             requestRef.current = requestAnimationFrame(detectPose);
             return; 
        }

        const results = landmarkerRef.current.detectForVideo(video, performance.now());
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  const stopTracking = () => { if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; } };

  useEffect(() => { return () => stopTracking(); }, []);

  return { isAiReady, startTracking, stopTracking, countdown, isStill };
}