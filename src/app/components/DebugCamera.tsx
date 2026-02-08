"use client";
import { useState, useRef, useEffect } from 'react';
import { usePoseTracker } from '../hooks/usePoseTracker';

export default function DebugCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 5));
    console.log(msg);
  };

  useEffect(() => {
    async function startCam() {
      try {
        addLog("Requesting Camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            addLog(`Video Ready: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
            videoRef.current?.play();
            setCameraActive(true);
          };
        }
      } catch (e: any) {
        addLog(`CAMERA ERROR: ${e.message}`);
      }
    }
    startCam();
  }, []);

  const { isAiReady, startTracking, stopTracking, isStill, countdown, stability } = usePoseTracker(
    videoRef,
    canvasRef,
    () => addLog("📸 SNAPSHOT TRIGGERED!"), 
    3
  );

  useEffect(() => {
    if (cameraActive && isAiReady) {
      addLog("Starting AI Loop...");
      startTracking();
    }
    return () => stopTracking();
  }, [cameraActive, isAiReady]);

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000' }}>
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{
        position: 'absolute', top: 50, left: 10, right: 10,
        background: 'rgba(0,0,0,0.8)', padding: '15px',
        color: '#00ff00', fontFamily: 'monospace', fontSize: '12px',
        pointerEvents: 'none', borderRadius: '8px', border: '1px solid #333'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: 'white', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
          DEBUG MODE
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <div>AI Ready: <b style={{color: isAiReady ? '#0f0' : '#f00'}}>{isAiReady ? "YES" : "NO"}</b></div>
          <div>Stable ({stability}%): <b style={{color: isStill ? '#0f0' : '#888'}}>{isStill ? "YES" : "NO"}</b></div>
          <div>Countdown: <b style={{color: countdown !== null ? '#ff0' : '#888'}}>{countdown !== null ? countdown : "-"}</b></div>
        </div>
        <div style={{ color: '#aaa', marginBottom: '5px' }}>Latest Logs:</div>
        {logs.map((log, i) => (
          <div key={i} style={{ borderBottom: '1px solid #222', padding: '2px 0' }}>{log}</div>
        ))}
      </div>
    </div>
  );
}