"use client";
import React, { useRef, useState, useEffect } from 'react';

export default function PhotoCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
    startCamera();
  }, []);

  const handleCapture = () => {
    // Start Analysis (No alert box = no freezing!)
    setIsAnalyzing(true);
    
    // Simulate AI thinking for 3 seconds
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 3000);
  };

  return (
    <main style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* 1. The Camera Viewfinder */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        
        {/* 2. "Analyzing" Overlay (Visible only when button is pressed) */}
        {isAnalyzing && (
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', 
            alignItems: 'center', color: '#fff', fontSize: '1.5rem', fontWeight: 'bold', zIndex: 10 
          }}>
            AI ANALYZING...
          </div>
        )}

        <div style={{ position: 'absolute', top: 20, width: '100%', textAlign: 'center', color: '#fff' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Aperture AI Coach</h1>
        </div>
      </div>
      
      {/* 3. The Shutter Button */}
      <div style={{ height: '150px', background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button 
          onClick={handleCapture}
          disabled={isAnalyzing}
          style={{ 
            width: '70px', height: '70px', borderRadius: '50%', 
            border: '5px solid #fff', background: isAnalyzing ? '#555' : 'transparent',
            transition: 'background 0.3s'
          }}
        />
      </div>
    </main>
  );
}
