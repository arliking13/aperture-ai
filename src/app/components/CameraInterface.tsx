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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStarted(true);
      }
    } catch (err) {
      alert('Camera error: ' + err);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensions based on selected Format
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    let targetW, targetH;
    
    // Crop Logic
    if (format === 'square') {
      const size = Math.min(vidW, vidH);
      targetW = size;
      targetH = size;
    } else if (format === 'vertical') {
      // 9:16 Ratio
      targetH = vidH;
      targetW = targetH * (9/16);
      if (targetW > vidW) { 
         targetW = vidW;
         targetH = targetW * (16/9);
      }
    } else { 
      // Album (4:3)
      targetH = vidH;
      targetW = targetH * (4/3);
      if (targetW > vidW) {
        targetW = vidW;
        targetH = targetW * (3/4);
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;

    // Center Crop Calculation
    const startX = (vidW - targetW) / 2;
    const startY = (vidH - targetH) / 2;

    ctx.drawImage(video, startX, startY, targetW, targetH, 0, 0, targetW, targetH);
    
    // Send base64 back to parent
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(base64Image);
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {!cameraStarted ? (
        <button 
          onClick={startCamera}
          style={{
            background: '#00ff88', color: '#000', border: 'none',
            padding: '15px 30px', borderRadius: '10px',
            fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px'
          }}
        >
          Start Camera
        </button>
      ) : (
        <>
          {/* Format Selectors */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            {['vertical', 'album', 'square'].map((fmt) => (
              <button 
                key={fmt}
                onClick={() => setFormat(fmt as any)}
                style={{
                  background: format === fmt ? '#fff' : '#333',
                  color: format === fmt ? '#000' : '#fff',
                  border: '1px solid #555', padding: '8px 15px',
                  borderRadius: '20px', cursor: 'pointer', fontSize: '14px',
                  textTransform: 'capitalize'
                }}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Viewfinder */}
          <div style={{
            position: 'relative', width: '100%',
            aspectRatio: format === 'square' ? '1/1' : format === 'vertical' ? '9/16' : '4/3',
            maxWidth: format === 'vertical' ? '300px' : '500px',
            borderRadius: '20px', border: '2px solid #00ff88',
            background: '#111', overflow: 'hidden', transition: 'all 0.3s ease'
          }}>
            <video 
              ref={videoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>

          {/* Capture Button */}
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
        </>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}