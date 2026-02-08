"use client";
import { useState, useRef, useEffect } from 'react';
import { uploadPhoto } from './actions';

export default function SimpleCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);

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
    ctx.drawImage(video, 0, 0);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    
    setUploading(true);
    try {
      const photoUrl = await uploadPhoto(base64Image);
      setPhotos([...photos, photoUrl]);
      alert('Photo uploaded!');
    } catch (error) {
      alert('Upload failed: ' + error);
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
      justifyContent: 'center',
      padding: '20px',
      color: '#fff'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Simple Camera</h1>
      
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
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline
        muted
        style={{ 
          width: '100%', 
          maxWidth: '500px',
          borderRadius: '20px',
          border: '2px solid #00ff88',
          display: cameraStarted ? 'block' : 'none'
        }} 
      />
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
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
            marginTop: '20px'
          }}
        >
          {uploading ? 'Uploading...' : '📸 Take Photo'}
        </button>
      )}
      
      <div style={{ 
        marginTop: '20px',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {photos.map((url, i) => (
          <img 
            key={i} 
            src={url} 
            alt={`Photo ${i}`} 
            style={{ 
              width: '150px', 
              height: '150px',
              objectFit: 'cover',
              borderRadius: '10px',
              border: '2px solid #00ff88'
            }} 
          />
        ))}
      </div>
    </main>
  );
}
