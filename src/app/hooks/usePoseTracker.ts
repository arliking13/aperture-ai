import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import { calculateMovement } from '../utils/cameraHelpers';
import { generateSmartAdvice, analyzeBrightness } from '../utils/smartAdvice';

export function usePoseTracker(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCaptureTrigger: () => void,
  timerDuration: number,
  isAutoEnabled: boolean,
  isSessionActive: boolean
) {
  const [isAiReady, setIsAiReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);

  // Refs
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const objectModelRef = useRef<cocossd.ObjectDetection | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  
  const isAutoRef = useRef(isAutoEnabled);
  const isSessionRef = useRef(isSessionActive);
  const captureRef = useRef(onCaptureTrigger);

  useEffect(() => { isAutoRef.current = isAutoEnabled; }, [isAutoEnabled]);
  useEffect(() => { isSessionRef.current = isSessionActive; }, [isSessionActive]);
  useEffect(() => { captureRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  // CLEANUP: Ensure canvas is wiped when Auto is disabled
  useEffect(() => {
    if (!isAutoEnabled) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        setCountdown(null);
        setIsStill(false);
        
        // Force clear canvas immediately
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }, [isAutoEnabled]);

  // Load Models
  useEffect(() => {
    async function loadModels() {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task", delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1
        });
        landmarkerRef.current = marker;

        await tf.ready();
        const model = await cocossd.load();
        objectModelRef.current = model;

        setIsAiReady(true);
      } catch (err) { console.error("AI Load Error:", err); }
    }
    loadModels();
  }, []);

  // ON-DEMAND ADVICE (Called after capture)
  const getInstantAdvice = useCallback(async () => {
      if (!videoRef.current || !canvasRef.current || !objectModelRef.current || !landmarkerRef.current) return null;
      
      const video = videoRef.current;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return null;

      const predictions = await objectModelRef.current.detect(video);
      const poseResult = landmarkerRef.current.detectForVideo(video, performance.now());
      const landmarks = poseResult.landmarks ? poseResult.landmarks[0] : [];
      const brightness = analyzeBrightness(ctx, canvasRef.current.width, canvasRef.current.height);

      return generateSmartAdvice(landmarks, predictions, brightness);
  }, []);

  // POSE LOOP
  const detectPose = async () => {
    // 1. Manual Mode Check: Clear and Exit
    if (!isAutoRef.current) {
         if (canvasRef.current) {
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
         }
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

            if (isSessionRef.current && !countdownTimer.current) {
                if (calculateMovement(landmarks, previousLandmarks.current) < 0.008) {
                    stillFrames.current++;
                    setIsStill(true);
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
    if (timerDuration === 0) {
        if (captureRef.current) captureRef.current();
        stillFrames.current = 0; 
        return;
    }
    let count = timerDuration;
    setCountdown(count);
    countdownTimer.current = setInterval(() => {
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
        if (captureRef.current) captureRef.current();
        stillFrames.current = 0; 
        setIsStill(false);
      } else { setCountdown(count); }
    }, 1000);
  };

  const startTracking = () => { if (!requestRef.current) detectPose(); };
  const stopTracking = () => { if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; } };
  useEffect(() => { return () => stopTracking(); }, []);

  return { isAiReady, startTracking, stopTracking, countdown, isStill, getInstantAdvice };
}