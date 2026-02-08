"use server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function getGeminiAdvice(base64Image: string): Promise<string> {
  // 1. Check for API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY is not set in environment variables.");
    return "Error: API Key is missing. Check Vercel Settings.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 2. Remove header if present (data:image/jpeg;base64,)
    const base64Data = base64Image.includes(",") 
      ? base64Image.split(",")[1] 
      : base64Image;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const prompt = `
      You are a friendly photography coach. Look at this photo.
      Give ONE specific, short tip to improve it (pose, framing, or light).
      If it's good, give a nice compliment.
      Max 15 words.
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
    
  } catch (error: any) {
    console.error("❌ GEMINI API ERROR:", error.message || error);
    
    // Return the actual error to help you debug
    if (error.message?.includes("API key")) return "Error: Invalid API Key.";
    if (error.message?.includes("413")) return "Error: Photo too large.";
    
    return "AI Error: " + (error.message || "Unknown error");
  }
}