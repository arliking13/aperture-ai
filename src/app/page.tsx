"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { analyzeFrame } from './actions';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // 1. Logic to start/switch cameras while cleaning up old tracks
  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus(facingMode === "user" ? "Front Camera" : "Back Camera");
      }
    } catch (err) {
      setStatus("Camera Error: " + (err as Error).message);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        setStatus("Analyzing Frame...");
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        canvas.width = 320;
        canvas.height = 240;
        context?.drawImage(videoRef.current, 0, 0, 320, 240);
        const imageData = canvas.toDataURL('image/jpeg', 0.1);
        
        try {
          const aiAdvice = await analyzeFrame(imageData);
          if (aiAdvice) {
            setAdvice(aiAdvice);
            setShowToast(true);
            setStatus("Success!");
            setTimeout(() => setShowToast(false), 5000);
          }
        } catch (e) {
          setStatus("AI Loop Error.");
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [startCamera]);

  return (
    <main style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* STATUS BAR (Kept exactly as you liked) */}
      <div style={{ position: 'absolute', top: 15, right: 15, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.includes("Error") ? 'red' : '#0f0' }} />
        <span style={{ color: '#fff', fontSize: '0.7rem', opacity: 0.6 }}>{status}</span>
      </div>

      {/* NOTIFICATION TOAST (Kept exactly as you liked) */}
      {showToast && advice && (
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '380px', background: '#fff', padding: '20px',
          borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.8)', zIndex: 100,
          borderLeft: '8px solid #0070f3', transition: 'all 0.5s'
        }}>
          <p style={{ margin: 0, fontSize: '1rem', color: '#000', lineHeight: '1.4' }}>{advice}</p>
        </div>
      )}

      {/* FIXED VIEWFINDER (With Flip Button added) */}
      <div style={{ width: '85%', maxWidth: '360px', aspectRatio: '3/4', position: 'relative', borderRadius: '40px', overflow: 'hidden', border: '2px solid #222' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ 
            width: '100%', height: '100%', objectFit: 'cover',
            transform: facingMode === "user" ? 'scaleX(-1)' : 'none' // Mirror the front camera
          }} 
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* FLIP CAMERA BUTTON */}
        <button 
          onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")}
          style={{
            position: 'absolute', bottom: 20, right: 20, width: '50px', height: '50px',
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
            display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)',
            cursor: 'pointer', zIndex: 10
          }}
        >
          <span style={{ fontSize: '24px' }}>🔄</span>
        </button>

        {/* Viewfinder Grid */}
        <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '33%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ position: 'absolute', top: '66%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ position: 'absolute', left: '33%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ position: 'absolute', left: '66%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      <p style={{ marginTop: '30px', color: '#444', fontSize: '0.7rem', letterSpacing: '2px' }}>APERTURE AI LIVE MODE</p>
    </main>
  );
}
