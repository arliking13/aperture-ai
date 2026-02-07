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
  
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Initialize MediaPipe Pose Landmarker
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
        setStatus("Camera Ready");
      } catch (err) {
        console.error("Pose Landmarker Init Error:", err);
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: 1280, height: 720 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // ✅ FIX: Start detection loop immediately after video loads
          videoRef.current.onloadeddata = () => {
            console.log("✅ Video loaded, starting pose detection...");
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            detectPose();
          };
        }
      } catch (err) {
        console.error("Camera Error:", err);
        setStatus("Camera Error");
      }
    };
    
    startCamera();
    
    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [facingMode, poseLandmarker]); // ✅ FIX: Added poseLandmarker dependency

  // FREE Local Pose Analysis
  const analyzePoseGeometry = (landmarks: any[]) => {
    const advice: string[] = [];
    
    // Get key landmarks
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!nose || !leftShoulder || !rightShoulder) return;
    
    // Check shoulder alignment
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    if (shoulderDiff > 0.05) {
      advice.push("⚠️ Level your shoulders");
    }
    
    // Check posture (shoulders should be behind hips)
    const shoulderMidpoint = (leftShoulder.y + rightShoulder.y) / 2;
    const hipMidpoint = (leftHip.y + rightHip.y) / 2;
    
    if (shoulderMidpoint < hipMidpoint - 0.15) {
      advice.push("⚠️ Straighten your back");
    }
    
    // Check head position
    const shoulderXMid = (leftShoulder.x + rightShoulder.x) / 2;
    if (Math.abs(nose.x - shoulderXMid) > 0.1) {
      advice.push("⚠️ Center your head");
    }
    
    // Check chin angle
    if (nose.y > shoulderMidpoint - 0.15) {
      advice.push("💡 Lift your chin slightly");
    }
    
    // All good!
    if (advice.length === 0) {
      advice.push("✓ Great pose!");
    }
    
    setPoseAdvice(advice);
    setStatus(advice[0]);
  };

  // Optional: Get AI Creative Advice (only when button pressed)
  const getAiAdvice = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    
    setStatus("Getting AI advice...");
    
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.3);
      const response = await analyzeFrame(imageData);
      
      if (response.startsWith("HUMAN:")) {
        setAiAdviceText(response.replace("HUMAN:", "").trim());
        setShowAiAdvice(true);
        setTimeout(() => setShowAiAdvice(false), 5000);
      }
    }
    
    setStatus("Camera Ready");
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
        
        {/* AI Advice Button */}
        <button
          onClick={getAiAdvice}
          style={{
            position: 'absolute',
            bottom: 15,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            padding: '12px 25px',
            borderRadius: '25px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
            zIndex: 10
          }}
        >
          🎨 Get AI Advice
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
