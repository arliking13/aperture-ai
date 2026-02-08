"use client";
import { useState, useRef, useEffect } from 'react';
import { Camera, SwitchCamera, FlipHorizontal } from 'lucide-react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  // --- LOGIC REFS (The "Brain") ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef<number>(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const isApplyingZoom = useRef(false);
  const pendingZoom = useRef<number | null>(null);

  // --- UI STATE (The "Look") ---
  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [isMirrored, setIsMirrored] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isAiReady, setIsAiReady] = useState(false);
  const [isStill, setIsStill] = useState(false);
  
  // Settings
  const [timerDuration, setTimerDuration] = useState(3);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  
  // Zoom
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState<{min: number, max: number} | null>(null);

  // 1. INITIALIZE AI (The Working Logic)
  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU" // Kept GPU as it worked for you
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        landmarkerRef.current = marker;
        setIsAiReady(true);
      } catch (err) {
        console.error("AI Error:", err);
      }
    }
    loadAI();
  }, []);

  // 2. MATH HELPER
  const calculateMovement = (current: any[], previous: any[] | null): number => {
    if (!previous) return 999;
    const keyPoints = [0, 11, 12, 23, 24]; 
    let total = 0;
    keyPoints.forEach(i => {
      if (current[i] && previous[i]) {
        const dx = current[i].x - previous[i].x;
        const dy = current[i].y - previous[i].y;
        total += Math.sqrt(dx * dx + dy * dy);
      }
    });
    return total / keyPoints.length;
  };

  // 3. THE LOOP
  const detectPose = () => {
    if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const results = landmarkerRef.current.detectForVideo(video, performance.now());

    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Draw Skeleton (Visual Feedback)
          // Using your original colors (White/Green)
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawLandmarks(landmarks, { radius: 3, color: '#00ff88', fillColor: '#000' });
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

          // Logic
          if (autoCaptureEnabled && !countdownTimer.current) {
             const movement = calculateMovement(landmarks, previousLandmarks.current);
             if (movement < 0.008) {
               stillFrames.current++;
               setIsStill(true);
               // Trigger at 30 frames (~1 sec)
               if (stillFrames.current > 30) { 
                 startCountdownSequence();
               }
             } else {
               stillFrames.current = 0;
               setIsStill(false);
             }
             previousLandmarks.current = landmarks;
          }
        } else {
          setIsStill(false);
          stillFrames.current = 0;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // 4. COUNTDOWN
  const startCountdownSequence = () => {
    if (countdownTimer.current) return;
    
    let count = timerDuration;
    setCountdown(count);
    setIsStill(true); 

    countdownTimer.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownTimer.current!);
        countdownTimer.current = null;
        setCountdown(null);
        triggerCapture();
        stillFrames.current = 0;
        setIsStill(false);
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  // 5. CAMERA START & ZOOM
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          setCameraStarted(true);
          detectPose();
          
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
            }
          }
        };
      }
    } catch (e) { alert("Camera Error"); }
  };

  const updateZoom = (newZoom: number) => {
    setZoom(newZoom);
    pendingZoom.current = newZoom;
    if (!isApplyingZoom.current) applyZoomToHardware();
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
    } catch (err) { console.error(err); } 
    finally {
      isApplyingZoom.current = false;
      if (pendingZoom.current !== null) applyZoomToHardware();
    }
  };

  // 6. CAPTURE LOGIC
  const triggerCapture = () => {
    if (!videoRef.current) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    const video = videoRef.current;
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    let targetW = vidW, targetH = vidH;

    if (format === 'square') {
      const size = Math.min(vidW, vidH); targetW = size; targetH = size;
    } else if (format === 'vertical') {
       targetH = vidH; targetW = targetH * (9/16);
       if (targetW > vidW) { targetW = vidW; targetH = targetW * (16/9); }
    } else {
       targetH = vidH; targetW = targetH * (4/3);
       if (targetW > vidW) { targetW = vidW; targetH = targetW * (3/4); }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const startX = (vidW - targetW) / 2;
      const startY = (vidH - targetH) / 2;
      ctx.save();
      if (isMirrored) { ctx.translate(targetW, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, startX, startY, targetW, targetH, 0, 0, targetW, targetH);
      ctx.restore();
      onCapture(canvas.toDataURL('image/jpeg', 0.95));
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Flash Overlay */}
      {flashActive && <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, animation: 'fadeOut 0.15s ease-out', pointerEvents: 'none' }} />}

      {/* --- TOP TOOLBAR --- */}
      {cameraStarted && (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 10px' }}>
          <button 
             onClick={() => setIsMirrored(!isMirrored)}
             style={{...iconBtnStyle, color: isMirrored ? '#ffd700' : '#fff'}}
          >
             <FlipHorizontal size={24} />
          </button>
          
          <button 
             onClick={() => {
                const next = timerDuration === 3 ? 5 : timerDuration === 5 ? 10 : 3;
                setTimerDuration(next);
             }}
             style={{
                ...iconBtnStyle, 
                width: 'auto', padding: '0 15px', borderRadius: '20px',
                border: autoCaptureEnabled ? '1px solid #00ff88' : '1px solid #333',
                color: autoCaptureEnabled ? '#00ff88' : '#fff', 
                fontSize: '13px', fontWeight: 'bold'
             }}
          >
             {autoCaptureEnabled ? `AUTO ${timerDuration}s` : "MANUAL"}
          </button>

          <button 
             onClick={() => {
                const newMode = facingMode === 'user' ? 'environment' : 'user';
                setFacingMode(newMode);
                setCameraStarted(false); 
                setTimeout(() => startCamera(), 100);
             }} 
             style={iconBtnStyle}
          >
             <SwitchCamera size={24} />
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
             <button onClick={startCamera} style={startBtnStyle}>Open Camera</button>
             {!isAiReady && <p style={{color: '#666', fontSize: '12px'}}>Loading AI...</p>}
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStarted ? 'block' : 'none', transform: isMirrored ? 'scaleX(-1)' : 'none' }} 
        />
        <canvas ref={canvasRef} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: isMirrored ? 'scaleX(-1)' : 'none', pointerEvents: 'none' }}
        />

        {/* COUNTDOWN */}
        {countdown !== null && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '120px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
            {countdown}
          </div>
        )}

        {/* STATUS BADGE */}
        {cameraStarted && autoCaptureEnabled && countdown === null && (
           <div style={{ 
             position: 'absolute', top: '20px', 
             background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', 
             color: isStill ? '#00ff88' : '#fff', fontSize: '14px', fontWeight: 'bold', 
             backdropFilter: 'blur(4px)', border: isStill ? '1px solid #00ff88' : '1px solid transparent',
             transition: 'all 0.3s'
           }}>
             {isAiReady ? (isStill ? "Hold Still..." : "Looking for pose...") : "Loading AI..."}
           </div>
        )}
        
        {/* ZOOM INDICATOR */}
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
           
           {/* FORMAT SELECTOR */}
           <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', background: 'rgba(30,30,30,0.8)', padding: '10px 25px', borderRadius: '30px' }}>
            {['vertical', 'album', 'square'].map(f => (
              <span key={f} onClick={() => setFormat(f as any)} 
                style={{ color: format === f ? '#ffd700' : '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {f === 'vertical' ? '9:16' : f === 'album' ? '4:3' : '1:1'}
              </span>
            ))}
          </div>

          {/* CONTROLS ROW */}
          <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
             
             {/* ZOOM SLIDER */}
             {zoomCap && (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>1x</span>
                  <input 
                    type="range" min={zoomCap.min} max={zoomCap.max} step="0.1" value={zoom} 
                    onChange={(e) => updateZoom(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#ffd700', cursor: 'grab', height: '4px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#666' }}>{zoomCap.max.toFixed(1)}x</span>
                </div>
             )}

            {/* SHUTTER BUTTON */}
            <button 
               onClick={triggerCapture} 
               disabled={isProcessing}
               style={{
                 width: '80px', height: '80px', borderRadius: '50%',
                 background: isProcessing ? '#333' : '#fff',
                 border: '4px solid rgba(0,0,0,0)', outline: '4px solid #fff', outlineOffset: '4px',
                 cursor: isProcessing ? 'wait' : 'pointer',
                 transition: 'transform 0.1s',
                 transform: isProcessing ? 'scale(0.9)' : 'scale(1)',
                 boxShadow: '0 0 20px rgba(255,255,255,0.2)'
               }}
            />
             
             <button 
                onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
                style={{ fontSize: '12px', color: '#666', background: 'none', border: 'none', marginTop: '10px' }}
             >
               {autoCaptureEnabled ? "Tap to switch to Manual" : "Tap to switch to Auto"}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const iconBtnStyle = {
  background: 'rgba(50, 50, 50, 0.5)', border: 'none', 
  width: '45px', height: '45px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', backdropFilter: 'blur(10px)', color: '#fff'
};

const startBtnStyle = {
  background: '#fff', color: '#000', border: 'none',
  padding: '15px 40px', borderRadius: '30px',
  fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
  boxShadow: '0 10px 30px rgba(255,255,255,0.2)'
};