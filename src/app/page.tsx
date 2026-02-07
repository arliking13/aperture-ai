"use client";
import React, { useRef, useState, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { analyzePoseData } from './actions';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Loading AI...");
  const [currentAdvice, setCurrentAdvice] = useState<string>("Press the button for AI coaching");
  const [localFeedback, setLocalFeedback] = useState<string[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const currentPoseData = useRef<string>("");
  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // Speak advice
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
      (voice.name.includes('Google') || voice.name.includes('Natural'))
    );
    
    if (naturalVoice) utterance.voice = naturalVoice;
    
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
        console.log("✅ Ready!");
      } catch (err) {
        console.error("❌ Error:", err);
        setStatus("Failed");
      }
    };
    
    initializePoseLandmarker();
    if (speechSynthesis) speechSynthesis.getVoices();
  }, []);

  // FIXED: Improved pose analysis with angle-based calculations
  const analyzePoseLocally = (landmarks: any[]) => {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return { feedback: [], description: "" };
    }
    
    const feedback: string[] = [];
    let description = "CURRENT POSE:\n";
    
    // Calculate centers
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    
    // 1. SHOULDER TILT (angle-based, more accurate)
    const shoulderAngle = Math.atan2(
      rightShoulder.y - leftShoulder.y,
      rightShoulder.x - leftShoulder.x
    ) * 180 / Math.PI;
    
    const shoulderTilt = Math.abs(shoulderAngle);
    
    if (shoulderTilt > 8) {
      const higherSide = leftShoulder.y < rightShoulder.y ? "left" : "right";
      feedback.push(`⚠️ ${higherSide.charAt(0).toUpperCase() + higherSide.slice(1)} shoulder higher`);
      description += `- Shoulders uneven (${shoulderTilt.toFixed(1)}° tilt, ${higherSide} higher)\n`;
    } else if (shoulderTilt > 4) {
      feedback.push(`💡 Minor shoulder tilt`);
      description += `- Slight shoulder tilt (${shoulderTilt.toFixed(1)}°)\n`;
    } else {
      feedback.push(`✓ Shoulders level`);
      description += `- Shoulders level (${shoulderTilt.toFixed(1)}° - excellent)\n`;
    }
    
    // 2. SPINE ALIGNMENT (proper angle calculation)
    const spineAngle = Math.atan2(
      hipCenter.y - shoulderCenter.y,
      hipCenter.x - shoulderCenter.x
    ) * 180 / Math.PI;
    
    // Spine should be close to 90° (vertical) when standing straight
    const spineDeviation = Math.abs(90 - Math.abs(spineAngle));
    
    if (spineDeviation > 15) {
      feedback.push(`⚠️ Straighten back`);
      description += `- Slouching detected (${spineDeviation.toFixed(1)}° lean)\n`;
    } else if (spineDeviation > 8) {
      feedback.push(`💡 Stand more upright`);
      description += `- Slight forward lean (${spineDeviation.toFixed(1)}°)\n`;
    } else {
      feedback.push(`✓ Good posture`);
      description += `- Posture is straight (${spineDeviation.toFixed(1)}° deviation - good)\n`;
    }
    
    // 3. HEAD POSITION
    const headOffset = Math.abs(nose.x - shoulderCenter.x);
    
    if (headOffset > 0.12) {
      const direction = nose.x > shoulderCenter.x ? "right" : "left";
      feedback.push(`⚠️ Center head (leaning ${direction})`);
      description += `- Head off-center (${(headOffset * 100).toFixed(1)}% offset)\n`;
    } else if (headOffset > 0.07) {
      feedback.push(`💡 Center head slightly`);
      description += `- Head slightly off-center\n`;
    } else {
      feedback.push(`✓ Head centered`);
      description += `- Head centered (good)\n`;
    }
    
    // 4. CHIN HEIGHT
    const chinHeight = shoulderCenter.y - nose.y;
    
    if (chinHeight < 0.12) {
      feedback.push(`💡 Lift chin`);
      description += `- Chin lowered (could lift)\n`;
    } else if (chinHeight > 0.25) {
      feedback.push(`💡 Lower chin slightly`);
      description += `- Chin too high\n`;
    } else {
      feedback.push(`✓ Good chin height`);
      description += `- Chin height good\n`;
    }
    
    return { feedback, description };
  };

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
          
          // Get local feedback with improved algorithm
          const { feedback, description } = analyzePoseLocally(results.landmarks[0]);
          setLocalFeedback(feedback);
          currentPoseData.current = description;
          
        } else {
          setLocalFeedback(["No person detected"]);
          currentPoseData.current = "";
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Get AI coaching (manual button press)
  const getAiCoaching = async () => {
    if (!currentPoseData.current) {
      setCurrentAdvice("I can't see you - step into the frame first");
      speakAdvice("I can't see you - step into the frame first");
      return;
    }
    
    setIsGettingAdvice(true);
    setCurrentAdvice("Analyzing your pose...");
    
    try {
      console.log("📊 Sending pose data:\n", currentPoseData.current);
      const advice = await analyzePoseData(currentPoseData.current);
      
      console.log("💬 AI Coach:", advice);
      setCurrentAdvice(advice);
      speakAdvice(advice);
      
    } catch (err) {
      console.error("Error:", err);
      setCurrentAdvice("Oops, something went wrong. Try again in a moment");
    } finally {
      setIsGettingAdvice(false);
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
      if (speechSynthesis) speechSynthesis.cancel();
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
        onClick={() => {
          setVoiceEnabled(!voiceEnabled);
          if (voiceEnabled && speechSynthesis) speechSynthesis.cancel();
        }}
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
        border: '3px solid #00ff88',
        boxShadow: '0 0 30px rgba(0,255,136,0.3)'
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
        
        {/* AI Coach Button */}
        <button
          onClick={getAiCoaching}
          disabled={isGettingAdvice}
          style={{
            position: 'absolute',
            bottom: 15,
            left: '50%',
            transform: 'translateX(-50%)',
            background: isGettingAdvice ? '#666' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            padding: '14px 30px',
            borderRadius: '25px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: isGettingAdvice ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
            zIndex: 10,
            opacity: isGettingAdvice ? 0.6 : 1
          }}
        >
          {isGettingAdvice ? '⏳ Analyzing...' : '🎙️ Get AI Advice'}
        </button>
      </div>
      
      {/* Real-time Local Feedback */}
      <div style={{
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
          📊 REAL-TIME FEEDBACK
        </p>
        {localFeedback.map((feedback, i) => (
          <p key={i} style={{
            margin: '5px 0',
            fontSize: '0.85rem',
            color: feedback.includes('✓') ? '#0f0' : '#fff',
            lineHeight: '1.4'
          }}>
            {feedback}
          </p>
        ))}
      </div>
      
      {/* AI Coaching Display */}
      <div style={{
        width: '85%',
        maxWidth: '500px',
        background: 'rgba(20,20,20,0.95)',
        padding: '20px 25px',
        borderRadius: '20px',
        border: '2px solid rgba(0,255,136,0.4)',
        backdropFilter: 'blur(10px)',
        textAlign: 'center',
        boxShadow: '0 0 20px rgba(0,255,136,0.2)'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.7rem',
          color: '#00ff88',
          fontWeight: 'bold',
          letterSpacing: '2px',
          marginBottom: '12px'
        }}>
          🎙️ AI VOICE COACH
        </p>
        <p style={{
          margin: 0,
          fontSize: '1.05rem',
          color: '#fff',
          lineHeight: '1.6',
          fontStyle: 'italic'
        }}>
          "{currentAdvice}"
        </p>
      </div>
      
      <p style={{
        color: '#333',
        fontSize: '0.6rem',
        letterSpacing: '2px'
      }}>
        APERTURE AI • VOICE COACH
      </p>
    </main>
  );
}
