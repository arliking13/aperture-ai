import { useState, useEffect, useRef } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { calculateMovement } from '../utils/motionLogic';

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCaptureTrigger: () => void, // The callback to take a photo
  timerDuration: number
) {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);

  // Internal Refs
  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Capture Ref: Stores the LATEST capture function to prevent bugs
  const captureRef = useRef(onCaptureTrigger);
  
  // Update the ref whenever the parent passes a new function
  useEffect(() => {
    captureRef.current = onCaptureTrigger;
  }, [onCaptureTrigger]);

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
            delegate: "GPU" // Using GPU as it worked best for you
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        setLandmarker(marker);
        setIsAiLoading(false);
      } catch (err) {
        console.error("AI Load Error:", err);
      }
    }
    loadAI();
  }, []);

  // 2. Detection Loop
  const detectPose = () => {
    if (!landmarker || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2) {
      const results = landmarker.detectForVideo(video, performance.now());
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Visualize Skeleton
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawLandmarks(landmarks, { radius: 3, color: '#00ff88', fillColor: '#000' });
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

          // Motion Logic
          const movement = calculateMovement(landmarks, previousLandmarks.current);
          
          // Threshold 0.008 (Calibrated)
          if (movement < 0.008) {
             handleStillness();
          } else {
             handleMovement();
          }
          previousLandmarks.current = landmarks;
        }
      }
    }
    requestRef.current = requestAnimationFrame(detectPose);
  };

  // 3. Logic Helpers
  const handleStillness = () => {
    stillFrames.current++;
    if (!isStill) setIsStill(true);

    // Trigger at 30 frames (~1 sec)
    if (stillFrames.current === 30 && !countdownTimer.current) {
      startCountdown();
    }
  };

  const handleMovement = () => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    stillFrames.current = 0;
    setCountdown(null);
    setIsStill(false);
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
        
        // CALL THE CAPTURE FUNCTION (Using the Ref for safety)
        if (captureRef.current) captureRef.current();
        
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  // 4. Controls
  const startTracking = () => {
    if (!requestRef.current) detectPose();
  };

  const stopTracking = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTracking();
  }, []);

  return { isAiLoading, startTracking, stopTracking, countdown, isStill };
}