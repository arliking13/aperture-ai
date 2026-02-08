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

  // Internal Refs
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  
  // FIX 1: Create a Ref for the Auto Switch so the loop always sees the REAL value
  const isAutoRef = useRef(isAutoEnabled);
  const captureRef = useRef(onCaptureTrigger);

  // Keep Refs updated
  useEffect(() => { isAutoRef.current = isAutoEnabled; }, [isAutoEnabled]);
  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  // FIX 2: Emergency Stop Listener
  useEffect(() => {
    if (!isAutoEnabled) {
        // Kill any active countdown immediately
        if (countdownTimer.current) {
            clearInterval(countdownTimer.current);
            countdownTimer.current = null;
        }
        setCountdown(null);
        setIsStill(false);
        stillFrames.current = 0;
        
        // Clear the red/green lines from screen
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }, [isAutoEnabled]);

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
    // FIX 3: Check the REF, not the variable. This forces it to respect the switch instantly.
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
            const drawingUtils = new DrawingUtils(ctx);
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

            if (!countdownTimer.current) {
                if (calculateMovement(landmarks, previousLandmarks.current) < 0.008) {
                    stillFrames.current++;
                    setIsStill(true);
                    // 30 frames = ~1 second of holding still
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
    requestRef.current = requestAnimationFrame(detectPose);
  };

  const startCountdown = () => {
    // FIX 4: Double check Auto is still ON before starting
    if (!isAutoRef.current) return;

    if (timerDuration === 0) {
        if (captureRef.current) captureRef.current();
        stillFrames.current = 0;
        return;
    }

    let count = timerDuration;
    setCountdown(count);
    
    countdownTimer.current = setInterval(() => {
      // FIX 5: If user switched to manual DURING countdown, abort!
      if (!isAutoRef.current) {
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