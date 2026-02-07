"use client";
import React, { useRef, useState, useEffect } from 'react';
import { analyzeFrame } from './actions';

export default function PhotoCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

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
        canvas.width = 320; 
        canvas.height = 240;
        context?.drawImage(videoRef.current, 0, 0, 320, 240);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.1);
        const aiAdvice = await analyzeFrame(imageData);
        
        if (aiAdvice && aiAdvice !== advice) {
          setAdvice(aiAdvice);
          setIsNew(true);
          setTimeout(() => setIsNew(false), 5000); // Notification lasts 5s
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [advice]);

  return (
    <main style={{ background: '#111', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      {/* 1. Notification Toast */}
      {advice && (
        <div style={{
          position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '400px', background: '#fff', color: '#000',
          padding: '15px 20px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 100, transition: 'all 0.5s ease', opacity: isNew ? 1 : 0.7,
          borderLeft: '5px solid #0070f3'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#666' }}>AI COACH ADVICE</p>
          <p style={{ margin: '5px 0 0', fontSize: '1rem', lineHeight: '1.4' }}>{advice}</p>
        </div>
      )}

      {/* 2. Fixed Camera Viewfinder */}
      <div style={{ 
        width: '100%', maxWidth: '500px', aspectRatio: '3/4', position: 'relative', 
        borderRadius: '24px', overflow: 'hidden', border: '2px solid #333', background: '#000' 
      }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Viewfinder Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '33.33%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '66.66%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '33.33%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '66.66%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      <p style={{ marginTop: '20px', color: '#888', fontSize: '0.8rem' }}>APERTURE AI v1.0 • LIVE MODE</p>
    </main>
  );
}
