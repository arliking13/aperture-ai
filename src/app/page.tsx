"use client";
import React, { useRef, useState, useEffect } from 'react';

export default function PhotoCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <main style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        <div style={{ position: 'absolute', top: 20, width: '100%', textAlign: 'center', color: '#fff' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Aperture AI Coach</h1>
        </div>
      </div>
      
      <div style={{ height: '150px', background: '#111', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button 
          onClick={() => alert("Capturing for AI analysis...")}
          style={{ width: '70px', height: '70px', borderRadius: '50%', border: '5px solid #fff', background: 'transparent' }}
        />
      </div>
    </main>
  );
}
