import { useRef, useState, useCallback } from 'react';

// Math helper to calculate distance between two points
function getDistance(p1: {x: number, y: number}, p2: {x: number, y: number}) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function useStillness(threshold = 0.015, requiredFrames = 45) { // 45 frames ≈ 1.5 seconds of stillness
  const previousLandmarks = useRef<any[] | null>(null);
  const stillFrameCount = useRef(0);
  const [isStill, setIsStill] = useState(false);
  
  const checkStillness = useCallback((currentLandmarks: any[]) => {
    if (!previousLandmarks.current) {
      previousLandmarks.current = currentLandmarks;
      return false;
    }

    // Compare key points (Nose, Shoulders, Hips) to see how much they moved
    // Indices: 0=Nose, 11=Left Shoulder, 12=Right Shoulder, 23=Left Hip, 24=Right Hip
    const keyPoints = [0, 11, 12, 23, 24];
    let totalMovement = 0;

    keyPoints.forEach(index => {
      const p1 = currentLandmarks[index];
      const p2 = previousLandmarks.current![index];
      if (p1 && p2) {
        totalMovement += getDistance(p1, p2);
      }
    });

    const avgMovement = totalMovement / keyPoints.length;

    // Logic: If movement is tiny, count it as a "Still Frame"
    if (avgMovement < threshold) {
      stillFrameCount.current++;
    } else {
      // If they move, reset the counter!
      stillFrameCount.current = 0;
      if (isStill) setIsStill(false); // Only update state if changing
    }

    // Update reference for next frame
    previousLandmarks.current = currentLandmarks;

    // If we have enough still frames, Trigger!
    if (stillFrameCount.current > requiredFrames) {
      if (!isStill) setIsStill(true);
      return true;
    }

    return false;
  }, [isStill, threshold, requiredFrames]);

  const resetStillness = () => {
    stillFrameCount.current = 0;
    setIsStill(false);
  };

  return { checkStillness, isStill, resetStillness };
}