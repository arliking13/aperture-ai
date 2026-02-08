"use client";
import { useState, useRef, useEffect } from 'react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { DrawingUtils, PoseLandmarker } from '@mediapipe/tasks-vision';

export default function DebugCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const { landmarker, isLoading } = usePoseDetection();
  
  // LOGGING STATE
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 5)); // Keep last 5 logs
    console.log(msg);
  };

  // 1. Start Camera
  useEffect(() => {
    async function startCam() {
      try {
        addLog("Requesting Camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        addLog("Camera Access GRANTED");
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            addLog(`Video Ready: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
            videoRef.current?.play();
          };
        }
      } catch (e: any) {
        addLog(`CAMERA ERROR: ${e.message}`);
      }
    }
    startCam();
  }, []);

  // 2. The Loop
  const animate = () => {
    if (videoRef.current && canvasRef.current && landmarker) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Blue Box (Canvas Check)
        ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
        ctx.fillRect(10, 10, 50, 50);

        // Detect
        const startTime = performance.now();
        const results = landmarker.detectForVideo(video, startTime);
        
        // Draw Skeleton
        if (results.landmarks && results.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx);
          for (const landmark of results.landmarks) {
            drawingUtils.drawLandmarks(landmark, { radius: 4, color: 'red' });
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: 'red', lineWidth: 4 });
          }
        }
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (landmarker) {
      addLog("AI Model LOADED Success!");
      requestRef.current = requestAnimationFrame(animate);
    } else {
      addLog("Waiting for AI Model...");
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [landmarker]);

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000' }}>
      {/* 1. Video Layer */}
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      
      {/* 2. Canvas Layer */}
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* 3. DEBUG LOG OVERLAY (Visible on Phone) */}
      <div style={{
        position: 'absolute', top: 100, left: 10, right: 10,
        background: 'rgba(0,0,0,0.8)', padding: '10px',
        color: '#00ff00', fontFamily: 'monospace', fontSize: '12px',
        pointerEvents: 'none', borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>STATUS LOG:</h3>
        {logs.map((log, i) => (
          <div key={i} style={{ borderBottom: '1px solid #333', padding: '2px 0' }}>
            {i === 0 ? '> ' : ''}{log}
          </div>
        ))}
        <div style={{ marginTop: '10px', color: 'yellow' }}>
           Blue Box Visible? {canvasRef.current ? "YES" : "NO"} <br/>
           AI Loading? {isLoading ? "YES" : "NO"}
        </div>
      </div>
    </div>
  );
}