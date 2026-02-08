"use client";
import { useState, useCallback } from 'react';
import CameraInterface from './components/CameraInterface';

// Define a simple Photo type
interface Photo {
  id: string;
  url: string;
  timestamp: number;
}

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- CAPTURE HANDLER ---
  const handleCapture = useCallback((base64Image: string) => {
    setIsProcessing(true);

    // Create a unique ID for this photo
    const newPhoto: Photo = {
      id: crypto.randomUUID(), // or Date.now().toString()
      url: base64Image,
      timestamp: Date.now(),
    };

    // 1. Add to Gallery
    setPhotos(prev => [newPhoto, ...prev]);

    // Simulate save delay (optional)
    setTimeout(() => setIsProcessing(false), 500);

    // 2. SCHEDULE DELETION (5 Minutes = 300,000 ms)
    setTimeout(() => {
      setPhotos((currentPhotos) => 
        currentPhotos.filter((p) => p.id !== newPhoto.id)
      );
      console.log("Photo auto-deleted due to timeout");
    }, 5 * 60 * 1000); 

  }, []);

  return (
    <main style={{ 
      minHeight: '100vh', 
      background: '#111', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '20px' 
    }}>
      
      {/* HEADER */}
      <h1 style={{ color: '#fff', marginBottom: '20px', fontFamily: 'sans-serif' }}>
        APERTURE AI
      </h1>

      {/* CAMERA MODULE */}
      <CameraInterface 
        onCapture={handleCapture} 
        isProcessing={isProcessing} 
      />

      {/* GALLERY (Visual Proof) */}
      {photos.length > 0 && (
        <div style={{ marginTop: '40px', width: '100%', maxWidth: '600px' }}>
          <h3 style={{ color: '#666', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>
            SESSION GALLERY (Auto-clear in 5m)
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
            gap: '10px' 
          }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ position: 'relative', aspectRatio: '9/16' }}>
                <img 
                  src={photo.url} 
                  alt="Capture" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333' }} 
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}