"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { analyzeFrame } from './actions';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [advice, setAdvice] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [debugInfo, setDebugInfo] = useState("Waiting for first frame...");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  
  const [consecutiveHumanFrames, setConsecutiveHumanFrames] = useState(0);
  const [lastObjectDetected, setLastObjectDetected] = useState<string | null>(null);
  
  const [testMode, setTestMode] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  
  // NEW: Rate limiting and caching
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [sameResponseCount, setSameResponseCount] = useState(0);

  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus("Camera Ready");
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setStatus("Camera Error");
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

    const interval = setInterval(async () => {
      // Check if we're rate limited
      if (isRateLimited && retryAfter > 0) {
        setStatus(`Rate limited (${retryAfter}s)`);
        setRetryAfter(prev => Math.max(0, prev - 1));
        if (retryAfter <= 1) {
          setIsRateLimited(false);
        }
        return;
      }

      if (videoRef.current && videoRef.current.readyState >= 2) {
        try {
          console.time('⏱️ Analysis Time');
          setStatus("Analyzing...");
          
          const canvas = canvasRef.current!;
          const context = canvas.getContext('2d');
          canvas.width = 640;
          canvas.height = 480;
          context?.drawImage(videoRef.current, 0, 0, 640, 480);
          
          const imageData = canvas.toDataURL('image/jpeg', 0.3);
          
          if (testMode) {
            setTestImage(imageData);
          }
          
          const aiResponse = await analyzeFrame(imageData);
          console.timeEnd('⏱️ Analysis Time');
          
          // Handle rate limit error
          if (aiResponse.includes("429") || aiResponse.includes("quota") || aiResponse.includes("Too Many Requests")) {
            console.warn("🚨 Rate limit hit - pausing for 16 seconds");
            setIsRateLimited(true);
            setRetryAfter(16);
            setStatus("Rate limited");
            setDebugInfo("⏸️ Rate limit hit - pausing...");
            return;
          }
          
          console.log("📸 AI Response:", aiResponse);
          
          // Check if response is the same as last time
          if (aiResponse === lastResponse) {
            setSameResponseCount(prev => prev + 1);
            
            // If we've seen the same response 3+ times, slow down
            if (sameResponseCount >= 2) {
              setDebugInfo(`${aiResponse} (scene stable, slowing down...)`);
              // Skip next 2 cycles to save quota
              return;
            }
          } else {
            setSameResponseCount(0);
            setLastResponse(aiResponse);
          }
          
          setDebugInfo(aiResponse);
          
          if (aiResponse.startsWith("HUMAN:")) {
            const tip = aiResponse.replace("HUMAN:", "").trim();
            
            setConsecutiveHumanFrames(prev => prev + 1);
            
            if (consecutiveHumanFrames >= 1) {
              setStatus("Human Detected!");
              setAdvice(tip);
              setShowToast(true);
              setTimeout(() => {
                setShowToast(false);
                setStatus("Ready for Pose...");
              }, 5000);
            } else {
              setStatus("Confirming human...");
            }
            
            setLastObjectDetected(null);
            
          } else if (aiResponse.startsWith("OBJECT:")) {
            const objectName = aiResponse.replace("OBJECT:", "").trim();
            
            setConsecutiveHumanFrames(0);
            
            if (lastObjectDetected !== objectName) {
              setStatus(`Detected: ${objectName}`);
              setLastObjectDetected(objectName);
            }
            
            setShowToast(false);
            
          } else if (aiResponse.startsWith("EMPTY")) {
            setConsecutiveHumanFrames(0);
            setStatus("Ready for Pose...");
            setShowToast(false);
            setLastObjectDetected(null);
            
          } else if (aiResponse.startsWith("ERROR:")) {
            setConsecutiveHumanFrames(0);
            setStatus("AI Error");
            // Don't spam errors, just show once
            
          } else {
            setConsecutiveHumanFrames(0);
            setStatus("Ready for Pose...");
            setShowToast(false);
          }
        } catch (err) {
          console.error("Loop Error:", err);
          setStatus("AI Error");
          setDebugInfo("Error: " + (err as Error).message);
          setConsecutiveHumanFrames(0);
        }
      }
    }, 12000); // INCREASED: 12 seconds = 5 requests/min (free tier limit)

    return () => clearInterval(interval);
  }, [startCamera, consecutiveHumanFrames, lastObjectDetected, testMode, isRateLimited, retryAfter, lastResponse, sameResponseCount]);

  return (
    <main style={{ 
      background: '#000', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '20px 0'
    }}>
      
      {/* TOP SECTION: Status + Notification */}
      <div style={{ width: '100%', position: 'relative', flex: '0 0 auto' }}>
        {/* STATUS INDICATOR */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          right: 15, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          zIndex: 50
        }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: status === "Human Detected!" ? '#0f0' : 
                       (status.includes("Error") || isRateLimited ? '#ff6b00' : '#666'),
            transition: 'background 0.3s'
          }} />
          <span style={{ color: '#fff', fontSize: '0.7rem', opacity: 0.6 }}>{status}</span>
        </div>

        {/* TEST MODE TOGGLE */}
        <button 
          onClick={() => setTestMode(!testMode)}
          style={{
            position: 'absolute',
            top: 0,
            left: 15,
            background: testMode ? '#0070f3' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.65rem',
            cursor: 'pointer',
            zIndex: 50,
            fontWeight: 'bold'
          }}
        >
          {testMode ? '👁️ TEST ON' : '👁️ TEST'}
        </button>

        {/* COACHING NOTIFICATION */}
        {showToast && advice && (
          <div style={{
            margin: '0 auto',
            marginTop: '10px',
            width: '90%', 
            maxWidth: '380px', 
            background: '#fff', 
            padding: '18px',
            borderRadius: '20px', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)', 
            borderLeft: '6px solid #0070f3'
          }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 'bold', color: '#0070f3' }}>POSE COACH</p>
            <p style={{ margin: '5px 0 0', fontSize: '0.95rem', color: '#000', lineHeight: '1.3' }}>{advice}</p>
          </div>
        )}
      </div>

      {/* MIDDLE SECTION: Camera Viewfinder */}
      <div style={{ 
        width: '85%', 
        maxWidth: '360px', 
        aspectRatio: '3/4', 
        position: 'relative', 
        borderRadius: '40px', 
        overflow: 'hidden', 
        border: '2px solid #222',
        flex: '0 0 auto'
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
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* TEST MODE: Show what AI sees */}
        {testMode && testImage && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            width: '120px',
            height: '90px',
            border: '2px solid #0070f3',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 20
          }}>
            <img src={testImage} alt="AI View" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <p style={{ 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              right: 0, 
              margin: 0, 
              background: 'rgba(0,112,243,0.9)', 
              color: '#fff', 
              fontSize: '0.5rem', 
              textAlign: 'center', 
              padding: '2px',
              fontWeight: 'bold'
            }}>AI VIEW</p>
          </div>
        )}
        
        {/* FLIP BUTTON */}
        <button 
          onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")}
          style={{
            position: 'absolute', 
            bottom: 20, 
            right: 20, 
            width: '50px', 
            height: '50px',
            background: 'rgba(255,255,255,0.2)', 
            border: 'none', 
            borderRadius: '50%',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            backdropFilter: 'blur(10px)',
            cursor: 'pointer', 
            zIndex: 10
          }}
        >
          <span style={{ fontSize: '24px' }}>🔄</span>
        </button>

        {/* GRID */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '33%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '66%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '33%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '66%', height: '100%', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      {/* BOTTOM SECTION: Debug Panel */}
      <div style={{ 
        width: '90%', 
        maxWidth: '380px',
        background: 'rgba(20,20,20,0.95)',
        padding: '15px 20px',
        borderRadius: '20px',
        border: isRateLimited ? '1px solid rgba(255,107,0,0.5)' : '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        height: '80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: '0 0 auto'
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: '0.65rem', 
          color: isRateLimited ? '#ff6b00' : '#888', 
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          🤖 AI VISION DEBUG {consecutiveHumanFrames > 0 && `(${consecutiveHumanFrames}/2)`}
        </p>
        <p style={{ 
          margin: '8px 0 0', 
          fontSize: '0.8rem', 
          color: '#fff', 
          lineHeight: '1.3',
          wordBreak: 'break-word',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {debugInfo}
        </p>
      </div>

      {/* BRANDING */}
      <p style={{ 
        color: '#333', 
        fontSize: '0.6rem', 
        letterSpacing: '2px',
        margin: '10px 0 0'
      }}>
        APERTURE AI
      </p>
    </main>
  );
}
