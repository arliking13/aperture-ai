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
  const [poseScore, setPoseScore] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const currentPoseData = useRef<string>("");
  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#00ff00'; // Perfect - Green
    if (score >= 75) return '#7fff00'; // Great - Yellow-green
    if (score >= 60) return '#ffff00'; // Good - Yellow
    if (score >= 40) return '#ff9900'; // Needs work - Orange
    return '#ff3300'; // Poor - Red
  };

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

  // FIXED: More accurate and forgiving pose analysis
  const analyzePoseLocally = (landmarks: any[]) => {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return { feedback: [], description: "", score: 0 };
    }
    
    const feedback: string[] = [];
    let description = "CURRENT POSE:\n";
    let score = 100;
    
    // Calculate centers
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    
    // 1. SHOULDER TILT (FIXED: Better calculation)
    // Use actual Y difference normalized by shoulder width for camera angle independence
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const shoulderTiltRatio = shoulderHeightDiff / shoulderWidth;
    
    // Convert to degrees for display (approximate)
    const shoulderTiltDegrees = Math.atan(shoulderTiltRatio) * 180 / Math.PI;
    
    if (shoulderTiltRatio > 0.15) { // Very tilted (>8.5°)
      score -= 20;
      const higherSide = leftShoulder.y < rightShoulder.y ? "left" : "right";
      feedback.push(`⚠️ Shoulders tilted ${shoulderTiltDegrees.toFixed(1)}° (${higherSide} higher)`);
      description += `- Shoulders uneven (${shoulderTiltDegrees.toFixed(1)}° tilt, ${higherSide} higher)\n`;
    } else if (shoulderTiltRatio > 0.08) { // Slightly tilted (>4.5°)
      score -= 8;
      feedback.push(`💡 Slight shoulder tilt (${shoulderTiltDegrees.toFixed(1)}°)`);
      description += `- Slight shoulder tilt (${shoulderTiltDegrees.toFixed(1)}°)\n`;
    } else {
      feedback.push(`✓ Shoulders level (${shoulderTiltDegrees.toFixed(1)}°)`);
      description += `- Shoulders level (${shoulderTiltDegrees.toFixed(1)}° - excellent)\n`;
    }
    
    // 2. SPINE ALIGNMENT (FIXED: More forgiving)
    const spineAngle = Math.atan2(
      hipCenter.y - shoulderCenter.y,
      hipCenter.x - shoulderCenter.x
    ) * 180 / Math.PI;
    
    const spineDeviation = Math.abs(90 - Math.abs(spineAngle));
    
    if (spineDeviation > 20) { // Very bad posture
      score -= 25;
      feedback.push(`⚠️ Back leaning ${spineDeviation.toFixed(1)}°`);
      description += `- Slouching detected (${spineDeviation.toFixed(1)}° lean)\n`;
    } else if (spineDeviation > 12) { // Noticeable lean
      score -= 12;
      feedback.push(`💡 Stand more upright (${spineDeviation.toFixed(1)}° lean)`);
      description += `- Slight forward lean (${spineDeviation.toFixed(1)}°)\n`;
    } else {
      feedback.push(`✓ Good posture (${spineDeviation.toFixed(1)}° deviation)`);
      description += `- Posture is straight (${spineDeviation.toFixed(1)}° deviation - good)\n`;
    }
    
    // 3. HEAD POSITION (More forgiving)
    const headOffsetX = Math.abs(nose.x - shoulderCenter.x);
    
    if (headOffsetX > 0.15) { // Very off-center
      score -= 15;
      const direction = nose.x > shoulderCenter.x ? "right" : "left";
      feedback.push(`⚠️ Head leaning ${direction}`);
      description += `- Head off-center (${(headOffsetX * 100).toFixed(1)}% offset to ${direction})\n`;
    } else if (headOffsetX > 0.09) { // Slightly off
      score -= 7;
      feedback.push(`💡 Center head slightly`);
      description += `- Head slightly off-center\n`;
    } else {
      feedback.push(`✓ Head centered`);
      description += `- Head centered (good)\n`;
    }
    
    // 4. CHIN HEIGHT (More forgiving)
    const chinHeight = shoulderCenter.y - nose.y;
    
    if (chinHeight < 0.10) { // Very low
      score -= 12;
      feedback.push(`💡 Lift chin up`);
      description += `- Chin lowered (could lift)\n`;
    } else if (chinHeight > 0.30) { // Very high
      score -= 8;
      feedback.push(`💡 Lower chin slightly`);
      description += `- Chin too high\n`;
    } else {
      feedback.push(`✓ Chin height good`);
      description += `- Chin height good\n`;
    }
    
    // Cap score
    score = Math.max(0, Math.min(100, score));
    
    return { feedback, description, score };
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
          // Get feedback and score first
          const { feedback, description, score } = analyzePoseLocally(results.landmarks[0]);
          
          // Color based on score
          const color = getScoreColor(score);
          
          const drawingUtils = new DrawingUtils(ctx);
          
          drawingUtils.drawLandmarks(results.landmarks[0], {
            radius: 5,
            color: color,
            fillColor: '#fff'
          });
          
          drawingUtils.drawConnectors(
            results.landmarks[0],
            PoseLandmarker.POSE_CONNECTIONS,
            { color: color, lineWidth: 3 }
          );
          
          setLocalFeedback(feedback);
          currentPoseData.current = description;
          setPoseScore(score);
          
        } else {
          setLocalFeedback(["No person detected"]);
          currentPoseData.current = "";
          setPoseScore(0);
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
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {isSpeaking && <span style={{ fontSize: '16px' }}>🔊</span>}
        {status}
      </div>
      
      {/* Pose Score */}
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
        <p style={{
          margin: 0,
          fontSize: '0.65rem',
          color: '#888',
          fontWeight: 'bold',
          letterSpacing: '1.5px'
        }}>
          POSE SCORE
        </p>
        <p style={{
          margin: '5px 0 0',
          fontSize: '2rem',
          color: currentColor,
          fontWeight: 'bold',
          lineHeight: 1
        }}>
          {poseScore}
        </p>
      </div>
      
      {/* Voice Toggle */}
      <button
        onClick={() => {
          setVoiceEnabled(!voiceEnabled);
          if (voiceEnabled && speechSynthesis) speechSynthesis.cancel();
        }}
        style={{
          position: 'fixed',
          top: 80,
          left: 15,
          background: voiceEnabled ? '#0070f3' : 'rgba(255,255,255,0.1)',
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
        {voiceEnabled ? '🔊 Voice' : '🔇 Mute'}
      </button>
      
      {/* Camera View */}
      <div style={{
        position: 'relative',
        width: '85%',
        maxWidth: '500px',
        aspectRatio: '3/4',
        borderRadius: '30px',
        overflow: 'hidden',
        border: `3px solid ${currentColor}`,
        boxShadow: `0 0 30px ${currentColor}50`,
        transition: 'border-color 0.3s, box-shadow 0.3s'
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
        
        {/* Perfect Pose Indicator */}
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
        border: `1px solid ${currentColor}40`,
        backdropFilter: 'blur(10px)',
        transition: 'border-color 0.3s'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.65rem',
          color: currentColor,
          fontWeight: 'bold',
          letterSpacing: '1px',
          marginBottom: '10px',
          transition: 'color 0.3s'
        }}>
          📊 REAL-TIME FEEDBACK
        </p>
        
        {poseScore >= 90 && (
          <p style={{
            margin: '0 0 10px 0',
            fontSize: '1.1rem',
            color: '#ffd700',
            fontWeight: 'bold'
          }}>
            🌟 PERFECT POSE!
          </p>
        )}
        
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
      
      {/* CSS Animation for pulse */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </main>
  );
}
