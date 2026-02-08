"use client";
import React, { useRef, useState, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { analyzePoseData } from './actions';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Loading AI...");
  const [currentAdvice, setCurrentAdvice] = useState<string>("Press the button for AI coaching");
  const [localFeedback, setLocalFeedback] = useState<string[]>([]);
  const [poseScore, setPoseScore] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);
  
  // Smart timer states
  const [autoTimerEnabled, setAutoTimerEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStill, setIsStill] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const currentPoseData = useRef<string>("");
  const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  
  // Motion detection
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrameCount = useRef<number>(0);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#00ff00';
    if (score >= 75) return '#7fff00';
    if (score >= 60) return '#ffff00';
    if (score >= 40) return '#ff9900';
    return '#ff3300';
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

  // Calculate movement between poses
  const calculateMovement = (current: any[], previous: any[]): number => {
    if (!previous || previous.length !== current.length) return 999;
    
    let totalMovement = 0;
    const keyPoints = [0, 11, 12, 23, 24]; // nose, shoulders, hips
    
    keyPoints.forEach(i => {
      if (current[i] && previous[i]) {
        const dx = current[i].x - previous[i].x;
        const dy = current[i].y - previous[i].y;
        totalMovement += Math.sqrt(dx * dx + dy * dy);
      }
    });
    
    return totalMovement / keyPoints.length;
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !captureCanvasRef.current) return;
    
    const canvas = captureCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Save with mirror effect if front camera
    if (facingMode === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    
    const photoData = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhoto(photoData);
    
    // Flash effect
    if (overlayCanvasRef.current) {
      const flashCtx = overlayCanvasRef.current.getContext('2d');
      if (flashCtx) {
        flashCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        flashCtx.fillRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        setTimeout(() => {
          if (flashCtx) flashCtx.clearRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);
        }, 100);
      }
    }
    
    // Play shutter sound
    speakAdvice("Photo captured!");
    console.log("📸 Photo captured!");
  };

  // Download photo
  const downloadPhoto = () => {
    if (!capturedPhoto) return;
    
    const link = document.createElement('a');
    link.href = capturedPhoto;
    link.download = `aperture-ai-${Date.now()}.jpg`;
    link.click();
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
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
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

  // Pose analysis
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
    
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    
    // Shoulder tilt
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const shoulderTiltRatio = shoulderHeightDiff / shoulderWidth;
    const shoulderTiltDegrees = Math.atan(shoulderTiltRatio) * 180 / Math.PI;
    
    if (shoulderTiltRatio > 0.15) {
      score -= 20;
      const higherSide = leftShoulder.y < rightShoulder.y ? "left" : "right";
      feedback.push(`⚠️ Shoulders tilted ${shoulderTiltDegrees.toFixed(1)}° (${higherSide} higher)`);
      description += `- Shoulders uneven (${shoulderTiltDegrees.toFixed(1)}° tilt)\n`;
    } else if (shoulderTiltRatio > 0.08) {
      score -= 8;
      feedback.push(`💡 Slight shoulder tilt (${shoulderTiltDegrees.toFixed(1)}°)`);
      description += `- Slight shoulder tilt\n`;
    } else {
      feedback.push(`✓ Shoulders level`);
      description += `- Shoulders level\n`;
    }
    
    // Spine alignment
    const spineAngle = Math.atan2(
      hipCenter.y - shoulderCenter.y,
      hipCenter.x - shoulderCenter.x
    ) * 180 / Math.PI;
    const spineDeviation = Math.abs(90 - Math.abs(spineAngle));
    
    if (spineDeviation > 20) {
      score -= 25;
      feedback.push(`⚠️ Back leaning ${spineDeviation.toFixed(1)}°`);
      description += `- Slouching detected\n`;
    } else if (spineDeviation > 12) {
      score -= 12;
      feedback.push(`💡 Stand more upright`);
      description += `- Slight forward lean\n`;
    } else {
      feedback.push(`✓ Good posture`);
      description += `- Posture is straight\n`;
    }
    
    // Head position
    const headOffsetX = Math.abs(nose.x - shoulderCenter.x);
    if (headOffsetX > 0.15) {
      score -= 15;
      feedback.push(`⚠️ Center head`);
      description += `- Head off-center\n`;
    } else if (headOffsetX > 0.09) {
      score -= 7;
      feedback.push(`💡 Center head slightly`);
      description += `- Head slightly off-center\n`;
    } else {
      feedback.push(`✓ Head centered`);
      description += `- Head centered\n`;
    }
    
    // Chin height
    const chinHeight = shoulderCenter.y - nose.y;
    if (chinHeight < 0.10) {
      score -= 12;
      feedback.push(`💡 Lift chin up`);
      description += `- Chin lowered\n`;
    } else if (chinHeight > 0.30) {
      score -= 8;
      feedback.push(`💡 Lower chin slightly`);
      description += `- Chin too high\n`;
    } else {
      feedback.push(`✓ Chin height good`);
      description += `- Chin height good\n`;
    }
    
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
          const { feedback, description, score } = analyzePoseLocally(results.landmarks[0]);
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
          
          // Motion detection for auto-timer
          if (autoTimerEnabled) {
            const movement = previousLandmarks.current ? calculateMovement(results.landmarks[0], previousLandmarks.current) : 999;
            
            if (movement < 0.01) { // Very still
              stillFrameCount.current++;
              setIsStill(true);
              
              // Start countdown after being still for 1 second (30 frames at 30fps)
              if (stillFrameCount.current === 30 && !countdownInterval.current) {
                setCountdown(3);
                speakAdvice("Hold still, 3, 2, 1");
                
                countdownInterval.current = setInterval(() => {
                  setCountdown(prev => {
                    if (prev === null || prev <= 1) {
                      if (countdownInterval.current) {
                        clearInterval(countdownInterval.current);
                        countdownInterval.current = null;
                      }
                      capturePhoto();
                      setCountdown(null);
                      stillFrameCount.current = 0;
                      return null;
                    }
                    return prev - 1;
                  });
                }, 1000);
              }
            } else {
              // Movement detected
              if (countdownInterval.current) {
                clearInterval(countdownInterval.current);
                countdownInterval.current = null;
              }
              stillFrameCount.current = 0;
              setCountdown(null);
              setIsStill(false);
            }
            
            previousLandmarks.current = results.landmarks[0];
          }
          
        } else {
          setLocalFeedback(["No person detected"]);
          currentPoseData.current = "";
          setPoseScore(0);
          previousLandmarks.current = null;
          stillFrameCount.current = 0;
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Get AI coaching
  const getAiCoaching = async () => {
    if (!currentPoseData.current) {
      setCurrentAdvice("I can't see you - step into the frame first");
      speakAdvice("I can't see you - step into the frame first");
      return;
    }
    
    setIsGettingAdvice(true);
    setCurrentAdvice("Analyzing your pose...");
    
    try {
      const advice = await analyzePoseData(currentPoseData.current);
      setCurrentAdvice(advice);
      speakAdvice(advice);
    } catch (err) {
      console.error("Error:", err);
      setCurrentAdvice("Oops, something went wrong");
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
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
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
      
      {/* Auto-Timer Toggle */}
      <button
        onClick={() => {
          setAutoTimerEnabled(!autoTimerEnabled);
          if (!autoTimerEnabled) {
            speakAdvice("Smart timer activated - hold still to capture");
          } else {
            speakAdvice("Smart timer off");
            if (countdownInterval.current) {
              clearInterval(countdownInterval.current);
              countdownInterval.current = null;
            }
            setCountdown(null);
            stillFrameCount.current = 0;
          }
        }}
        style={{
          position: 'fixed',
          top: 120,
          left: 15,
          background: autoTimerEnabled ? '#00ff88' : 'rgba(255,255,255,0.1)',
          color: autoTimerEnabled ? '#000' : '#fff',
          border: `1px solid ${autoTimerEnabled ? '#00ff88' : 'rgba(255,255,255,0.2)'}`,
          padding: '8px 15px',
          borderRadius: '20px',
          fontSize: '0.7rem',
          cursor: 'pointer',
          zIndex: 50,
          backdropFilter: 'blur(10px)',
          fontWeight: 'bold'
        }}
      >
        {autoTimerEnabled ? '⏱️ Timer ON' : '⏱️ Timer OFF'}
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
        
        <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
        
        {/* Countdown Display */}
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
            animation: 'countdownPulse 1s infinite',
            pointerEvents: 'none'
          }}>
            {countdown}
          </div>
        )}
        
        {/* Still Indicator */}
        {autoTimerEnabled && isStill && countdown === null && (
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
            fontWeight: 'bold',
            zIndex: 20
          }}>
            ⏱️ Hold Still...
          </div>
        )}
        
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
      
      {/* Photo Preview Modal */}
      {capturedPhoto && (
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
          <img 
            src={capturedPhoto} 
            alt="Captured" 
            style={{
              maxWidth: '90%',
              maxHeight: '70vh',
              borderRadius: '20px',
              boxShadow: '0 10px 50px rgba(0,255,136,0.3)'
            }}
          />
          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={downloadPhoto}
              style={{
                background: '#00ff88',
                color: '#000',
                border: 'none',
                padding: '15px 35px',
                borderRadius: '25px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              💾 Download
            </button>
            <button
              onClick={() => setCapturedPhoto(null)}
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
        APERTURE AI • SMART TIMER
      </p>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes countdownPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </main>
  );
}
