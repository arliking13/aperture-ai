// src/app/utils/smartAdvice.ts

const COMPLIMENTS = [
    "That lighting is chef's kiss! 🤌",
    "No notes, you look incredible.",
    "Frame looks clean, keep doing that.",
    "Love the energy in this one!",
    "Okay, pop off! That's a keeper."
];

// Helper to pick random item
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateSmartAdvice(
    landmarks: any[], 
    objects: { class: string }[], 
    brightness: number
): string {
    // 1. ANALYZE SCENE (Objects/Clutter)
    // Filter out people to find "stuff"
    const clutter = objects.filter(o => o.class !== 'person');
    
    // Specific Object Callouts (The "Human" touch)
    const badObjects = clutter.map(c => c.class);
    
    if (badObjects.includes('bottle') || badObjects.includes('cup')) {
        return "Hydration is key, but maybe hide the drink for the pic? 🥤";
    }
    if (badObjects.includes('backpack') || badObjects.includes('handbag')) {
        return "That bag in the corner is stealing your spotlight.";
    }
    if (badObjects.includes('laptop') || badObjects.includes('mouse')) {
        return "Close the laptop, let's make this about you, not work.";
    }
    if (badObjects.includes('chair') && clutter.length > 2) {
        return "Background feels a bit messy with all those chairs.";
    }

    // 2. ANALYZE LIGHTING
    if (brightness < 50) return "It's giving 'mystery', but try finding some better light.";
    if (brightness > 200) return "Whoa, too bright! You're washing out.";

    // 3. ANALYZE POSE (If a person was actually found)
    if (landmarks && landmarks.length > 0) {
        const nose = landmarks[0];
        const leftShldr = landmarks[11];
        const rightShldr = landmarks[12];

        // Centering check (0.0 is left, 1.0 is right)
        if (nose.x < 0.4) return "Slide a little to your left (camera's right) to center up.";
        if (nose.x > 0.6) return "Scoot a bit to your right to hit the center frame.";

        // Distance check (Shoulder width relative to screen)
        const width = Math.abs(leftShldr.x - rightShldr.x);
        if (width < 0.2) return "Come closer, don't be shy!";
        if (width > 0.8) return "Back it up a smidge, you're too close.";
    } else {
        return "I didn't catch you in that one. Jump in the frame!";
    }

    // 4. IF EVERYTHING IS GOOD
    return pick(COMPLIMENTS);
}

export function analyzeBrightness(ctx: CanvasRenderingContext2D, width: number, height: number): number {
    const imageData = ctx.getImageData(0, 0, width, height); // Sample whole image for accuracy
    const data = imageData.data;
    let r, g, b, avg;
    let colorSum = 0;
    // Sample every 10th pixel to save CPU
    for (let x = 0, len = data.length; x < len; x += 40) {
        r = data[x]; g = data[x+1]; b = data[x+2];
        avg = Math.floor((r + g + b) / 3);
        colorSum += avg;
    }
    return Math.floor(colorSum / (data.length / 40));
}