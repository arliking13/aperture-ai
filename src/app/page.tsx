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

  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setStatus("Error");
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        // INCREASED RESOLUTION FOR BETTER AI SIGHT
        canvas.width = 640;
        canvas.height = 480;
        context?.drawImage(videoRef.current, 0, 0, 640, 480);
        const imageData = canvas.toDataURL('image/jpeg', 0.3);
        
        const aiAdvice = await analyzeFrame(imageData);
        
        if (aiAdvice === "NONE" || !aiAdvice) {
          setStatus("Waiting for Human...");
          setShowToast(false);
        } else {
          setAdvice(aiAdvice);
          setShowToast(true);
          setStatus("Human Detected!");
          setTimeout(() => setShowToast(false), 5000);
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [startCamera]);

  return (
    <main style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* STATUS DOT */}
      <div style={{ position: 'absolute', top: 15, right: 15, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === "Human Detected!" ? '#0f0' : '#444' }} />
        <span style={{ color: '#fff', fontSize: '0.7rem', opacity: 0.6 }}>{status}</span>
      </div>

      {/* NOTIFICATION TOAST */}
      {showToast && advice && (
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '380px', background: '#fff', padding: '20px',
          borderRadius: '24px', boxShadow: '0 15px 40px rgba(0,0,0,0.8)', zIndex: 100,
          borderLeft: '8px solid #0070f3'
        }}>
          <p style={{ margin: 0, fontSize: '1rem', color: '#000' }}>{advice}</p>
        </div>
      )}

      {/* VIEWFINDER */}
      <div style={{ width: '85%', maxWidth: '360px', aspectRatio: '3/4', position: 'relative', borderRadius: '40px', overflow: 'hidden', border: '2px solid #222' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === "user" ? 'scaleX(-1)' : 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        <button onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")} style={{
          position: 'absolute', bottom: 20, right: 20, width: '50px', height: '50px',
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
          display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)', zIndex: 10
        }}>
          <span style={{ fontSize: '24px' }}>🔄</span>
        </button>

        <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
           <div style={{ position: 'absolute', top: '33%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
           <div style={{ position: 'absolute', top: '66%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
           <div style={{ position: 'absolute', left: '33%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
           <div style={{ position: 'absolute', left: '66%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      <p style={{ marginTop: '30px', color: '#444', fontSize: '0.7rem', letterSpacing: '2px' }}>APERTURE AI POSE COACH</p>
    </main>
  );
}
