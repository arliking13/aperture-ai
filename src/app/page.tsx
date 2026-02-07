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
  const [poseAdvice, setPoseAdvice] = useState<string[]>([]);
  const [showAiAdvice, setShowAiAdvice] = useState(false);
  const [aiAdviceText, setAiAdviceText] = useState("");
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Initialize MediaPipe Pose Landmarker
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      try {
        console.log("🔄 Initializing MediaPipe...");
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
        setStatus("Camera Ready");
        console.log("✅ MediaPipe loaded successfully");
      } catch (err) {
        console.error("❌ Pose Landmarker Init Error:", err);
        setStatus("AI Load Failed");
      }
    };
    
    initializePoseLandmarker();
  }, []);

  // Real-time Pose Detection Loop
  const detectPose = () => {
    if (!poseLandmarker || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }
    
    const startTimeMs = performance.now();
    const results = poseLandmarker.detectForVideo(videoRef.current, startTimeMs);
    
    // Clear previous drawings
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Draw pose landmarks
        if (results.landmarks && results.landmarks[0]) {
          const drawingUtils = new DrawingUtils(ctx);
          
          // Draw connections (skeleton)
          drawingUtils.drawLandmarks(results.landmarks[0], {
            radius: 4,
            color: '#0070f3',
            fillColor: '#fff'
          });
          
          drawingUtils.drawConnectors(
            results.landmarks[0],
            PoseLandmarker.POSE_CONNECTIONS,
            { color: '#00ff00', lineWidth: 2 }
          );
          
          // Analyze pose in real-time (FREE!)
          analyzePoseGeometry(results.landmarks[0]);
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Start Camera + Detection Loop
  useEffect(() => {
    const startCamera = async () => {
      try {
        console.log("📷 Starting camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: 1280, height: 720 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadeddata = () => {
            console.log("✅ Video loaded, starting pose detection...");
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            detectPose();
          };
        }
      } catch (err) {
        console.error("❌ Camera Error:", err);
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

  // FREE Local Pose Analysis
  const analyzePoseGeometry = (landmarks: any[]) => {
    const advice: string[] = [];
    
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!nose || !leftShoulder || !rightShoulder) return;
    
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    if (shoulderDiff > 0.05) {
      advice.push("⚠️ Level your shoulders");
    }
    
    const shoulderMidpoint = (leftShoulder.y + rightShoulder.y) / 2;
    const hipMidpoint = (leftHip.y + rightHip.y) / 2;
    
    if (shoulderMidpoint < hipMidpoint - 0.15) {
      advice.push("⚠️ Straighten your back");
    }
    
    const shoulderXMid = (leftShoulder.x + rightShoulder.x) / 2;
    if (Math.abs(nose.x - shoulderXMid) > 0.1) {
      advice.push("⚠️ Center your head");
    }
    
    if (nose.y > shoulderMidpoint - 0.15) {
      advice.push("💡 Lift your chin slightly");
    }
    
    if (advice.length === 0) {
      advice.push("✓ Great pose!");
    }
    
    setPoseAdvice(advice);
    setStatus(advice[0]);
  };

  // Get AI Creative Advice - WITH EXTRA LOGGING
  const getAiAdvice = async () => {
    console.log("🔵 Button clicked!");
    
    if (!videoRef.current) {
      console.error("❌ Video ref is null");
      alert("Video not ready");
      return;
    }
    
    if (videoRef.current.readyState < 2) {
      console.error("❌ Video not ready, readyState:", videoRef.current.readyState);
      alert("Video not loaded yet");
      return;
    }
    
    console.log("✅ Video is ready");
    setIsLoadingAdvice(true);
    setStatus("Getting AI advice...");
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas ref is null");
      }
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error("Cannot get canvas context");
      }
      
      console.log("📸 Capturing frame...");
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.3);
      console.log("📦 Image data length:", imageData.length);
      console.log("🚀 Calling analyzeFrame...");
      
      const response = await analyzeFrame(imageData);
      console.log("📥 Response received:", response);
      
      if (response.startsWith("HUMAN:")) {
        const tip = response.replace("HUMAN:", "").trim();
        console.log("✅ Got advice:", tip);
        setAiAdviceText(tip);
        setShowAiAdvice(true);
        setTimeout(() => setShowAiAdvice(false), 5000);
        setStatus("Camera Ready");
      } else if (response.startsWith("ERROR:")) {
        console.error("❌ API Error:", response);
        alert("Error: " + response);
        setStatus("API Error");
      } else {
        console.log("⚠️ Unexpected response format:", response);
        setAiAdviceText(response);
        setShowAiAdvice(true);
        setTimeout(() => setShowAiAdvice(false), 5000);
        setStatus("Camera Ready");
      }
    } catch (err) {
      console.error("❌ getAiAdvice Error:", err);
      alert("Error: " + (err as Error).message);
      setStatus("Error");
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  // Test button that just console logs
  const testButton = () => {
    console.log("🧪 TEST BUTTON CLICKED!");
    alert("Test button works!");
  };

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
      
      {/* AI Advice Toast */}
      {showAiAdvice && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: '#fff',
          padding: '15px 25px',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          borderLeft: '5px solid #0070f3',
          maxWidth: '90%'
        }}>
          <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 'bold', color: '#0070f3' }}>
            🤖 AI CREATIVE ADVICE
          </p>
          <p style={{ margin: '5px 0 0', fontSize: '0.9rem', color: '#000' }}>
            {aiAdviceText}
          </p>
        </div>
      )}
      
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
        backdropFilter: 'blur(10px)'
      }}>
        {status}
      </div>
      
      {/* Camera View with Overlay */}
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
        
        {/* Pose Overlay Canvas */}
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
        
        {/* Flip Camera Button */}
        <button
          onClick={() => {
            console.log("🔄 Flip button clicked");
            setFacingMode(prev => prev === "user" ? "environment" : "user");
          }}
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
        
        {/* TEST BUTTON - Simple alert */}
        <button
          onClick={testButton}
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff0000',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '15px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          🧪 TEST
        </button>
        
        {/* AI Advice Button */}
        <button
          onClick={getAiAdvice}
          disabled={isLoadingAdvice}
          style={{
            position: 'absolute',
            bottom: 15,
            left: '50%',
            transform: 'translateX(-50%)',
            background: isLoadingAdvice ? '#666' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            padding: '12px 25px',
            borderRadius: '25px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: isLoadingAdvice ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
            zIndex: 10,
            opacity: isLoadingAdvice ? 0.6 : 1
          }}
        >
          {isLoadingAdvice ? '⏳ Loading...' : '🎨 Get AI Advice'}
        </button>
      </div>
      
      {/* Real-time Feedback Panel */}
      <div style={{
        marginTop: '20px',
        width: '85%',
        maxWidth: '500px',
        background: 'rgba(20,20,20,0.9)',
        padding: '15px 20px',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.65rem',
          color: '#888',
          fontWeight: 'bold',
          letterSpacing: '1px',
          marginBottom: '10px'
        }}>
          📊 REAL-TIME ANALYSIS (FREE)
        </p>
        {poseAdvice.map((advice, i) => (
          <p key={i} style={{
            margin: '5px 0',
            fontSize: '0.85rem',
            color: advice.includes('✓') ? '#0f0' : '#fff',
            lineHeight: '1.4'
          }}>
            {advice}
          </p>
        ))}
      </div>
      
      <p style={{
        color: '#333',
        fontSize: '0.6rem',
        letterSpacing: '2px',
        marginTop: '15px'
      }}>
        APERTURE AI • FREE MODE
      </p>
    </main>
  );
}
