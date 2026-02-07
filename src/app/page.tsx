"use client";
import React, { useRef, useState, useEffect } from 'react';
import { analyzeFrame } from './actions';

export default function PhotoCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: 640, height: 480 } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
    startCamera();

    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        // Small 320x240 capture is fast and reliable for AI
        canvas.width = 320; 
        canvas.height = 240;
        context?.drawImage(videoRef.current, 0, 0, 320, 240);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.1);
        const aiAdvice = await analyzeFrame(imageData);
        
        if (aiAdvice) {
          setAdvice(aiAdvice);
          setShowNotification(true);
          // Hide notification automatically after 5 seconds
          setTimeout(() => setShowNotification(false), 5000); 
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* 1. NOTIFICATION POPUP */}
      {showNotification && advice && (
        <div style={{
          position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '380px', background: '#fff', padding: '15px 20px',
          borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', zIndex: 100,
          borderLeft: '5px solid #0070f3'
        }}>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: '#888' }}>APERTURE AI COACH</p>
          <p style={{ margin: '5px 0 0', color: '#000', fontSize: '1rem', lineHeight: '1.4' }}>{advice}</p>
        </div>
      )}

      {/* 2. FIXED CAMERA FRAME */}
      <div style={{ 
        width: '90%', maxWidth: '400px', aspectRatio: '3/4', position: 'relative', 
        borderRadius: '30px', overflow: 'hidden', border: '2px solid #333',
        background: '#111', boxShadow: '0 0 50px rgba(0,0,0,0.5)'
      }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Viewfinder Grid Overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '33.3%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '66.6%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '33.3%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '66.6%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <p style={{ color: '#666', fontSize: '0.8rem', letterSpacing: '2px' }}>LIVE ANALYSIS ACTIVE</p>
      </div>
    </main>
  );
}
