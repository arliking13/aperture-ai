export const calculateMovement = (current: any[], previous: any[] | null): number => {
  if (!previous) return 999;
  
  // Indices for Nose(0), Shoulders(11,12), Hips(23,24)
  const keyPoints = [0, 11, 12, 23, 24]; 
  let total = 0;
  
  keyPoints.forEach(i => {
    if (current[i] && previous[i]) {
      const dx = current[i].x - previous[i].x;
      const dy = current[i].y - previous[i].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
  });
  
  return total / keyPoints.length;
};