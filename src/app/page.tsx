"use client";
import React, { useRef, useState, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { analyzeFrame } from './actions';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Loading AI...");
  const [currentAdvice, setCurrentAdvice] = useState<string>("Position yourself in frame");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastAiCallTime = useRef<number>(0);
  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // Speak advice with natural voice
  const speakAdvice = (text: string) => {
    if (!voiceEnabled || !speechSynthesis) return;
    
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = speechSynthesis.getVoices();
    const naturalVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Enhanced'))
    );
    
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    speechSynthesis.speak(utterance);
  };

  // Initialize MediaPipe
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        
        setPoseLandmarker(landmarker);
        setStatus("Ready");
        console.log("✅ Ready to coach!");
      } catch (err) {
        console.error("❌ Error:", err);
        setStatus("Failed to load");
      }
    };
    
    initializePoseLandmarker();
    
    if (speechSynthesis) {
      speechSynthesis.getVoices();
    }
  }, []);

  // Pose detection loop
  const detectPose = () => {
    if (!poseLandmarker || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }
    
    const startTimeMs = performance.now();
    const results = poseLandmarker.detectForVideo(videoRef.current, startTimeMs);
    
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        if (results.landmarks && results.landmarks[0]) {
          const drawingUtils = new DrawingUtils(ctx);
          
          drawingUtils.drawLandmarks(results.landmarks[0], {
            radius: 5,
            color: '#00ff88',
            fillColor: '#fff'
          });
          
          drawingUtils.drawConnectors(
            results.landmarks[0],
            PoseLandmarker.POSE_CONNECTIONS,
            { color: '#00ff88', lineWidth: 3 }
          );
          
          // Get AI advice every 15 seconds (within free tier limit)
          const now = Date.now();
          if (now - lastAiCallTime.current > 15000) { // 15 seconds = 4 calls/minute
            getAiCoaching(results.landmarks[0]);
            lastAiCallTime.current = now;
          }
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Get natural conversational AI coaching
  const getAiCoaching = async (landmarks: any[]) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.3);
      
      console.log("🎙️ Getting AI coaching...");
      const response = await analyzeFrame(imageData);
      
      if (response.startsWith("HUMAN:")) {
        const advice = response.replace("HUMAN:", "").trim();
        console.log("💬 AI says:", advice);
        setCurrentAdvice(advice);
        speakAdvice(advice);
      } else if (!response.includes("ERROR") && !response.includes("429")) {
        setCurrentAdvice(response);
        speakAdvice(response);
      }
    } catch (err) {
      console.error("Coaching error:", err);
    }
  };

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: 1280, height: 720 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            console.log("📷 Camera ready");
            detectPose();
          };
        }
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera Error");
      }
    };
    
    startCamera();
    
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [facingMode, poseLandmarker]);

  return (
    <main style={{
      background: '#000',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      
      {/* Status Bar */}
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
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {isSpeaking && <span style={{ fontSize: '16px' }}>🔊</span>}
        {status}
      </div>
      
      {/* Voice Toggle */}
      <button
        onClick={() => setVoiceEnabled(!voiceEnabled)}
        style={{
          position: 'fixed',
          top: 15,
          left: 15,
          background: voiceEnabled ? '#0070f3' : 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '8px 15px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          zIndex: 50,
          backdropFilter: 'blur(10px)',
          fontWeight: 'bold'
        }}
      >
        {voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
      </button>
      
      {/* Camera View */}
      <div style={{
        position: 'relative',
        width: '85%',
        maxWidth: '500px',
        aspectRatio: '3/4',
        borderRadius: '30px',
        overflow: 'hidden',
        border: '3px solid #333'
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
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Flip Camera */}
        <button
          onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")}
          style={{
            position: 'absolute',
            top: 15,
            right: 15,
            width: '45px',
            height: '45px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            fontSize: '22px',
            zIndex: 10
          }}
        >
          🔄
        </button>
      </div>
      
      {/* Live Coaching Display */}
      <div style={{
        marginTop: '20px',
        width: '85%',
        maxWidth: '500px',
        background: 'rgba(20,20,20,0.9)',
        padding: '20px',
        borderRadius: '20px',
        border: '2px solid rgba(0,255,136,0.3)',
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.7rem',
          color: '#00ff88',
          fontWeight: 'bold',
          letterSpacing: '2px',
          marginBottom: '12px'
        }}>
          🎙️ AI COACH
        </p>
        <p style={{
          margin: 0,
          fontSize: '1rem',
          color: '#fff',
          lineHeight: '1.5',
          fontStyle: 'italic'
        }}>
          "{currentAdvice}"
        </p>
      </div>
      
      <p style={{
        color: '#333',
        fontSize: '0.6rem',
        letterSpacing: '2px',
        marginTop: '15px'
      }}>
        APERTURE AI • VOICE COACH
      </p>
    </main>
  );
}
