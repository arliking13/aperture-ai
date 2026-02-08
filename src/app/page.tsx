"use client";
import React, { useRef, useState, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { analyzePoseData } from './actions';

export default function PosingCoach() {
  // Refs
const videoRef = useRef<HTMLVideoElement | null>(null);
const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
const animationFrameRef = useRef<number | undefined>(undefined);
const previousLandmarks = useRef<any[] | null>(null);
const stillFrames = useRef<number>(0);
const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  
  // Core states
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Loading...");
  const [poseScore, setPoseScore] = useState(0);
  const [feedback, setFeedback] = useState<string[]>([]);
  
  // Timer states
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(true);
  
  // Gallery states
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  // Settings
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // Helpers
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#00ff00';
    if (score >= 75) return '#7fff00';
    if (score >= 60) return '#ffff00';
    if (score >= 40) return '#ff9900';
    return '#ff3300';
  };

  const speak = (text: string) => {
    if (!voiceEnabled || !speechSynthesis) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

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

  const capturePhoto = () => {
    if (!videoRef.current || !captureCanvasRef.current) return;
    
    const canvas = captureCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (facingMode === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0);
    }
    
    const photo = canvas.toDataURL('image/jpeg', 0.95);
    setPhotos(prev => [...prev, photo]);
    
    // Flash effect
    const flashCtx = overlayCanvasRef.current?.getContext('2d');
    if (flashCtx) {
      flashCtx.fillStyle = 'rgba(255,255,255,0.9)';
      flashCtx.fillRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);
      setTimeout(() => flashCtx.clearRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height), 100);
    }
    
    speak("Photo captured");
    stillFrames.current = 0;
  };

  const analyzePose = (landmarks: any[]) => {
    const [nose, , , , , , , , , , , ls, rs, , , , , , , , , , , lh, rh] = landmarks;
    if (!nose || !ls || !rs || !lh || !rh) return { feedback: [], score: 0 };
    
    let score = 100;
    const fb: string[] = [];
    
    const sc = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const hc = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    
    // Shoulders
    const sTilt = Math.abs(ls.y - rs.y) / Math.abs(rs.x - ls.x);
    const sDeg = Math.atan(sTilt) * 180 / Math.PI;
    if (sTilt > 0.15) { score -= 20; fb.push(`⚠️ Shoulders ${sDeg.toFixed(1)}°`); }
    else if (sTilt > 0.08) { score -= 8; fb.push(`💡 Slight tilt`); }
    else fb.push(`✓ Shoulders level`);
    
    // Posture
    const spine = Math.abs(90 - Math.abs(Math.atan2(hc.y - sc.y, hc.x - sc.x) * 180 / Math.PI));
    if (spine > 20) { score -= 25; fb.push(`⚠️ Straighten back`); }
    else if (spine > 12) { score -= 12; fb.push(`💡 Stand upright`); }
    else fb.push(`✓ Good posture`);
    
    // Head
    const head = Math.abs(nose.x - sc.x);
    if (head > 0.15) { score -= 15; fb.push(`⚠️ Center head`); }
    else if (head > 0.09) { score -= 7; fb.push(`💡 Center head`); }
    else fb.push(`✓ Head centered`);
    
    // Chin
    const chin = sc.y - nose.y;
    if (chin < 0.1) { score -= 12; fb.push(`💡 Lift chin`); }
    else if (chin > 0.3) { score -= 8; fb.push(`💡 Lower chin`); }
    else fb.push(`✓ Chin good`);
    
    return { feedback: fb, score: Math.max(0, Math.min(100, score)) };
  };

  const detectPose = () => {
    if (!poseLandmarker || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }
    
    const results = poseLandmarker.detectForVideo(videoRef.current, performance.now());
    const ctx = overlayCanvasRef.current?.getContext('2d');
    
    if (ctx) {
      ctx.clearRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);
      
      if (results.landmarks?.[0]) {
        const { feedback: fb, score } = analyzePose(results.landmarks[0]);
        const color = getScoreColor(score);
        
        const draw = new DrawingUtils(ctx);
        draw.drawLandmarks(results.landmarks[0], { radius: 5, color, fillColor: '#fff' });
        draw.drawConnectors(results.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 3 });
        
        setFeedback(fb);
        setPoseScore(score);
        
        // Motion detection
        if (timerEnabled) {
          const movement = calculateMovement(results.landmarks[0], previousLandmarks.current);
          
          if (movement < 0.008) {
            stillFrames.current++;
            setIsMoving(false);
            
            if (stillFrames.current === 30 && !countdownTimer.current) {
              let count = timerDuration;
              setCountdown(count);
              
              countdownTimer.current = setInterval(() => {
                count--;
                if (count <= 0) {
                  clearInterval(countdownTimer.current!);
                  countdownTimer.current = null;
                  capturePhoto();
                  setCountdown(null);
                } else {
                  setCountdown(count);
                }
              }, 1000);
            }
          } else {
            if (countdownTimer.current) {
              clearInterval(countdownTimer.current);
              countdownTimer.current = null;
            }
            stillFrames.current = 0;
            setCountdown(null);
            setIsMoving(true);
          }
          
          previousLandmarks.current = results.landmarks[0];
        }
      } else {
        setFeedback(["No person detected"]);
        setPoseScore(0);
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Initialize
  useEffect(() => {
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        setPoseLandmarker(landmarker);
        setStatus("Ready");
      } catch (err) {
        console.error(err);
        setStatus("Failed");
      }
    })();
  }, []);

  // Camera
  useEffect(() => {
    (async () => {
      try {
        const constraints: any = {
          video: {
            facingMode,
            width: 1280,
            height: 720
          }
        };
        
        if (flashEnabled && facingMode === "environment") {
          constraints.video.torch = true;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = detectPose;
        }
      } catch (err) {
        console.error(err);
        setStatus("Camera Error");
      }
    })();
    
    return () => {
      videoRef.current?.srcObject && 
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
      countdownTimer.current && clearInterval(countdownTimer.current);
    };
  }, [facingMode, poseLandmarker, flashEnabled]);

  const currentColor = getScoreColor(poseScore);

  return (
    <main style={{
      background: '#000',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      gap: '20px'
    }}>
      
      {/* Status */}
      <div style={{
        position: 'fixed',
        top: 15,
        right: 15,
        background: 'rgba(0,0,0,0.7)',
        padding: '8px 15px',
        borderRadius: '20px',
        color: '#fff',
        fontSize: '0.75rem',
        zIndex: 50,
        backdropFilter: 'blur(10px)'
      }}>
        {status}
      </div>
      
      {/* Score */}
      <div style={{
        position: 'fixed',
        top: 15,
        left: 15,
        background: 'rgba(0,0,0,0.8)',
        padding: '12px 20px',
        borderRadius: '20px',
        zIndex: 50,
        border: `3px solid ${currentColor}`,
        textAlign: 'center',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{ margin: 0, fontSize: '0.65rem', color: '#888', fontWeight: 'bold', letterSpacing: '1.5px' }}>
          POSE SCORE
        </p>
        <p style={{ margin: '5px 0 0', fontSize: '2rem', color: currentColor, fontWeight: 'bold', lineHeight: 1 }}>
          {poseScore}
        </p>
      </div>
      
      {/* Settings Toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        style={{
          position: 'fixed',
          top: 80,
          left: 15,
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '8px 15px',
          borderRadius: '20px',
          fontSize: '0.7rem',
          cursor: 'pointer',
          zIndex: 50,
          backdropFilter: 'blur(10px)',
          fontWeight: 'bold'
        }}
      >
        ⚙️ Settings
      </button>
      
      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 120,
          left: 15,
          background: 'rgba(0,0,0,0.95)',
          padding: '15px',
          borderRadius: '15px',
          zIndex: 50,
          border: '1px solid rgba(255,255,255,0.2)',
          minWidth: '200px'
        }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>SETTINGS</p>
          
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.75rem', color: '#fff' }}>
            <input 
              type="checkbox" 
              checked={timerEnabled} 
              onChange={(e) => setTimerEnabled(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Auto Timer
          </label>
          
          {timerEnabled && (
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.75rem', color: '#fff' }}>
              Countdown:
              <select 
                value={timerDuration} 
                onChange={(e) => setTimerDuration(Number(e.target.value))}
                style={{
                  marginLeft: '8px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  padding: '4px',
                  borderRadius: '5px'
                }}
              >
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
              </select>
            </label>
          )}
          
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.75rem', color: '#fff' }}>
            <input 
              type="checkbox" 
              checked={voiceEnabled} 
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Voice
          </label>
          
          {facingMode === "environment" && (
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#fff' }}>
              <input 
                type="checkbox" 
                checked={flashEnabled} 
                onChange={(e) => setFlashEnabled(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Flashlight
            </label>
          )}
        </div>
      )}
      
      {/* Camera */}
      <div style={{
        position: 'relative',
        width: '85%',
        maxWidth: '500px',
        aspectRatio: '3/4',
        borderRadius: '30px',
        overflow: 'hidden',
        border: `3px solid ${currentColor}`,
        boxShadow: `0 0 30px ${currentColor}50`,
        transition: 'border-color 0.3s'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: facingMode === "user" ? 'scaleX(-1)' : 'none'
          }}
        />
        
        <canvas
          ref={overlayCanvasRef}
          width={1280}
          height={960}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: facingMode === "user" ? 'scaleX(-1)' : 'none'
          }}
        />
        
        <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
        
        {/* Countdown */}
        {countdown !== null && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '8rem',
            fontWeight: 'bold',
            color: '#00ff88',
            textShadow: '0 0 40px rgba(0,255,136,0.8)',
            pointerEvents: 'none'
          }}>
            {countdown}
          </div>
        )}
        
        {/* Movement Indicator */}
        {timerEnabled && !isMoving && countdown === null && (
          <div style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,255,136,0.9)',
            color: '#000',
            padding: '8px 20px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            ⏱️ Hold Still...
          </div>
        )}
        
        {/* Perfect Pose */}
        {poseScore >= 90 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '4rem',
            animation: 'pulse 1s infinite',
            pointerEvents: 'none',
            textShadow: '0 0 20px rgba(0,255,0,0.8)'
          }}>
            🌟
          </div>
        )}
        
        {/* Flip Camera */}
        <button
          onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")}
          style={{
            position: 'absolute',
            top: 15,
            right: 15,
            width: '50px',
            height: '50px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            fontSize: '24px',
            zIndex: 10
          }}
        >
          🔄
        </button>
      </div>
      
      {/* Gallery Thumbnails */}
      {photos.length > 0 && (
        <div style={{
          width: '85%',
          maxWidth: '500px',
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          padding: '10px 0'
        }}>
          {photos.map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt={`Photo ${i + 1}`}
              onClick={() => setSelectedPhoto(photo)}
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '10px',
                cursor: 'pointer',
                border: '2px solid rgba(0,255,136,0.5)'
              }}
            />
          ))}
        </div>
      )}
      
      {/* Photo Preview */}
      {selectedPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.95)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          gap: '20px'
        }}>
          <img src={selectedPhoto} alt="Preview" style={{
            maxWidth: '90%',
            maxHeight: '70vh',
            borderRadius: '20px',
            boxShadow: '0 10px 50px rgba(0,255,136,0.3)'
          }} />
          <div style={{ display: 'flex', gap: '15px' }}>
            <a
              href={selectedPhoto}
              download={`photo-${Date.now()}.jpg`}
              style={{
                background: '#00ff88',
                color: '#000',
                border: 'none',
                padding: '15px 35px',
                borderRadius: '25px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              💾 Download
            </a>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '15px 35px',
                borderRadius: '25px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
      
      {/* Feedback */}
      <div style={{
        width: '85%',
        maxWidth: '500px',
        background: 'rgba(20,20,20,0.9)',
        padding: '15px 20px',
        borderRadius: '20px',
        border: `1px solid ${currentColor}40`,
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.65rem',
          color: currentColor,
          fontWeight: 'bold',
          letterSpacing: '1px',
          marginBottom: '10px'
        }}>
          📊 REAL-TIME FEEDBACK
        </p>
        
        {poseScore >= 90 && (
          <p style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#ffd700', fontWeight: 'bold' }}>
            🌟 PERFECT POSE!
          </p>
        )}
        
        {feedback.map((fb, i) => (
          <p key={i} style={{
            margin: '5px 0',
            fontSize: '0.85rem',
            color: fb.includes('✓') ? '#0f0' : '#fff',
            lineHeight: '1.4'
          }}>
            {fb}
          </p>
        ))}
      </div>
      
      <p style={{ color: '#333', fontSize: '0.6rem', letterSpacing: '2px' }}>
        APERTURE AI • SMART TIMER
      </p>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </main>
  );
}
