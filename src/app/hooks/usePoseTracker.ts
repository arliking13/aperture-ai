import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { calculateMovement } from '../utils/cameraHelpers';

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCaptureTrigger: () => void,
  timerDuration: number,
  isAutoEnabled: boolean,    // If true: Load AI and draw green lines
  isSessionActive: boolean   // If true: Actually count down and take photos
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
  
  // Refs for loop access
  const isAutoRef = useRef(isAutoEnabled);
  const isSessionRef = useRef(isSessionActive);
  const captureRef = useRef(onCaptureTrigger);

  useEffect(() => { isAutoRef.current = isAutoEnabled; }, [isAutoEnabled]);
  useEffect(() => { isSessionRef.current = isSessionActive; }, [isSessionActive]);
  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  // Cleanup when turning off Auto
  useEffect(() => {
    if (!isAutoEnabled) {
        if (countdownTimer.current) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
        }
        setCountdown(null);
        setIsStill(false);
        stillFrames.current = 0;
        
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }, [isAutoEnabled]);

  // Reset session state when stopping/starting session
  useEffect(() => {
    if (!isSessionActive) {
        if (countdownTimer.current) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
        }
        setCountdown(null);
        stillFrames.current = 0;
        setIsStill(false);
    }
  }, [isSessionActive]);

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
    // 1. If Auto is OFF, do nothing
    if (!isAutoRef.current) {
         requestRef.current = requestAnimationFrame(detectPose);
         return;
    }

    if (landmarkerRef.current && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      const ctx = canvasRef.current.getContext('2d');
      
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 2. ALWAYS DRAW LINES (Visual Feedback)
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

            // 3. ONLY PROCESS CAPTURE IF SESSION IS ACTIVE
            if (isSessionRef.current && !countdownTimer.current) {
                if (calculateMovement(landmarks, previousLandmarks.current) < 0.008) {
                    stillFrames.current++;
                    setIsStill(true);
                    // Wait for ~1.5 seconds of stillness before triggering countdown
                    if (stillFrames.current > 45) startCountdown();
                } else { 
                    stillFrames.current = 0; 
                    setIsStill(false); 
                }
            }
            previousLandmarks.current = landmarks;
        } else { 
            setIsStill(false); 
            stillFrames.current = 0; 
        }
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  };

  const startCountdown = () => {
    if (!isSessionRef.current) return;

    // Instant Snap logic (if timer is 0)
    if (timerDuration === 0) {
        if (captureRef.current) captureRef.current();
        stillFrames.current = 0; 
        return;
    }

    let count = timerDuration;
    setCountdown(count);
    
    countdownTimer.current = setInterval(() => {
      // Emergency Abort
      if (!isSessionRef.current || !isAutoRef.current) {
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
        
        // CAPTURE!
        if (captureRef.current) captureRef.current();
        
        // RESET FOR NEXT POSE (Continuous Loop)
        stillFrames.current = 0; 
        setIsStill(false);
      } else { setCountdown(count); }
    }, 1000);
  };

  const startTracking = () => { if (!requestRef.current) detectPose(); };
  const stopTracking = () => { if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; } };
  useEffect(() => { return () => stopTracking(); }, []);

  return { isAiReady, startTracking, stopTracking, countdown, isStill };
}