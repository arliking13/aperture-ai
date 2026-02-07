"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { analyzeFrame } from './actions';

export default function PosingCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [advice, setAdvice] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [debugInfo, setDebugInfo] = useState("Tap 📸 to get posing advice");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  
  const [testMode, setTestMode] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  
  // NEW: Manual capture mode
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const [finalPhoto, setFinalPhoto] = useState<string | null>(null);

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
    
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // NEW: Manual analysis function
  const analyzeForPose = async () => {
    if (isAnalyzing || !videoRef.current || videoRef.current.readyState < 2) return;
    
    setIsAnalyzing(true);
    setStatus("Analyzing pose...");
    setDebugInfo("🔍 Checking your position...");
    
    try {
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
      console.log("📸 AI Response:", aiResponse);
      
      // Handle errors
      if (aiResponse.includes("429") || aiResponse.includes("quota") || aiResponse.includes("Too Many Requests")) {
        setStatus("Rate limited");
        setDebugInfo("⏸️ Too many requests - wait 15 seconds and try again");
        setIsAnalyzing(false);
        return;
      }
      
      if (aiResponse.startsWith("ERROR:")) {
        setStatus("AI Error");
        setDebugInfo(aiResponse.substring(0, 100));
        setIsAnalyzing(false);
        return;
      }
      
      setDebugInfo(aiResponse);
      
      if (aiResponse.startsWith("HUMAN:")) {
        const tip = aiResponse.replace("HUMAN:", "").trim();
        setStatus("✓ Ready to capture!");
        setAdvice(tip);
        setShowToast(true);
        
        // After 3 seconds, offer to take the photo
        setTimeout(() => {
          setShowToast(false);
          setStatus("Press 📸 again to capture");
        }, 3000);
        
      } else if (aiResponse.startsWith("OBJECT:")) {
        const objectName = aiResponse.replace("OBJECT:", "").trim();
        setStatus(`No human detected`);
        setDebugInfo(`I see: ${objectName}. Please step into frame.`);
        
      } else if (aiResponse.startsWith("EMPTY")) {
        setStatus("Frame is empty");
        setDebugInfo("Please step into the camera view");
      }
      
    } catch (err) {
      console.error("Analysis Error:", err);
      setStatus("AI Error");
      setDebugInfo("Error: " + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // NEW: Capture photo with countdown
  const capturePhoto = () => {
    if (captureCountdown !== null) return; // Already counting down
    
    // Start 3-2-1 countdown
    setCaptureCountdown(3);
    setStatus("Get ready!");
    
    const countdownInterval = setInterval(() => {
      setCaptureCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          
          // Take the photo
          if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            canvas.width = 1280;
            canvas.height = 960;
            context?.drawImage(videoRef.current, 0, 0, 1280, 960);
            
            const photo = canvas.toDataURL('image/jpeg', 0.9);
            setFinalPhoto(photo);
            setStatus("Photo captured!");
            setDebugInfo("✓ Photo saved! Tap to download or retake.");
          }
          
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // NEW: Download photo
  const downloadPhoto = () => {
    if (!finalPhoto) return;
    
    const link = document.createElement('a');
    link.download = `aperture-${Date.now()}.jpg`;
    link.href = finalPhoto;
    link.click();
  };

  // NEW: Close photo preview
  const closePhotoPreview = () => {
    setFinalPhoto(null);
    setStatus("Camera Ready");
    setDebugInfo("Tap 📸 to get posing advice");
    setAdvice(null);
  };

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
      
      {/* PHOTO PREVIEW MODAL */}
      {finalPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '20px'
        }}>
          <img 
            src={finalPhoto} 
            alt="Captured" 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '70vh', 
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
            }} 
          />
          <div style={{ display: 'flex', gap: '15px' }}>
            <button 
              onClick={downloadPhoto}
              style={{
                background: '#0070f3',
                color: '#fff',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '15px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,112,243,0.4)'
              }}
            >
              💾 Download
            </button>
            <button 
              onClick={closePhotoPreview}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '15px 30px',
                borderRadius: '15px',
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
            background: status.includes("Ready to capture") ? '#0f0' : 
                       (status.includes("Error") || status.includes("Rate limited") ? '#ff6b00' : '#666'),
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
        
        {/* COUNTDOWN OVERLAY */}
        {captureCountdown !== null && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30
          }}>
            <div style={{
              fontSize: '120px',
              color: '#fff',
              fontWeight: 'bold',
              textShadow: '0 0 40px rgba(0,112,243,0.8)',
              animation: 'pulse 0.5s ease-in-out'
            }}>
              {captureCountdown}
            </div>
          </div>
        )}
        
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
            top: 20, 
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

        {/* CAPTURE BUTTON */}
        <button 
          onClick={advice ? capturePhoto : analyzeForPose}
          disabled={isAnalyzing}
          style={{
            position: 'absolute', 
            bottom: 20, 
            left: '50%',
            transform: 'translateX(-50%)',
            width: '70px', 
            height: '70px',
            background: advice ? '#0f0' : 'rgba(255,255,255,0.9)', 
            border: advice ? '4px solid #fff' : '4px solid rgba(0,112,243,0.6)', 
            borderRadius: '50%',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            backdropFilter: 'blur(10px)',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer', 
            zIndex: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            opacity: isAnalyzing ? 0.5 : 1,
            transition: 'all 0.3s'
          }}
        >
          <span style={{ fontSize: '32px' }}>
            {isAnalyzing ? '⏳' : (advice ? '📷' : '📸')}
          </span>
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
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        minHeight: '80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: '0 0 auto'
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: '0.65rem', 
          color: '#888', 
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          🤖 AI VISION DEBUG
        </p>
        <p style={{ 
          margin: '8px 0 0', 
          fontSize: '0.8rem', 
          color: '#fff', 
          lineHeight: '1.3',
          wordBreak: 'break-word'
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
