"use client";
import { useState, useEffect } from 'react';
import { uploadPhoto, analyzeImage, getCloudImages } from './actions';
import CameraInterface from './components/CameraInterface';
// 1. Import the Debug Camera
import DebugCamera from './components/DebugCamera'; 

export default function Home() {
  // --- DEBUG SWITCH ---
  // Set this to TRUE to test the AI. Set to FALSE to see your Interface.
  const DEBUG_MODE = false; 
  // --------------------

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [advice, setAdvice] = useState<string>("");

  // If Debug Mode is ON, we return early and ONLY show the debug tool.
  // Your original interface code below is safe, just hidden.
  if (DEBUG_MODE) {
    return <DebugCamera />;
  }

  // --- YOUR ORIGINAL APP CODE STARTS HERE ---
  useEffect(() => {
    const loadGallery = async () => {
      const cloudPhotos = await getCloudImages();
      setPhotos(cloudPhotos);
    };
    loadGallery();
  }, []);

  const handleCapture = async (base64Image: string) => {
    setUploading(true);
    setAdvice("Analyzing...");

    try {
      const photoUrl = await uploadPhoto(base64Image);
      setPhotos(prev => [photoUrl, ...prev]);
      // AI Disabled for now to prevent errors
      // const aiAdvice = await analyzeImage(photoUrl);
      setAdvice("Photo captured!"); 
    } catch (error) {
      alert('Error: ' + error);
      setAdvice("");
    }
    setUploading(false);
  };

  return (
    <main style={{
      background: '#000', minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', padding: '20px',
      color: '#fff', fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ marginBottom: '20px', color: '#00ff88', letterSpacing: '2px' }}>Aperture AI</h1>
      
      <CameraInterface 
        onCapture={handleCapture} 
        isProcessing={uploading} 
      />

      {advice && (
        <div style={{
          marginTop: '20px', padding: '15px', background: '#1a1a1a',
          border: '1px solid #00ff88', borderRadius: '15px',
          maxWidth: '500px', width: '100%'
        }}>
          <h3 style={{ color: '#00ff88', margin: '0 0 10px 0', fontSize: '1.1rem' }}>🤖 AI Coach Says:</h3>
          <p style={{ margin: 0, lineHeight: '1.5' }}>{advice}</p>
        </div>
      )}
      
      <div style={{ marginTop: '40px', width: '100%', maxWidth: '500px' }}>
        <h3 style={{ 
          borderBottom: '1px solid #333', paddingBottom: '10px',
          marginBottom: '5px', color: '#888', fontSize: '0.9rem',
          textTransform: 'uppercase', letterSpacing: '1px'
        }}>
          Cloud Gallery (Public)
        </h3>
        <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '15px', fontStyle: 'italic' }}>
          ⚠️ Photos are automatically deleted after 10 minutes.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
              <img 
                src={url} 
                alt={`Photo ${i}`} 
                style={{ 
                  width: '100%', aspectRatio: '1/1', objectFit: 'cover',
                  borderRadius: '10px', border: '1px solid #333',
                }} 
              />
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}