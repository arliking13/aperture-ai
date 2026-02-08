"use client";
import { useState, useRef, useEffect } from 'react';
import { Camera, SwitchCamera, FlipHorizontal } from 'lucide-react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

interface CameraInterfaceProps {
  onCapture: (base64Image: string) => void;
  isProcessing: boolean;
}

export default function CameraInterface({ onCapture, isProcessing }: CameraInterfaceProps) {
  // --- REFS (From Old Code) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrames = useRef<number>(0);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  // --- UI STATE ---
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
  
  // AI Ref
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // 1. LOAD AI (Run once on mount)
  useEffect(() => {
    async function loadAI() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const marker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU" // USING GPU (Like your old code)
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        landmarkerRef.current = marker;
        setIsAiReady(true);
        console.log("AI Loaded");
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

  // 3. THE LOOP (Self-contained)
  const detectPose = () => {
    if (!landmarkerRef.current || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const results = landmarkerRef.current.detectForVideo(video, performance.now());

    // DRAW & LOGIC
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Visuals
          const drawingUtils = new DrawingUtils(ctx);
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });

          // Logic
          if (autoCaptureEnabled && !countdownTimer.current) {
             const movement = calculateMovement(landmarks, previousLandmarks.current);
             if (movement < 0.008) {
               stillFrames.current++;
               setIsStill(true);
               if (stillFrames.current > 30) { // ~1 second
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
    setIsStill(true); // Keep UI green

    countdownTimer.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownTimer.current!);
        countdownTimer.current = null;
        setCountdown(null);
        triggerCapture(); // Capture!
        stillFrames.current = 0;
        setIsStill(false);
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  // 5. CAMERA START
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          setCameraStarted(true);
          detectPose(); // Start loop
        };
      }
    } catch (e) { alert("Camera Error"); }
  };

  // 6. CAPTURE LOGIC
  const triggerCapture = () => {
    if (!videoRef.current) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    const video = videoRef.current;
    // Format Crop Logic...
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
      
      {flashActive && <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 999, animation: 'fadeOut 0.15s' }} />}

      {/* TOOLBAR */}
      {cameraStarted && (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: '20px', padding: '0 10px' }}>
          <button onClick={() => setIsMirrored(!isMirrored)} style={btnStyle}>
             <FlipHorizontal size={20} color={isMirrored ? '#ffd700' : '#fff'} />
          </button>
          <button onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)} 
             style={{...btnStyle, width: 'auto', padding: '0 15px', color: autoCaptureEnabled ? '#00ff88' : '#fff', fontSize: '10px', border: autoCaptureEnabled ? '1px solid #00ff88' : 'none'}}>
             {autoCaptureEnabled ? "AUTO ON" : "AUTO OFF"}
          </button>
          <button onClick={() => {
             const newMode = facingMode === 'user' ? 'environment' : 'user';
             setFacingMode(newMode);
             setCameraStarted(false); // Restart cam
             setTimeout(() => startCamera(), 100);
          }} style={btnStyle}>
             <SwitchCamera size={20} color="#fff" />
          </button>
        </div>
      )}

      {/* VIEWFINDER */}
      <div style={{
        position: 'relative', width: '100%',
        aspectRatio: cameraStarted ? (format === 'square' ? '1/1' : format === 'vertical' ? '9/16' : '4/3') : 'auto',
        minHeight: cameraStarted ? 'auto' : '400px',
        borderRadius: '24px', background: '#000', overflow: 'hidden', border: '2px solid #333',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {!cameraStarted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
             <Camera size={64} color="#333" />
             <button onClick={startCamera} style={mainBtnStyle}>Open Camera</button>
             {!isAiReady && <p style={{color: '#666', fontSize: '12px'}}>Loading AI...</p>}
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted 
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStarted ? 'block' : 'none', transform: isMirrored ? 'scaleX(-1)' : 'none' }} 
        />
        <canvas ref={canvasRef} 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: isMirrored ? 'scaleX(-1)' : 'none', pointerEvents: 'none' }}
        />

        {/* OVERLAYS */}
        {countdown !== null && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '100px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 20px #000' }}>
            {countdown}
          </div>
        )}

        {cameraStarted && autoCaptureEnabled && countdown === null && (
           <div style={{ position: 'absolute', top: '20px', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '20px', color: isStill ? '#00ff88' : '#fff', fontSize: '12px', fontWeight: 'bold', backdropFilter: 'blur(4px)', border: isStill ? '1px solid #00ff88' : 'none' }}>
             {isAiReady ? (isStill ? "Hold Still..." : "Detecting...") : "Loading AI..."}
           </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      {cameraStarted && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
           <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: 'rgba(30,30,30,0.8)', padding: '8px 20px', borderRadius: '25px'}}>
            {['vertical', 'album', 'square'].map(f => (
              <span key={f} onClick={() => setFormat(f as any)} 
                style={{ color: format === f ? '#ffd700' : '#888', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {f === 'vertical' ? '9:16' : f === 'album' ? '4:3' : '1:1'}
              </span>
            ))}
          </div>
          <button onClick={triggerCapture} disabled={isProcessing}
             style={{ width: '72px', height: '72px', borderRadius: '50%', background: isProcessing ? '#ccc' : '#fff', border: '4px solid rgba(0,0,0,0)', outline: '4px solid #fff', outlineOffset: '4px', cursor: isProcessing ? 'wait' : 'pointer', transform: isProcessing ? 'scale(0.9)' : 'scale(1)' }}
          />
        </div>
      )}
    </div>
  );
}

const btnStyle = { background: 'rgba(50, 50, 50, 0.5)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };
const mainBtnStyle = { background: '#fff', color: '#000', border: 'none', padding: '12px 30px', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };