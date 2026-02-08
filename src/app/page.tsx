"use client";
import { useState, useEffect } from 'react';
import { uploadPhoto, getCloudImages } from './actions';
import CameraInterface from './components/CameraInterface';
import { X, Download } from 'lucide-react'; // Make sure you have lucide-react installed

export default function Home() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // NEW: State for the fullscreen modal
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

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

  const handleCapture = async (base64Image: string) => {
    setUploading(true);
    try {
      setPhotos(prev => [base64Image, ...prev]);
      const url = await uploadPhoto(base64Image);
      if (url && url.startsWith('http')) {
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

      {/* --- GALLERY SECTION --- */}
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
              <div 
                key={i} 
                onClick={() => setSelectedPhoto(url)} // Open Modal on Click
                style={{ cursor: 'pointer', position: 'relative', aspectRatio: '1/1' }}
              >
                <img 
                  src={url} 
                  alt={`Photo ${i}`} 
                  style={{ 
                    width: '100%', height: '100%', objectFit: 'cover',
                    borderRadius: '10px', border: '1px solid #333',
                    transition: 'transform 0.1s',
                  }} 
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- FULLSCREEN MODAL (THE FIX) --- */}
      {selectedPhoto && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* Close Button */}
          <button 
            onClick={() => setSelectedPhoto(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: 'pointer'
            }}
          >
            <X size={24} />
          </button>

          {/* Image */}
          <img 
            src={selectedPhoto} 
            alt="Full view"
            style={{
              maxWidth: '90vw', maxHeight: '80vh',
              borderRadius: '8px', boxShadow: '0 0 50px rgba(0,0,0,0.8)'
            }} 
          />

          {/* Download Button */}
          <a 
            href={selectedPhoto} 
            download={`aperture-photo-${Date.now()}.jpg`}
            style={{
              position: 'absolute', bottom: 30,
              background: '#00ff88', color: '#000',
              padding: '12px 24px', borderRadius: '30px',
              textDecoration: 'none', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 0 20px rgba(0,255,136,0.3)'
            }}
          >
            <Download size={18} />
            Save Photo
          </a>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </main>
  );
}