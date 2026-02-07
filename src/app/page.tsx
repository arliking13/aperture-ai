"use client";
import React, { useRef, useState, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Loading...");
  const [feedback, setFeedback] = useState<string[]>(["Stand in frame to begin"]);
  const [poseScore, setPoseScore] = useState<number>(0);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  
  // Auto-learning baseline (averages your poses over first 3 seconds)
  const poseHistory = useRef<any[]>([]);
  const isLearning = useRef(true);

  useEffect(() => {
    const init = async () => {
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
      } catch (err) {
        console.error("Error:", err);
        setStatus("Failed");
      }
    };
    
    init();
  }, []);

  // Calculate angle between 3 points
  const getAngle = (a: any, b: any, c: any): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  // Smart pose analysis - works for everyone automatically
  const analyzePose = (landmarks: any[]) => {
    const nose = landmarks[0];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    
    if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return { feedback: ["Step into frame"], score: 0 };
    }
    
    const newFeedback: string[] = [];
    let score = 100;
    
    // Calculate key points
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };
    
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    
    // 1. SHOULDER TILT (most accurate check)
    const shoulderAngle = Math.atan2(
      rightShoulder.y - leftShoulder.y,
      rightShoulder.x - leftShoulder.x
    ) * 180 / Math.PI;
    
    const shoulderTilt = Math.abs(shoulderAngle);
    
    if (shoulderTilt > 8) {
      score -= 25;
      newFeedback.push(`⚠️ Level shoulders (${shoulderTilt.toFixed(0)}° tilt)`);
    } else if (shoulderTilt > 4) {
      score -= 10;
      newFeedback.push(`💡 Slight shoulder tilt`);
    } else {
      newFeedback.push(`✓ Shoulders level`);
    }
    
    // 2. SPINE ALIGNMENT (body vertical line)
    const spineAngle = Math.atan2(
      hipCenter.y - shoulderCenter.y,
      hipCenter.x - shoulderCenter.x
    ) * 180 / Math.PI;
    
    // Spine should be close to 90° (vertical)
    const spineDeviation = Math.abs(90 - Math.abs(spineAngle));
    
    if (spineDeviation > 15) {
      score -= 30;
      newFeedback.push(`⚠️ Straighten back (leaning ${spineDeviation.toFixed(0)}°)`);
    } else if (spineDeviation > 8) {
      score -= 15;
      newFeedback.push(`💡 Stand more upright`);
    } else {
      newFeedback.push(`✓ Good posture`);
    }
    
    // 3. HEAD POSITION (should be above shoulder center)
    const headOffsetX = Math.abs(nose.x - shoulderCenter.x);
    
    if (headOffsetX > 0.12) {
      score -= 20;
      const direction = nose.x > shoulderCenter.x ? "right" : "left";
      newFeedback.push(`⚠️ Center head (leaning ${direction})`);
    } else if (headOffsetX > 0.07) {
      score -= 10;
      newFeedback.push(`💡 Center head slightly`);
    } else {
      newFeedback.push(`✓ Head centered`);
    }
    
    // 4. NECK ANGLE (chin position)
    const neckAngle = getAngle(
      { x: shoulderCenter.x, y: shoulderCenter.y + 0.1 },
      shoulderCenter,
      nose
    );
    
    // Ideal neck angle: 160-180° (looking forward)
    if (neckAngle < 140) {
      score -= 15;
      newFeedback.push(`💡 Lift chin up`);
    } else if (neckAngle > 190) {
      score -= 10;
      newFeedback.push(`💡 Lower chin slightly`);
    } else {
      newFeedback.push(`✓ Chin height good`);
    }
    
    // 5. BODY SYMMETRY (are you facing camera?)
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const hipWidth = Math.abs(rightHip.x - leftHip.x);
    const symmetryRatio = shoulderWidth / hipWidth;
    
    if (symmetryRatio < 0.7 || symmetryRatio > 1.4) {
      score -= 15;
      newFeedback.push(`💡 Face the camera more directly`);
    } else {
      newFeedback.push(`✓ Good body alignment`);
    }
    
    // Cap score
    score = Math.max(0, Math.min(100, score));
    
    return { feedback: newFeedback, score };
  };

  // Detection loop
  const detectPose = () => {
    if (!poseLandmarker || !videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
      return;
    }
    
    const results = poseLandmarker.detectForVideo(videoRef.current, performance.now());
    
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.landmarks && results.landmarks[0]) {
          const drawingUtils = new DrawingUtils(ctx);
          
          // Analyze pose first to get score
          const { feedback: newFeedback, score } = analyzePose(results.landmarks[0]);
          
          // Color skeleton based on score
          const color = score >= 90 ? '#00ff00' : score >= 70 ? '#ffff00' : '#ff6600';
          
          drawingUtils.drawLandmarks(results.landmarks[0], {
            radius: 6,
            color: color,
            fillColor: '#ffffff'
          });
          
          drawingUtils.drawConnectors(
            results.landmarks[0],
            PoseLandmarker.POSE_CONNECTIONS,
            { color: color, lineWidth: 4 }
          );
          
          setFeedback(newFeedback);
          setPoseScore(score);
        } else {
          setFeedback(["No person detected"]);
          setPoseScore(0);
        }
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPose);
  };

  // Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: 1280, height: 720 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => detectPose();
        }
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera Error");
      }
    };
    
    startCamera();
    
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [facingMode, poseLandmarker]);

  // Score color
  const getScoreColor = () => {
    if (poseScore >= 90) return '#00ff00';
    if (poseScore >= 75) return '#7fff00';
    if (poseScore >= 60) return '#ffff00';
    if (poseScore >= 40) return '#ff9900';
    return '#ff3300';
  };

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
        background: 'rgba(0,0,0,0.8)',
        padding: '10px 18px',
        borderRadius: '20px',
        color: '#fff',
        fontSize: '0.8rem',
        zIndex: 50,
        fontWeight: 'bold'
      }}>
        {status}
      </div>
      
      {/* Pose Score */}
      <div style={{
        position: 'fixed',
        top: 15,
        left: 15,
        background: 'rgba(0,0,0,0.8)',
        padding: '15px 25px',
        borderRadius: '20px',
        zIndex: 50,
        border: `3px solid ${getScoreColor()}`,
        textAlign: 'center'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.7rem',
          color: '#888',
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          POSE SCORE
        </p>
        <p style={{
          margin: '5px 0 0',
          fontSize: '2rem',
          color: getScoreColor(),
          fontWeight: 'bold',
          lineHeight: 1
        }}>
          {poseScore}
        </p>
      </div>
      
      {/* Camera */}
      <div style={{
        position: 'relative',
        width: '85%',
        maxWidth: '500px',
        aspectRatio: '3/4',
        borderRadius: '30px',
        overflow: 'hidden',
        border: `3px solid ${getScoreColor()}`,
        boxShadow: `0 0 30px ${getScoreColor()}40`
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
        
        {/* Flip */}
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
            cursor: 'pointer',
            fontSize: '24px',
            zIndex: 10,
            backdropFilter: 'blur(10px)'
          }}
        >
          🔄
        </button>
      </div>
      
      {/* Feedback */}
      <div style={{
        width: '85%',
        maxWidth: '500px',
        background: 'rgba(20,20,20,0.95)',
        padding: '20px',
        borderRadius: '20px',
        border: `2px solid ${getScoreColor()}40`,
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{
          margin: 0,
          fontSize: '0.7rem',
          color: getScoreColor(),
          fontWeight: 'bold',
          letterSpacing: '2px',
          marginBottom: '12px'
        }}>
          📊 REAL-TIME FEEDBACK
        </p>
        
        {poseScore >= 90 && (
          <p style={{
            margin: '0 0 10px 0',
            fontSize: '1.2rem',
            color: '#ffd700',
            fontWeight: 'bold'
          }}>
            🌟 PERFECT POSE!
          </p>
        )}
        
        {feedback.map((item, i) => (
          <p key={i} style={{
            margin: '6px 0',
            fontSize: '0.9rem',
            color: item.includes('✓') ? '#0f0' : '#fff',
            lineHeight: '1.5'
          }}>
            {item}
          </p>
        ))}
      </div>
      
      <p style={{ color: '#333', fontSize: '0.6rem', letterSpacing: '2px' }}>
        APERTURE AI • SMART COACH
      </p>
    </main>
  );
}
