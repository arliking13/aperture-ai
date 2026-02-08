// src/app/utils/smartAdvice.ts

const COMPLIMENTS = [
    "Lighting is perfect here, don't move!",
    "Okay, that framing is actually really good.",
    "Love this angle for you.",
    "No notes. You look ready.",
    "Clean shot. Let's take another just in case."
];

const say = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateSmartAdvice(
    landmarks: any[], 
    objects: { class: string }[], 
    brightness: number
): string {
    // 1. CRITICAL: LIGHTING CHECK (Most important)
    if (brightness < 40) return "It's way too dark. Face a window or turn on a light.";
    if (brightness > 220) return "Too bright! You're washed out. Step away from the light source.";

    // 2. CONTEXT AWARENESS (Objects)
    // We filter out 'person' to see what else is in the room.
    const clutter = objects.filter(o => o.class !== 'person').map(o => o.class);
    
    // Specific triggers based on what it sees
    if (clutter.includes('bottle') || clutter.includes('cup')) {
        return "Clean up the frame: I see a drink/bottle stealing focus.";
    }
    if (clutter.includes('chair') || clutter.includes('couch')) {
        return "Try standing up or moving that furniture out of the background.";
    }
    if (clutter.includes('tv') || clutter.includes('laptop')) {
        return "Screens are distracting. Can you angle away from the tech?";
    }
    if (clutter.includes('backpack') || clutter.includes('handbag')) {
        return "There's a bag in the shot. Maybe move it?";
    }

    // 3. POSE & FRAMING (Body)
    if (landmarks && landmarks.length > 0) {
        const nose = landmarks[0];
        const leftEye = landmarks[2];
        const rightEye = landmarks[5];
        const leftShldr = landmarks[11];
        const rightShldr = landmarks[12];

        // Centering (0.0 = Left, 1.0 = Right)
        if (nose.x < 0.4) return "You're too far left. Center yourself.";
        if (nose.x > 0.6) return "You're too far right. Step to the middle.";

        // Distance (Shoulder width)
        const width = Math.abs(leftShldr.x - rightShldr.x);
        if (width < 0.15) return "You're too far away. Come closer to the camera.";
        if (width > 0.8) return "Too close! Back up a bit to show more context.";

        // Head Tilt (Eye level difference)
        const tilt = Math.abs(leftEye.y - rightEye.y);
        if (tilt > 0.08) return "Your head is tilted. Try leveling your chin.";
    } else {
        return "I can't see you clearly. Step into the frame!";
    }

    // 4. IF NO ISSUES FOUND -> Compliment
    return say(COMPLIMENTS);
}

export function analyzeBrightness(ctx: CanvasRenderingContext2D, width: number, height: number): number {
    // Sample center of image (where the face usually is)
    const sampleSize = 100;
    const startX = (width - sampleSize) / 2;
    const startY = (height - sampleSize) / 2;
    
    const imageData = ctx.getImageData(startX, startY, sampleSize, sampleSize);
    const data = imageData.data;
    let colorSum = 0;

    for (let x = 0; x < data.length; x += 4) {
        const avg = (data[x] + data[x+1] + data[x+2]) / 3;
        colorSum += avg;
    }
    return Math.floor(colorSum / (data.length / 4));
}