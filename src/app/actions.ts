"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return "Configure your API Key in Vercel.";

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest",
      // 1. DISABLE SAFETY FILTERS so they don't block your photos
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });
    
    const base64Data = base64Image.split(",")[1];
    const prompt = "You are an expert action figure photographer. Give 1 short, cool tip for this shot. If you see nothing, suggest a cool pose.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const response = await result.response;
    const text = response.text();

    // 2. FALLBACK if Gemini still returns blank
    if (!text || text.trim().length === 0) {
      return "Try a lower camera angle for a more heroic look!";
    }

    return text;
    
  } catch (error: any) {
    console.error("AI ERROR:", error);
    return "Searching for a better angle..."; 
  }
}
