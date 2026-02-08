import { useState, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function usePoseDetection() {
  const [landmarker, setLandmarker] = useState<PoseLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const createLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        const newLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "CPU" // <--- CHANGED FROM "GPU" TO "CPU" (Fixes iPhone Crash)
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        setLandmarker(newLandmarker);
        setIsLoading(false);
      } catch (error) {
        console.error("AI Load Failed:", error);
      }
    };

    createLandmarker();
  }, []);

  return { landmarker, isLoading };
}