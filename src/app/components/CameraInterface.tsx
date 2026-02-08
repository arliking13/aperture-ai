"use client";
import { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  SwitchCamera, 
  FlipHorizontal, 
} from 'lucide-react';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraStarted, setCameraStarted] = useState(false);
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);

  // Auto-start camera on mount
  useEffect(() => {
    // startCamera(); // Uncomment if you want instant start
  }, []);

  const startCamera = async (modeOverride?: 'user' | 'environment') => {
    const targetMode = modeOverride || facingMode;
    // Stop existing tracks if any
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
    // Auto-mirror logic: Front=True, Back=False
    setIsMirrored(newMode === 'user');
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

    ctx.save();
    if (isMirrored) {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, startX, startY, targetW, targetH, 0, 0, targetW, targetH);
    ctx.restore();
    
    onCapture(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* --- TOP TOOLBAR --- */}
      {cameraStarted && (
        <div style={{ 
          display: 'flex', 
          width: '100%', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          padding: '0 10px'
        }}>
          {/* Mirror Toggle */}
          <button 
            onClick={() => setIsMirrored(!isMirrored)}
            style={{
              background: 'rgba(50, 50, 50, 0.5)',
              border: 'none', 
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: isMirrored ? '#ffd700' : '#fff',
              backdropFilter: 'blur(10px)'
            }}
          >
            <FlipHorizontal size={20} />
          </button>

          {/* Format Selection (Text style) */}
          <div style={{ 
            display: 'flex', gap: '15px', 
            background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            <span 
              onClick={() => setFormat('vertical')}
              style={{ 
                color: format === 'vertical' ? '#ffd700' : '#fff', 
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '1px' 
              }}
            >
              9:16
            </span>
            <span 
              onClick={() => setFormat('album')}
              style={{ 
                color: format === 'album' ? '#ffd700' : '#fff', 
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '1px' 
              }}
            >
              4:3
            </span>
            <span 
              onClick={() => setFormat('square')}
              style={{ 
                color: format === 'square' ? '#ffd700' : '#fff', 
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '1px' 
              }}
            >
              1:1
            </span>
          </div>

           {/* Flip Camera */}
           <button 
            onClick={switchCamera}
            style={{
              background: 'rgba(50, 50, 50, 0.5)',
              border: 'none', 
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
              backdropFilter: 'blur(10px)'
            }}
          >
            <SwitchCamera size={20} />
          </button>
        </div>
      )}

      {/* --- VIEWFINDER --- */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: cameraStarted ? (format === 'square' ? '1/1' : format === 'vertical' ? '9/16' : '4/3') : 'auto',
        minHeight: cameraStarted ? 'auto' : '400px',
        borderRadius: '24px', 
        background: '#000', 
        overflow: 'hidden', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        
        {/* Start Button (If camera off) */}
        {!cameraStarted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <Camera size={64} color="#333" />
            <button 
              onClick={() => startCamera()}
              style={{
                background: '#fff', color: '#000', border: 'none',
                padding: '12px 30px', borderRadius: '30px',
                fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Open Camera
            </button>
          </div>
        )}

        {/* Video Feed */}
        <video 
          ref={videoRef} autoPlay playsInline muted
          style={{ 
            width: '100%', height: '100%', objectFit: 'cover',
            display: cameraStarted ? 'block' : 'none',
            transform: isMirrored ? 'scaleX(-1)' : 'none'
          }} 
        />
      </div>

      {/* --- BOTTOM CONTROLS (Centered Shutter) --- */}
      {cameraStarted && (
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          
          {/* iOS SHUTTER BUTTON */}
          <button 
            onClick={captureFrame} 
            disabled={isProcessing}
            style={{
              width: '72px', height: '72px',
              borderRadius: '50%',
              background: isProcessing ? '#ccc' : '#fff',
              border: '4px solid rgba(0,0,0,0)', // Invisible border for spacing
              outline: '4px solid #fff', // Outer ring
              outlineOffset: '4px',
              cursor: isProcessing ? 'wait' : 'pointer',
              transition: 'transform 0.1s',
              transform: isProcessing ? 'scale(0.9)' : 'scale(1)'
            }}
          />

        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}