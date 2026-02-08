"use client";
import { useState, useRef, useEffect } from 'react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision';

export default function DebugCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const { landmarker, isLoading } = usePoseDetection();
  const [cameraActive, setCameraActive] = useState(false);

  // 1. Start Camera
  useEffect(() => {
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 } // Keep resolution low for debugging
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
          };
        }
      } catch (e) {
        console.error("Camera failed:", e);
      }
    }
    startCam();
  }, []);

  // 2. The Debug Loop
  const animate = () => {
    if (videoRef.current && canvasRef.current && landmarker) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx && video.readyState >= 2) {
        // A. Match Dimensions Forcefully
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // B. Detect Pose
        const results = landmarker.detectForVideo(video, performance.now());

        // C. Clear Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // D. DEBUG: Draw a Blue Box in corner to prove canvas is working
        ctx.fillStyle = "blue";
        ctx.fillRect(10, 10, 50, 50);

        // E. Draw Skeleton if found
        if (results.landmarks && results.landmarks.length > 0) {
          console.log("Skeleton Detected!"); // Check console for this
          const drawingUtils = new DrawingUtils(ctx);
          for (const landmark of results.landmarks) {
            drawingUtils.drawLandmarks(landmark, { radius: 5, color: 'red' });
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: 'red', lineWidth: 4 });
          }
        }
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (cameraActive && landmarker) {
      console.log("Starting Debug Loop...");
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cameraActive, landmarker]);

  return (
    <div style={{ padding: 20, background: '#333', color: 'white' }}>
      <h1>DEBUG MODE</h1>
      <p>AI Status: {isLoading ? "Loading..." : "READY"}</p>
      
      <div style={{ position: 'relative', width: 640, height: 480, border: '2px solid red' }}>
        {/* Video Layer */}
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        
        {/* Canvas Layer */}
        <canvas 
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}
        />
      </div>
    </div>
  );
}