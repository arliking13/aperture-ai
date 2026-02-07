"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string): Promise<string> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return "ERROR: No API Key found in Vercel environment variables";
    }

    const genAI = new GoogleGenerativeAI(key);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });
    
    const base64Data = base64Image.split(",")[1];
    
    // ✅ NEW PROMPT: Creative photography advice
    const prompt = `You are a professional photography coach. Analyze this photo and give ONE creative posing tip.

Focus on:
- Facial expression (eyes, smile, head tilt)
- Body language (posture, hand placement, confidence)
- Camera angle suggestions
- Overall composition

Keep your advice under 15 words, friendly, and actionable.

Examples:
- "Relax your shoulders and give a natural smile - you look great!"
- "Tilt your head slightly right and soften your gaze"
- "Try angling your body 45° to the camera for more depth"
- "Lower the camera slightly and look up for a flattering angle"

Now analyze this pose and give your advice:`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    console.log("🤖 Gemini Creative Advice:", text);
    
    // Return with HUMAN: prefix so page.tsx can parse it
    return "HUMAN: " + text;
    
  } catch (error: any) {
    console.error("❌ Gemini API Error:", error.message);
    return "ERROR: " + error.message;
  }
}
