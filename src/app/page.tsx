"use client";
import { useState, useRef, useEffect } from 'react';
import { uploadPhoto, analyzeImage, getCloudImages } from './actions';

export default function SimpleCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [advice, setAdvice] = useState<string>("");

  // Load the public gallery when the app starts
  useEffect(() => {
    const loadGallery = async () => {
      const cloudPhotos = await getCloudImages();
      setPhotos(cloudPhotos);
    };
    loadGallery();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: 1280, height: 720 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStarted(true);
      }
    } catch (err) {
      alert('Camera error: ' + err);
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // Draw image flipped for mirror effect if using front camera, 
    // but for simplicity here we just draw it normally
    ctx.drawImage(video, 0, 0);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    
    setUploading(true);
    setAdvice("Analyzing..."); // Show loading state for AI

    try {
      // 1. Upload to Cloudinary
      const photoUrl = await uploadPhoto(base64Image);
      
      // Update gallery immediately with new photo
      setPhotos(prev => [photoUrl, ...prev]);
      
      // 2. Ask Gemini for advice
      const aiAdvice = await analyzeImage(photoUrl);
      setAdvice(aiAdvice);

    } catch (error) {
      alert('Upload failed: ' + error);
      setAdvice("");
    }
    setUploading(false);
  };

  return (
    <main style={{
      background: '#000',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ marginBottom: '20px', color: '#00ff88', letterSpacing: '2px' }}>Aperture AI</h1>
      
      {!cameraStarted && (
        <button 
          onClick={startCamera}
          style={{
            background: '#00ff88',
            color: '#000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          Start Camera
        </button>
      )}
      
      <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline
          muted
          style={{ 
            width: '100%', 
            borderRadius: '20px',
            border: '2px solid #00ff88',
            display: cameraStarted ? 'block' : 'none',
            background: '#111'
          }} 
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {cameraStarted && (
        <button 
          onClick={takePhoto} 
          disabled={uploading}
          style={{
            background: uploading ? '#666' : '#00ff88',
            color: '#000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: uploading ? 'not-allowed' : 'pointer',
            marginTop: '20px',
            width: '100%',
            maxWidth: '500px'
          }}
        >
          {uploading ? 'Processing...' : '📸 Take Photo'}
        </button>
      )}

      {/* AI Coach Advice Box */}
      {advice && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#1a1a1a',
          border: '1px solid #00ff88',
          borderRadius: '15px',
          maxWidth: '500px',
          width: '100%'
        }}>
          <h3 style={{ color: '#00ff88', margin: '0 0 10px 0', fontSize: '1.1rem' }}>🤖 AI Coach Says:</h3>
          <p style={{ margin: 0, lineHeight: '1.5' }}>{advice}</p>
        </div>
      )}
      
      {/* Public Gallery */}
      <div style={{ marginTop: '40px', width: '100%', maxWidth: '500px' }}>
        <h3 style={{ 
          borderBottom: '1px solid #333', 
          paddingBottom: '10px',
          marginBottom: '15px',
          color: '#888',
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          Cloud Gallery (Public)
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '10px'
        }}>
          {photos.map((url, i) => (
            <a 
              key={i} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', position: 'relative' }}
            >
              <img 
                src={url} 
                alt={`Photo ${i}`} 
                style={{ 
                  width: '100%', 
                  aspectRatio: '1/1',
                  objectFit: 'cover',
                  borderRadius: '10px',
                  border: '1px solid #333',
                  transition: 'opacity 0.2s'
                }} 
              />
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}