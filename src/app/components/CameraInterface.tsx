"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, FlipHorizontal, Timer, Zap, ZapOff } from 'lucide-react';
import { usePoseTracker } from '../hooks/usePoseTracker';
import { takeSnapshot } from '../utils/cameraHelpers';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [isMirrored, setIsMirrored] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  
  const [timerDuration, setTimerDuration] = useState(3);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState({ min: 1, max: 5 });

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);
    const image = takeSnapshot(videoRef.current, format, isMirrored);
    if (image) onCapture(image);
  }, [format, isMirrored, onCapture]);

  // Hook connection
  const { isAiReady, startTracking, stopTracking, countdown, isStill } = usePoseTracker(
    videoRef, canvasRef, handleCapture, timerDuration, autoCaptureEnabled
  );

  useEffect(() => {
    if (cameraStarted) startTracking();
    else stopTracking();
  }, [cameraStarted, startTracking, stopTracking]);

  const startCamera = async () => {
    try {
      // FIX: Cast options to 'any' to allow 'zoom' property
      const options: any = {
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 }, zoom: true }
      };
      const stream = await navigator.mediaDevices.getUserMedia(options);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          setCameraStarted(true);
          
          const track = stream.getVideoTracks()[0];
          // FIX: Cast capabilities to 'any' to safely read 'zoom'
          const caps = (track.getCapabilities() as any) || {};
          if (caps.zoom) {
            setZoomCap({ min: caps.zoom.min, max: caps.zoom.max });
          }
        };
      }
    } catch (e) { alert("Camera Error: " + e); }
  };

  const updateZoom = (val: number) => {
    setZoom(val);
    if (!videoRef.current?.srcObject) return;
    const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
    // FIX: Cast to 'any' to use applyConstraints with zoom
    (track as any).applyConstraints({ advanced: [{ zoom: val }] }).catch(console.error);
  };

  // ... (Keep the rest of your render/return code exactly as it was) ...
  // Paste the 'return (...)' block from the previous full file here.
  // Do you need me to paste the JSX block again?
  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {flashActive && <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, animation: 'fadeOut 0.15s', pointerEvents: 'none' }} />}

      {/* TOOLBAR */}
      {cameraStarted && (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 15, padding: '0 10px' }}>
          <button onClick={() => setTimerDuration(prev => prev === 3 ? 5 : prev === 5 ? 10 : 3)} style={{...iconBtn, flexDirection:'column', gap:0, fontSize:10, fontWeight:'bold'}}>
             <Timer size={14} />{timerDuration}s
          </button>
          <button onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
             style={{...iconBtn, width:'auto', padding:'0 15px', color: autoCaptureEnabled?'#00ff88':'#fff', border: autoCaptureEnabled?'1px solid #00ff88':'1px solid transparent', fontSize:12, fontWeight:'bold', gap:5}}>
             {autoCaptureEnabled ? <Zap size={14}/> : <ZapOff size={14}/>}
             {autoCaptureEnabled ? "AUTO" : "MANUAL"}
          </button>
          <button onClick={() => setIsMirrored(!isMirrored)} style={{...iconBtn, color: isMirrored?'#ffd700':'#fff'}}>
             <FlipHorizontal size={20} />
          </button>
          <button onClick={() => { setFacingMode(p => p==='user'?'environment':'user'); setCameraStarted(false); setTimeout(startCamera, 200); }} style={iconBtn}>
             <SwitchCamera size={20} />
          </button>
        </div>
      )}

      {/* VIEWFINDER */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: cameraStarted ? (format==='square'?'1/1':format==='vertical'?'9/16':'4/3') : 'auto',
        minHeight: cameraStarted ? 'auto' : '400px',
        borderRadius: 24, background: '#000', overflow: 'hidden', 
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {!cameraStarted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
             <Camera size={64} color="#333" />
             <button onClick={startCamera} style={startBtn}>Open Camera</button>
             {!isAiReady && <p style={{color:'#666', fontSize:12}}>Loading AI...</p>}
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStarted ? 'block' : 'none', transform: isMirrored ? 'scaleX(-1)' : 'none' }} 
        />
        <canvas ref={canvasRef} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: isMirrored ? 'scaleX(-1)' : 'none', pointerEvents: 'none' }}
        />

        {countdown !== null && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 100, fontWeight: 'bold', color: '#fff', textShadow: '0 0 20px #000' }}>
            {countdown}
          </div>
        )}

        {cameraStarted && autoCaptureEnabled && countdown === null && (
           <div style={{ position: 'absolute', top: 20, background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 20, color: isStill?'#00ff88':'#fff', fontSize: 12, fontWeight: 'bold', backdropFilter: 'blur(4px)', border: isStill?'1px solid #00ff88':'none' }}>
             {isAiReady ? (isStill ? "Hold Still..." : "Looking...") : "Loading AI..."}
           </div>
        )}
      </div>

      {cameraStarted && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
           <div style={{ display: 'flex', gap: 20, marginBottom: 20, background: 'rgba(30,30,30,0.8)', padding: '8px 20px', borderRadius: 25 }}>
            {['vertical', 'album', 'square'].map(f => (
              <span key={f} onClick={() => setFormat(f as any)} 
                style={{ color: format===f?'#ffd700':'#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                {f==='vertical'?'9:16':f==='album'?'4:3':'1:1'}
              </span>
            ))}
          </div>

          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 320, marginBottom: 20 }}>
             <span style={{ fontSize: 12, color: '#666' }}>1x</span>
             <input type="range" min={zoomCap.min} max={zoomCap.max} step={0.1} value={zoom} 
               onChange={(e) => updateZoom(parseFloat(e.target.value))}
               style={{ flex: 1, accentColor: '#ffd700', cursor: 'grab', height: 4 }}
             />
             <span style={{ fontSize: 12, color: '#666' }}>{zoomCap.max}x</span>
          </div>

          <button onClick={handleCapture} disabled={isProcessing}
             style={{ width: 80, height: 80, borderRadius: '50%', background: isProcessing?'#333':'#fff', border: '4px solid rgba(0,0,0,0)', outline: '4px solid #fff', outlineOffset: 4, cursor: isProcessing?'wait':'pointer', transform: isProcessing?'scale(0.9)':'scale(1)' }}
          />
        </div>
      )}
    </div>
  );
}

const iconBtn = { background: 'rgba(50,50,50,0.5)', border: 'none', width: 45, height: 45, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)', color: '#fff' };
const startBtn = { background: '#fff', color: '#000', border: 'none', padding: '15px 40px', borderRadius: 30, fontSize: 18, fontWeight: 'bold', cursor: 'pointer' };