"use client";
import { useState, useRef } from 'react';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraStarted, setCameraStarted] = useState(false);
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  
  // New States
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true); // Default true for selfies

  const startCamera = async (modeOverride?: 'user' | 'environment') => {
    // Determine which camera to use (override or current state)
    const targetMode = modeOverride || facingMode;

    // Stop any existing streams first
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: targetMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraStarted(true);
        };
      }
    } catch (err) {
      alert('Camera error: ' + err);
    }
  };

  const switchCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    // Auto-turn off mirror for back camera, on for front camera
    setIsMirrored(newMode === 'user');
    
    // Restart camera with new mode
    startCamera(newMode);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    let targetW, targetH;
    
    // Crop Logic
    if (format === 'square') {
      const size = Math.min(vidW, vidH);
      targetW = size;
      targetH = size;
    } else if (format === 'vertical') {
      targetH = vidH;
      targetW = targetH * (9/16);
      if (targetW > vidW) { 
         targetW = vidW;
         targetH = targetW * (16/9);
      }
    } else { 
      targetH = vidH;
      targetW = targetH * (4/3);
      if (targetW > vidW) {
        targetW = vidW;
        targetH = targetW * (3/4);
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;

    const startX = (vidW - targetW) / 2;
    const startY = (vidH - targetH) / 2;

    // Draw Logic with Mirror Support
    ctx.save();
    if (isMirrored) {
      // Flip canvas horizontally
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, startX, startY, targetW, targetH, 0, 0, targetW, targetH);
    ctx.restore();
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(base64Image);
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* 1. Controls Row (Format + Mirror) */}
      {cameraStarted && (
        <div style={{ 
          display: 'flex', 
          width: '100%', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '15px' 
        }}>
          {/* Format Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['vertical', 'album', 'square'].map((fmt) => (
              <button 
                key={fmt}
                onClick={() => setFormat(fmt as any)}
                style={{
                  background: format === fmt ? '#fff' : '#222',
                  color: format === fmt ? '#000' : '#fff',
                  border: '1px solid #444', padding: '6px 12px',
                  borderRadius: '15px', cursor: 'pointer', fontSize: '12px',
                  textTransform: 'capitalize'
                }}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Mirror Toggle Button */}
          <button 
            onClick={() => setIsMirrored(!isMirrored)}
            style={{
              background: isMirrored ? '#00ff88' : '#222',
              color: isMirrored ? '#000' : '#fff',
              border: '1px solid #444', 
              padding: '6px 12px',
              borderRadius: '15px', 
              cursor: 'pointer', 
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            ↔️ Mirror
          </button>
        </div>
      )}

      {/* 2. Viewfinder Area */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: cameraStarted ? (format === 'square' ? '1/1' : format === 'vertical' ? '9/16' : '4/3') : 'auto',
        minHeight: cameraStarted ? 'auto' : '300px', 
        maxWidth: format === 'vertical' ? '300px' : '500px',
        borderRadius: '20px', 
        border: '2px solid #00ff88',
        background: '#111', 
        overflow: 'hidden', 
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        
        {/* START BUTTON (Centered Overlay) */}
        {!cameraStarted && (
          <button 
            onClick={() => startCamera()}
            style={{
              zIndex: 10,
              background: '#00ff88', color: '#000', border: 'none',
              padding: '15px 30px', borderRadius: '10px',
              fontSize: '18px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            Start Camera
          </button>
        )}

        {/* FLIP CAMERA BUTTON (Circular Overlay) */}
        {cameraStarted && (
          <button 
            onClick={switchCamera}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(5px)'
            }}
            title="Switch Camera"
          >
            🔄
          </button>
        )}

        {/* VIDEO ELEMENT */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            display: cameraStarted ? 'block' : 'none',
            // Apply CSS transform to mirror visually
            transform: isMirrored ? 'scaleX(-1)' : 'none'
          }} 
        />
      </div>

      {/* 3. Capture Button */}
      {cameraStarted && (
        <button 
          onClick={captureFrame} 
          disabled={isProcessing}
          style={{
            background: isProcessing ? '#666' : '#00ff88',
            color: '#000', border: 'none',
            padding: '15px 30px', borderRadius: '50px',
            fontSize: '18px', fontWeight: 'bold',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            marginTop: '20px', width: '80%', maxWidth: '300px'
          }}
        >
          {isProcessing ? 'Processing...' : 'Take Photo'}
        </button>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}