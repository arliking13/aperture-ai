"use client";
import { useState, useEffect } from 'react';
import { uploadPhoto, getCloudImages } from './actions'; // We will fix these next
import CameraInterface from './components/CameraInterface';

export default function Home() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // 1. Load Gallery on Mount
  useEffect(() => {
    const loadGallery = async () => {
      try {
        const cloudPhotos = await getCloudImages();
        setPhotos(cloudPhotos);
      } catch (e) {
        console.error("Gallery Load Error:", e);
      }
    };
    loadGallery();
  }, []);

  // 2. Handle Capture (Upload + Update Gallery)
  const handleCapture = async (base64Image: string) => {
    setUploading(true);
    try {
      // Optimistic update (show immediately)
      setPhotos(prev => [base64Image, ...prev]);
      
      // Upload to cloud (if you have the backend set up)
      const url = await uploadPhoto(base64Image);
      if (url && url.startsWith('http')) {
         // Replace base64 with real URL if upload succeeds
         setPhotos(prev => [url, ...prev.slice(1)]);
      }
    } catch (error) {
      console.error('Upload Error:', error);
    }
    setUploading(false);
  };

  return (
    <main style={{
      background: '#000', minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', padding: '20px',
      color: '#fff', fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ marginBottom: '20px', color: '#00ff88', letterSpacing: '2px', fontWeight: 'bold' }}>
        APERTURE AI
      </h1>
      
      <CameraInterface 
        onCapture={handleCapture} 
        isProcessing={uploading} 
      />

      {/* --- RESTORED GALLERY SECTION --- */}
      <div style={{ marginTop: '40px', width: '100%', maxWidth: '500px' }}>
        <h3 style={{ 
          borderBottom: '1px solid #333', paddingBottom: '10px',
          marginBottom: '15px', color: '#888', fontSize: '0.9rem',
          textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between'
        }}>
          <span>Cloud Gallery</span>
          <span style={{fontSize: '0.7rem', color: '#444'}}>Auto-Delete: 5m</span>
        </h3>
        
        {photos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#444', fontStyle: 'italic', padding: '20px' }}>
            No photos yet. Take a shot!
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative', aspectRatio: '1/1' }}>
                <img 
                  src={url} 
                  alt={`Photo ${i}`} 
                  style={{ 
                    width: '100%', height: '100%', objectFit: 'cover',
                    borderRadius: '10px', border: '1px solid #333',
                    animation: 'fadeIn 0.5s ease'
                  }} 
                />
              </a>
            ))}
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}