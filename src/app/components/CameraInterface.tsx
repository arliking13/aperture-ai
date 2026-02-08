"use client";
import { useState, useRef, useEffect } from 'react';
import { Camera, SwitchCamera, FlipHorizontal } from 'lucide-react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { useStillness } from '../hooks/useStillness';

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
  
  // FIX: Initialize with null to satisfy TypeScript
  const requestRef = useRef<number | null>(null);
  
  // -- AI & Motion State --
  const { landmarker, isLoading: isAiLoading } = usePoseDetection();
  const { checkStillness, isStill, resetStillness } = useStillness();
  const [timerDuration, setTimerDuration] = useState(3); 
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);

  // -- Camera State --
  const [cameraStarted, setCameraStarted] = useState(false);
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  
  // ZOOM STATES
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState<{min: number, max: number} | null>(null);

  // --- THE AI LOOP ---
  const animate = () => {
    if (
      videoRef.current && 
      videoRef.current.readyState >= 2 && 
      landmarker && 
      autoCaptureEnabled &&
      countdown === null 
    ) {
      // 1. Detect Pose
      const results = landmarker.detectForVideo(videoRef.current, performance.now());
      
      // 2. Check Stillness
      if (results.landmarks && results.landmarks.length > 0) {
        const isStable = checkStillness(results.landmarks[0]);
        
        // 3. Trigger Countdown if Stable
        if (isStable) {
          startCountdown();
        }
      } else {
        // Reset if no person found
        resetStillness();
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  // Start/Stop Loop based on state
  useEffect(() => {
    if (cameraStarted && landmarker) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cameraStarted, landmarker, autoCaptureEnabled, countdown]); 

  const startCountdown = () => {
    setCountdown(timerDuration);
    let count = timerDuration;
    
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        captureFrame(); 
        resetStillness(); 
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const startCamera = async (modeOverride?: 'user' | 'environment') => {
    const targetMode = modeOverride || facingMode;
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      // FIX: Removed 'zoom: true' to prevent TypeScript error
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

  // --- ZOOM HANDLER ---
  const updateZoom = (newZoom: number) => {
    setZoom(newZoom);
    pendingZoom.current = newZoom;
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
        pendingZoom.current = null;
        // @ts-ignore
        await track.applyConstraints({ advanced: [{ zoom: zoomToApply }] });
      }
    } catch (err) {
      console.error("Zoom apply error", err);
    } finally {
      isApplyingZoom.current = false;
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
    
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

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
      
      {flashActive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'white', zIndex: 9999, pointerEvents: 'none',
          animation: 'fadeOut 0.15s ease-out'
        }} />
      )}

      {cameraStarted && (
        <div style={{ 
          display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 10px'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setIsMirrored(!isMirrored)}
              style={{
                background: 'rgba(50, 50, 50, 0.5)', border: 'none', 
                width: '40px', height: '40px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isMirrored ? '#ffd700' : '#fff', backdropFilter: 'blur(10px)'
              }}
            >
              <FlipHorizontal size={20} />
            </button>
            
            <button 
              onClick={() => {
                 const next = timerDuration === 3 ? 5 : timerDuration === 5 ? 10 : 3;
                 setTimerDuration(next);
              }}
              style={{
                background: autoCaptureEnabled ? 'rgba(0, 255, 136, 0.2)' : 'rgba(50, 50, 50, 0.5)', 
                border: autoCaptureEnabled ? '1px solid #00ff88' : 'none',
                width: '40px', height: '40px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: autoCaptureEnabled ? '#00ff88' : '#fff', backdropFilter: 'blur(10px)',
                fontSize: '12px', fontWeight: 'bold'
              }}
            >
               {timerDuration}s
            </button>
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
        
        {cameraStarted && autoCaptureEnabled && countdown === null && (
           <div style={{
             position: 'absolute', top: '20px', 
             background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px',
             color: isStill ? '#00ff88' : '#fff', fontSize: '14px', fontWeight: 'bold', 
             backdropFilter: 'blur(4px)', border: isStill ? '1px solid #00ff88' : '1px solid transparent',
             transition: 'all 0.3s'
           }}>
             {isAiLoading ? "Loading AI..." : isStill ? "Hold Still..." : "Looking for pose..."}
           </div>
        )}

        {countdown !== null && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            fontSize: '120px', fontWeight: 'bold', color: '#fff', 
            textShadow: '0 0 30px rgba(0,0,0,0.5)'
          }}>
            {countdown}
          </div>
        )}
        
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

      {cameraStarted && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          
           <div style={{ 
            display: 'flex', gap: '15px', marginBottom: '20px',
            background: 'rgba(30,30,30,0.8)', padding: '8px 20px', borderRadius: '25px'
          }}>
            {['vertical', 'album', 'square'].map(f => (
              <span 
                key={f}
                onClick={() => setFormat(f as any)} 
                style={{ 
                  color: format === f ? '#ffd700' : '#888', 
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' 
                }}
              >
                {f === 'vertical' ? '9:16' : f === 'album' ? '4:3' : '1:1'}
              </span>
            ))}
          </div>

          <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
             
             {zoomCap && (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>1x</span>
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
             )}

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

        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}