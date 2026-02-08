"use client";
import { useState, useRef, useEffect } from 'react';
import { usePoseTracker } from '../hooks/usePoseTracker';

export default function DebugCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 5));

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
            addLog(`Active: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
          };
        }
      } catch (e: any) { addLog(`ERROR: ${e.message}`); }
    }
    startCam();
  }, []);

  // FIX: Added "true" as the 6th argument (isSessionActive)
  const { isAiReady, startTracking, isStill, countdown } = usePoseTracker(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    () => addLog("📸 SNAP!"), 
    3, 
    true, // isAutoEnabled
    true  // isSessionActive (Always active for debug mode)
  );

  useEffect(() => {
    if (cameraActive) {
      addLog("Starting Tracker...");
      startTracking();
    }
  }, [cameraActive]);

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000', color: 'lime', fontFamily: 'monospace' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', top: 50, left: 10, right: 10, background: 'rgba(0,0,0,0.8)', padding: '15px', pointerEvents: 'none' }}>
        <div>AI: {isAiReady ? "✅ READY" : "⏳ LOADING..."}</div>
        <div>Move: {isStill ? "✋ HOLD" : "🏃 MOVING"}</div>
        <div>Count: {countdown ?? "--"}</div>
        <div style={{ marginTop: 15, fontSize: 12, color: '#ccc' }}>
          {logs.map((log, i) => <div key={i}>{'>'} {log}</div>)}
        </div>
      </div>
    </div>
  );
}