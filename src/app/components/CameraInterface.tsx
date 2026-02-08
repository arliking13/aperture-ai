"use client";
import { useState, useRef, useEffect } from 'react';
import { Camera, SwitchCamera, FlipHorizontal } from 'lucide-react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef<number>(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  
  // -- Optimization Refs --
  const isApplyingZoom = useRef(false);
  const pendingZoom = useRef<number | null>(null);

  // --- STATE ---
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [format, setFormat] = useState<'vertical' | 'square' | 'album'>('vertical');
  const [isMirrored, setIsMirrored] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Settings
  const [timerDuration, setTimerDuration] = useState(3);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  
  // Zoom State
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState<{min: number, max: number} | null>(null);

  // 1. INITIALIZE AI
  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU" // Or "CPU" if iPhone crashes
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        setLandmarker(marker);
      } catch (err) {
        console.error("AI Load Error:", err);
      }
    }
    loadAI();
  }, []);

  // 2. MOVEMENT MATH
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

  // 3. DETECTION LOOP
  const detectPose = () => {
    if (!landmarker || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    const startTime = performance.now();
    const results = landmarker.detectForVideo(video, startTime);
    
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawLandmarks(landmarks, { radius: 3, color: '#00ff88', fillColor: '#000' });
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

          if (autoCaptureEnabled && countdown === null && !isProcessing) {
            const movement = calculateMovement(landmarks, previousLandmarks.current);
            
            if (movement < 0.008) {
              stillFrames.current++;
              if (stillFrames.current === 30 && !countdownTimer.current) {
                startCountdownSequence();
              }
            } else {
              stillFrames.current = 0;
            }
            previousLandmarks.current = landmarks;
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // 4. COUNTDOWN
  const startCountdownSequence = () => {
    let count = timerDuration;
    setCountdown(count);
    
    if (countdownTimer.current) clearInterval(countdownTimer.current);

    countdownTimer.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownTimer.current!);
        countdownTimer.current = null;
        setCountdown(null);
        captureFrame();
        stillFrames.current = 0; 
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  // 5. START CAMERA
  const startCamera = async (modeOverride?: 'user' | 'environment') => {
    const targetMode = modeOverride || facingMode;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: targetMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
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
            } else {
              setZoomCap(null);
            }
          }
        };
      }
    } catch (err) {
      alert("Camera Error: " + err);
    }
  };

  // 6. ZOOM
  const updateZoom = (newZoom: number) => {
    setZoom(newZoom);
    pendingZoom.current = newZoom;
    if (!isApplyingZoom.current) applyZoomToHardware();
  };

  const applyZoomToHardware = async () => {
    if (!videoRef.current?.srcObject) return;
    const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
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
      console.error(err);
    } finally {
      isApplyingZoom.current = false;
      if (pendingZoom.current !== null) applyZoomToHardware();
    }
  };

  // 7. CAPTURE
  const captureFrame = () => {
    if (!videoRef.current) return;
    
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    const video = videoRef.current;
    const canvas = document.createElement('canvas'); 
    
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    let targetW = vidW, targetH = vidH;

    if (format === 'square') {
      const size = Math.min(vidW, vidH);
      targetW = size; targetH = size;
    } else if (format === 'vertical') {
       targetH = vidH; targetW = targetH * (9/16);
       if (targetW > vidW) { targetW = vidW; targetH = targetW * (16/9); }
    } else {
       targetH = vidH; targetW = targetH * (4/3);
       if (targetW > vidW) { targetW = vidW; targetH = targetW * (3/4); }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startX = (vidW - targetW) / 2;
    const startY = (vidH - targetH) / 2;

    ctx.save();
    if (isMirrored) {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, startX, startY, targetW, targetH, 0, 0, targetW, targetH);
    ctx.restore();

    onCapture(canvas.toDataURL('image/jpeg', 0.95));
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      if (videoRef.current?.srcObject) {
         (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const switchCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    setIsMirrored(newMode === 'user');
    startCamera(newMode);
  };

  // --- RENDER ---
  return (
    <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {flashActive && (
        <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, pointerEvents: 'none', animation: 'fadeOut 0.15s ease-out' }} />
      )}

      {cameraStarted && (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: '20px', padding: '0 10px' }}>
          <button onClick={() => setIsMirrored(!isMirrored)} style={btnStyle}>
             <FlipHorizontal size={20} color={isMirrored ? '#ffd700' : '#fff'} />
          </button>
          
          <button 
             onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)} 
             style={{...btnStyle, border: autoCaptureEnabled ? '1px solid #00ff88' : 'none', color: autoCaptureEnabled ? '#00ff88' : '#fff', fontSize: '10px', width: 'auto', padding: '0 15px'}}
          >
             {autoCaptureEnabled ? "AUTO ON" : "AUTO OFF"}
          </button>

          <button onClick={switchCamera} style={btnStyle}>
             <SwitchCamera size={20} color="#fff" />
          </button>
        </div>
      )}

      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: cameraStarted ? (format === 'square' ? '1/1' : format === 'vertical' ? '9/16' : '4/3') : 'auto',
        minHeight: cameraStarted ? 'auto' : '400px',
        borderRadius: '24px', background: '#000', overflow: 'hidden', 
        border: '2px solid #333',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {!cameraStarted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
             <Camera size={64} color="#333" />
             <button onClick={() => startCamera()} style={mainBtnStyle}>Open Camera</button>
             {!landmarker && <p style={{color: '#666', fontSize: '12px'}}>Loading AI...</p>}
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStarted ? 'block' : 'none', transform: isMirrored ? 'scaleX(-1)' : 'none' }} 
        />
        <canvas ref={canvasRef} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: isMirrored ? 'scaleX(-1)' : 'none', pointerEvents: 'none' }}
        />

        {countdown !== null && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '100px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 20px #000' }}>
            {countdown}
          </div>
        )}

        {cameraStarted && autoCaptureEnabled && countdown === null && (
           <div style={{
             position: 'absolute', top: '20px', 
             background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '20px',
             color: '#fff', fontSize: '12px', fontWeight: 'bold', 
             backdropFilter: 'blur(4px)'
           }}>
             {isProcessing ? "Processing..." : landmarker ? "Detecting..." : "Loading AI..."}
           </div>
        )}
      </div>

      {cameraStarted && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
           
           {zoomCap && (
              <div style={{ width: '100%', maxWidth: '300px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>1x</span>
                <input type="range" min={zoomCap.min} max={zoomCap.max} step="0.1" value={zoom} 
                  onChange={(e) => updateZoom(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: '#ffd700', cursor: 'grab' }}
                />
                <span style={{ fontSize: '12px', color: '#666' }}>{zoomCap.max.toFixed(1)}x</span>
              </div>
            )}

           <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: 'rgba(30,30,30,0.8)', padding: '8px 20px', borderRadius: '25px'}}>
            {['vertical', 'album', 'square'].map(f => (
              <span key={f} onClick={() => setFormat(f as any)} 
                style={{ color: format === f ? '#ffd700' : '#888', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {f === 'vertical' ? '9:16' : f === 'album' ? '4:3' : '1:1'}
              </span>
            ))}
          </div>

          <button 
             onClick={captureFrame} 
             disabled={isProcessing}
             style={{
               width: '72px', height: '72px', borderRadius: '50%',
               background: isProcessing ? '#ccc' : '#fff',
               border: '4px solid rgba(0,0,0,0)', outline: '4px solid #fff', outlineOffset: '4px',
               cursor: isProcessing ? 'wait' : 'pointer',
               transform: isProcessing ? 'scale(0.9)' : 'scale(1)'
             }}
          />
        </div>
      )}
    </div>
  );
}

// Simple Styles
const btnStyle = { background: 'rgba(50, 50, 50, 0.5)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };
const mainBtnStyle = { background: '#fff', color: '#000', border: 'none', padding: '12px 30px', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };