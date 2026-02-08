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
  
  // -- Optimization Refs --
  const isApplyingZoom = useRef(false);
  const pendingZoom = useRef<number | null>(null);
  
  const [cameraStarted, setCameraStarted] = useState(false);
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);
  
  // ZOOM STATES
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState<{min: number, max: number} | null>(null);

  const startCamera = async (modeOverride?: 'user' | 'environment') => {
    const targetMode = modeOverride || facingMode;
    
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
          
          const track = stream.getVideoTracks()[0];
          
          // @ts-ignore
          if ('getCapabilities' in track) {
            // @ts-ignore
            const capabilities = track.getCapabilities();
            // @ts-ignore
            if (capabilities.zoom) {
              // @ts-ignore
              setZoomCap({ min: capabilities.zoom.min, max: capabilities.zoom.max });
              // @ts-ignore
              setZoom(capabilities.zoom.min);
            } else {
              setZoomCap(null);
            }
          }
        };
      }
    } catch (err) {
      alert('Camera error: ' + err);
    }
  };

  // --- SMOOTH ZOOM HANDLER ---
  const updateZoom = (newZoom: number) => {
    // 1. Update UI Instantly
    setZoom(newZoom);
    
    // 2. Queue for Hardware
    pendingZoom.current = newZoom;

    // 3. Process Queue
    if (!isApplyingZoom.current) {
      applyZoomToHardware();
    }
  };

  const applyZoomToHardware = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    // @ts-ignore
    if (!track.applyConstraints) return;

    isApplyingZoom.current = true;

    try {
      while (pendingZoom.current !== null) {
        const zoomToApply = pendingZoom.current;
        pendingZoom.current = null; // Clear immediately so new inputs can fill it
        
        // @ts-ignore
        await track.applyConstraints({ advanced: [{ zoom: zoomToApply }] });
      }
    } catch (err) {
      console.error("Zoom apply error", err);
    } finally {
      isApplyingZoom.current = false;
      // Double check if user moved slider while we were applying
      if (pendingZoom.current !== null) applyZoomToHardware();
    }
  };

  const switchCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
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
          display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 10px'
        }}>
          <button 
            onClick={() => setIsMirrored(!isMirrored)}
            style={{
              background: 'rgba(50, 50, 50, 0.5)', border: 'none', 
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: isMirrored ? '#ffd700' : '#fff',
              backdropFilter: 'blur(10px)'
            }}
          >
            <FlipHorizontal size={20} />
          </button>

          <div style={{ 
            display: 'flex', gap: '15px', background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: '20px', backdropFilter: 'blur(10px)'
          }}>
            {['vertical', 'album', 'square'].map(f => (
              <span 
                key={f}
                onClick={() => setFormat(f as any)} 
                style={{ 
                  color: format === f ? '#ffd700' : '#fff', 
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' 
                }}
              >
                {f === 'vertical' ? '9:16' : f === 'album' ? '4:3' : '1:1'}
              </span>
            ))}
          </div>

           <button 
            onClick={switchCamera}
            style={{
              background: 'rgba(50, 50, 50, 0.5)', border: 'none', 
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', backdropFilter: 'blur(10px)'
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
        borderRadius: '24px', background: '#000', overflow: 'hidden', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
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

        <video 
          ref={videoRef} autoPlay playsInline muted
          style={{ 
            width: '100%', height: '100%', objectFit: 'cover',
            display: cameraStarted ? 'block' : 'none',
            transform: isMirrored ? 'scaleX(-1)' : 'none'
          }} 
        />
        
        {/* CURRENT ZOOM DISPLAY */}
        {cameraStarted && zoomCap && (
          <div style={{
            position: 'absolute', bottom: '20px', 
            background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: '20px',
            color: '#fff', fontSize: '12px', fontWeight: 'bold', backdropFilter: 'blur(4px)'
          }}>
            {zoom.toFixed(1)}x
          </div>
        )}
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      {cameraStarted && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          
          {/* ZOOM CONTROLS */}
          {zoomCap && (
            <div style={{ width: '100%', maxWidth: '320px', marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              
              {/* Preset Buttons (iPhone Style) */}
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                {[1, 2, 3].map((level) => {
                  if (level > zoomCap.max || level < zoomCap.min) return null;
                  return (
                    <button
                      key={level}
                      onClick={() => updateZoom(level)}
                      style={{
                        width: '35px', height: '35px', borderRadius: '50%',
                        background: zoom === level ? '#ffd700' : 'rgba(50,50,50,0.8)',
                        color: zoom === level ? '#000' : '#fff',
                        border: 'none', fontSize: '12px', fontWeight: 'bold',
                        cursor: 'pointer', backdropFilter: 'blur(5px)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {level}x
                    </button>
                  );
                })}
              </div>

              {/* Slider */}
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>{zoomCap.min}x</span>
                <input 
                  type="range" 
                  min={zoomCap.min} 
                  max={zoomCap.max} 
                  step="0.1" 
                  value={zoom} 
                  onChange={(e) => updateZoom(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: '#ffd700', cursor: 'grab' }}
                />
                <span style={{ fontSize: '12px', color: '#666' }}>{zoomCap.max.toFixed(1)}x</span>
              </div>
            </div>
          )}

          {/* SHUTTER BUTTON */}
          <button 
            onClick={captureFrame} 
            disabled={isProcessing}
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: isProcessing ? '#ccc' : '#fff',
              border: '4px solid rgba(0,0,0,0)',
              outline: '4px solid #fff', outlineOffset: '4px',
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