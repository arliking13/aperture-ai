// src/app/hooks/usePoseTracker.ts
import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { calculateMovement } from '../utils/cameraHelpers';

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCaptureTrigger: () => void,
  timerDuration: number,
  shouldCapture: boolean // <--- NEW: Only capture when this is TRUE
) {
  const [isAiReady, setIsAiReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);

  // Internal Refs
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  
  // FIX: Track the capture state in a ref so the loop sees changes instantly
  const shouldCaptureRef = useRef(shouldCapture);
  const captureRef = useRef(onCaptureTrigger);

  useEffect(() => { shouldCaptureRef.current = shouldCapture; }, [shouldCapture]);
  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  // Stop everything if capture is cancelled
  useEffect(() => {
    if (!shouldCapture) {
        if (countdownTimer.current) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
        }
        setCountdown(null);
        setIsStill(false);
        stillFrames.current = 0;
    }
  }, [shouldCapture]);

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

  const detectPose = () => {
    if (landmarkerRef.current && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      const ctx = canvasRef.current.getContext('2d');
      
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 1. ALWAYS DRAW SKELETON (Visual Feedback)
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

            // 2. ONLY CAPTURE IF REQUESTED
            if (shouldCaptureRef.current && !countdownTimer.current) {
                if (calculateMovement(landmarks, previousLandmarks.current) < 0.008) {
                    stillFrames.current++;
                    setIsStill(true);
                    // 30 frames = ~1 second of holding still
                    if (stillFrames.current > 30) startCountdown();
                } else { 
                    stillFrames.current = 0; 
                    setIsStill(false); 
                }
            }
            previousLandmarks.current = landmarks;
        } else { 
            // Reset if no person found
            setIsStill(false); 
            stillFrames.current = 0; 
        }
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  };

  const startCountdown = () => {
    // Safety check
    if (!shouldCaptureRef.current) return;

    // Instant Snap (0s Timer)
    if (timerDuration === 0) {
        if (captureRef.current) captureRef.current();
        stillFrames.current = 0;
        return;
    }

    // Standard Countdown
    let count = timerDuration;
    setCountdown(count);
    
    countdownTimer.current = setInterval(() => {
      // Abort if user cancelled capture mid-countdown
      if (!shouldCaptureRef.current) {
          clearInterval(countdownTimer.current!);
          countdownTimer.current = null;
          setCountdown(null);
          return;
      }

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