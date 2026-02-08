"use client";
import { useState, useRef, useEffect } from 'react';
import { usePoseTracker } from '../hooks/usePoseTracker'; 

export default function DebugCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Simple logger
  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 5));

  // 1. Start Camera
  useEffect(() => {
    async function startCam() {
      try {
        addLog("Requesting Camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 }
        });
        addLog("Camera Access GRANTED");
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
            addLog(`Video Active: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
          };
        }
      } catch (e: any) {
        addLog(`CAMERA ERROR: ${e.message}`);
      }
    }
    startCam();
  }, []);

  // 2. Use the Modular AI Hook
  // FIX: We cast the refs with "as React.RefObject<...>" to solve the Line 41 red error
  const { isAiLoading, startTracking, isStill, countdown } = usePoseTracker(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    () => addLog("📸 SNAPSHOT TRIGGERED!"), 
    3 
  );

  // 3. Start AI when camera is ready
  useEffect(() => {
    if (cameraActive) {
      addLog("Starting AI Tracker...");
      startTracking();
    }
  }, [cameraActive]);

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000', color: 'lime', fontFamily: 'monospace' }}>
      {/* Video Layer - Added playsInline for iPhone support */}
      <video 
        ref={videoRef} 
        autoPlay muted playsInline
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      
      {/* Canvas Layer (Red Skeleton) */}
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* DEBUG OVERLAY */}
      <div style={{ 
        position: 'absolute', top: 50, left: 10, right: 10, 
        background: 'rgba(0,0,0,0.8)', padding: '15px', borderRadius: '8px', pointerEvents: 'none' 
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333' }}>DEBUGGER</h3>
        
        <div>AI Loaded: {isAiLoading ? "⏳ LOADING..." : "✅ READY"}</div>
        <div>Tracking: {isStill ? "✋ HOLD STILL" : "🏃 MOVING"}</div>
        <div>Countdown: {countdown !== null ? `⏰ ${countdown}` : "--"}</div>
        
        <div style={{ marginTop: '15px', fontSize: '12px', color: '#ccc' }}>
          {/* FIX: Corrected the ">>" typo here */}
          {logs.map((log, i) => (
             <div key={i}>{'>'} {log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}