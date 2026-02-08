"use client";
import { useState, useRef } from 'react';
import { uploadPhoto } from './actions';

export default function SimpleCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "user" } 
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx?.drawImage(video, 0, 0);
    
    // Convert to base64
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    
    // Upload via server action
    setUploading(true);
    try {
      const photoUrl = await uploadPhoto(base64Image);
      setPhotos([...photos, photoUrl]);
    } catch (error) {
      alert('Upload failed!');
    }
    setUploading(false);
  };

  return (
    <main style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Simple Camera</h1>
      
      <button onClick={startCamera}>Start Camera</button>
      
      <video ref={videoRef} autoPlay style={{ width: '100%', maxWidth: '500px' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <button onClick={takePhoto} disabled={uploading}>
        {uploading ? 'Uploading...' : '📸 Take Photo'}
      </button>
      
      <div>
        {photos.map((url, i) => (
          <img key={i} src={url} alt={`Photo ${i}`} style={{ width: '200px', margin: '10px' }} />
        ))}
      </div>
    </main>
  );
}
