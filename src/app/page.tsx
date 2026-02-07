"use client";
import React, { useRef, useState, useEffect } from 'react';
import { analyzeFrame } from './actions';

export default function PhotoCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [advice, setAdvice] = useState("Waiting for camera...");

  useEffect(() => {
    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
    startCamera();

    // The "Live" Loop: Runs every 3 seconds
    const interval = setInterval(async () => {
  if (videoRef.current && canvasRef.current) {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // FORCE a smaller size (AI doesn't need 4K to see a figure)
    canvas.width = 320; 
    canvas.height = 240;
    
    context?.drawImage(videoRef.current, 0, 0, 320, 240);
    
    // Use 0.1 for high compression
    const imageData = canvas.toDataURL('image/jpeg', 0.1); 
    
    const aiAdvice = await analyzeFrame(imageData);
    setAdvice(aiAdvice);
  }
}, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Live AI Advice Bubble */}
        <div style={{ position: 'absolute', bottom: 40, width: '100%', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.9)', color: '#000', padding: '15px', borderRadius: '20px', display: 'inline-block', maxWidth: '80%' }}>
            {advice}
          </div>
        </div>
      </div>
    </main>
  );
}
