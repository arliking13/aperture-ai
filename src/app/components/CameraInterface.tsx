"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, Timer, TimerOff, Zap, ZapOff, Square, Ratio, Lightbulb, LightbulbOff, Sparkles } from 'lucide-react';
import { usePoseTracker } from '../hooks/usePoseTracker';
import { takeSnapshot } from '../utils/cameraHelpers';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [isMirrored, setIsMirrored] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  
  // Settings
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 5 | 10>(0); 
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState({ min: 1, max: 10 });
  const [autoSessionActive, setAutoSessionActive] = useState(false);
  
  // --- NEW: TIPS TOGGLE ---
  const [tipsEnabled, setTipsEnabled] = useState(true); // Default ON
  const [currentAdvice, setCurrentAdvice] = useState<string | null>(null);

  const { isAiReady, startTracking, stopTracking, countdown: aiCountdown, isStill, getInstantAdvice } = usePoseTracker(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    () => performCapture(), 
    timerDuration, 
    autoCaptureEnabled,
    autoSessionActive
  );

  const performCapture = useCallback(async () => {
    if (!videoRef.current) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);
    const image = takeSnapshot(videoRef.current, format, isMirrored);
    if (image) onCapture(image);

    // ONLY GET ADVICE IF USER WANTS IT
    if (tipsEnabled && getInstantAdvice) {
        const advice = await getInstantAdvice();
        if (advice) setCurrentAdvice(advice);
    }
  }, [format, isMirrored, onCapture, getInstantAdvice, tipsEnabled]);

  const [manualCountdown, setManualCountdown] = useState<number | null>(null);

  const handleShutterPress = () => {
    if (isProcessing) return;
    
    // Clear old advice when taking new photo
    setCurrentAdvice(null);

    if (autoCaptureEnabled) {
        setAutoSessionActive(!autoSessionActive);
        return;
    }
    if (timerDuration === 0) {
      performCapture();
      return;
    }
    setManualCountdown(timerDuration);
    let count = timerDuration;
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        setManualCountdown(null);
        performCapture();
      } else { setManualCountdown(count); }
    }, 1000);
  };

  useEffect(() => { setAutoSessionActive(false); }, [autoCaptureEnabled]);
  const activeCountdown = manualCountdown !== null ? manualCountdown : aiCountdown;

  const handleZoomChange = (newZoom: number) => {
    const z = Math.min(Math.max(newZoom, zoomCap.min), zoomCap.max);
    setZoom(z);
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(() => {
        if (!videoRef.current?.srcObject) return;
        const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
        (track as any).applyConstraints({ advanced: [{ zoom: z }] }).catch((e: any) => console.log(e));
    }, 100);
  };

  const startCamera = async (overrideMode?: 'user' | 'environment') => {
    try {
      const modeToUse = overrideMode || facingMode;
      if (videoRef.current && videoRef.current.srcObject) {
         const oldStream = videoRef.current.srcObject as MediaStream;
         oldStream.getTracks().forEach(track => track.stop());
      }
      const constraints = {
        video: { facingMode: modeToUse, width: { ideal: 1920 }, height: { ideal: 1080 }, zoom: true } as any
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          setCameraStarted(true);
          const track = stream.getVideoTracks()[0];
          const caps = (track.getCapabilities() as any) || {};
          if (caps.zoom) {
            setZoomCap({ min: caps.zoom.min, max: caps.zoom.max });
            setZoom(1);
          }
        };
      }
    } catch (e) { alert("Camera Error: " + e); }
  };

  useEffect(() => { if (cameraStarted) startTracking(); else stopTracking(); }, [cameraStarted, startTracking, stopTracking]);
  const toggleTimer = () => setTimerDuration(p => p === 0 ? 3 : p === 3 ? 5 : p === 5 ? 10 : 0);
  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    setIsMirrored(newMode === 'user');
    await startCamera(newMode);
  };
  const cycleFormat = () => { setFormat(prev => prev === 'vertical' ? 'square' : prev === 'square' ? 'album' : 'vertical'); };

  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {flashActive && <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, animation: 'fadeOut 0.15s', pointerEvents: 'none' }} />}

      {/* --- CAMERA VIEWFINDER --- */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: cameraStarted ? (format==='square'?'1/1':format==='vertical'?'9/16':'4/3') : 'auto',
        minHeight: cameraStarted ? 'auto' : '500px',
        borderRadius: 24, background: '#000', overflow: 'hidden', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        
        {!cameraStarted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
             <Camera size={64} color="#333" />
             <button onClick={() => startCamera()} style={startBtn}>Open Camera</button>
             <p style={{color:'#666', fontSize:12}}>Aperture AI Ready</p>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStarted ? 'block' : 'none', transform: isMirrored ? 'scaleX(-1)' : 'none' }} 
        />
        <canvas ref={canvasRef} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: isMirrored ? 'scaleX(-1)' : 'none', pointerEvents: 'none' }}
        />

        {activeCountdown !== null && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
            <span style={{ fontSize: 140, fontWeight: 'bold', color: '#fff', textShadow: '0 5px 20px rgba(0,0,0,0.5)' }}>
                {activeCountdown}
            </span>
          </div>
        )}

        {/* --- OVERLAY CONTROLS --- */}
        {cameraStarted && (
            <>
                {/* Top Bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}>
                    {/* Auto/Manual */}
                    <button onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
                        style={{...capsuleBtn, background: 'rgba(0,0,0,0.4)', border: autoCaptureEnabled ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.2)'}}>
                        {autoCaptureEnabled ? <Zap size={14} color="#00ff88"/> : <ZapOff size={14} color="#fff"/>}
                        <span style={{ color: autoCaptureEnabled ? '#00ff88' : '#fff' }}>{autoCaptureEnabled ? "AUTO" : "MANUAL"}</span>
                    </button>
                    
                    {/* Right Side Icons */}
                    <div style={{display:'flex', gap: 10}}>
                        {/* TIPS TOGGLE (NEW) */}
                        <button onClick={() => setTipsEnabled(!tipsEnabled)} style={iconBtn}>
                             {tipsEnabled ? <Lightbulb size={20} color="#ffd700" /> : <LightbulbOff size={20} color="#aaa" />}
                        </button>
                        {/* TIMER */}
                        <button onClick={toggleTimer} style={iconBtn}>
                            {timerDuration === 0 ? <TimerOff size={20} /> : <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:0, fontSize:10, fontWeight:'bold'}}><Timer size={16} />{timerDuration}s</div>}
                        </button>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}>
                    <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
                        {[0.5, 1, 2].map(z => ( (z >= zoomCap.min && z <= zoomCap.max) && (
                            <button key={z} onClick={(e) => { e.stopPropagation(); handleZoomChange(z); }} 
                                style={{ width: 30, height: 30, borderRadius: '50%', background: zoom === z ? 'rgba(255,215,0,0.9)' : 'rgba(0,0,0,0.5)', color: zoom === z ? '#000' : '#fff', fontSize: 10, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>
                                {z}x
                            </button>
                        ) ))}
                    </div>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
                        <button onClick={cycleFormat} style={iconBtn}>
                            <Ratio size={20} />
                            <span style={{fontSize:9, marginTop:2, fontWeight:'bold'}}>{format === 'vertical' ? '9:16' : format === 'square' ? '1:1' : '4:3'}</span>
                        </button>
                        <button onClick={handleShutterPress} disabled={isProcessing}
                            style={{ width: 72, height: 72, borderRadius: '50%', background: isProcessing ? '#333' : (autoCaptureEnabled && autoSessionActive ? '#ff3b30' : '#fff'), border: '4px solid rgba(0,0,0,0.1)', outline: '4px solid #fff', outlineOffset: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {autoCaptureEnabled && autoSessionActive ? <Square fill="#fff" size={24} /> : null}
                        </button>
                        <button onClick={switchCamera} style={iconBtn}>
                            <SwitchCamera size={22} />
                        </button>
                    </div>
                </div>
            </>
        )}
      </div>

      {/* --- ADVICE BUBBLE --- */}
      {/* Show ONLY if tips enabled AND advice exists AND camera is running */}
      {tipsEnabled && currentAdvice && cameraStarted && (
        <div style={{ 
            width: '100%',
            background: '#222', 
            border: '1px solid #333',
            color: '#fff', 
            padding: '16px', 
            borderRadius: '16px',
            fontSize: 14, 
            fontWeight: '500', 
            lineHeight: '1.5',
            display: 'flex', 
            gap: 12, 
            alignItems: 'start',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <Sparkles size={20} color="#ffd700" style={{flexShrink:0, marginTop: 2}} />
            <div>
                <span style={{display: 'block', fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1}}>AI Photo Tip</span>
                <span>{currentAdvice}</span>
            </div>
        </div>
      )}

    </div>
  );
}

const iconBtn = { background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', width: 40, height: 40 };
const capsuleBtn = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(10px)' };
const startBtn = { background: '#fff', color: '#000', border: 'none', padding: '15px 40px', borderRadius: 30, fontSize: 18, fontWeight: 'bold', cursor: 'pointer' };