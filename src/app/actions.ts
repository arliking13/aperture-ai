"use server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return "Configure your API Key in Vercel.";

    const genAI = new GoogleGenerativeAI(key);
    // Use 'gemini-1.5-flash-latest' for the most stable endpoint
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const base64Data = base64Image.split(",")[1];
    const prompt = "Act as a pro photographer. Give 1 short, actionable tip for this shot. Be quick.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const response = await result.response;
    return response.text();
    
  } catch (error: any) {
    // This logs specifically to Vercel so you can see it in 'Logs'
    console.error("CRITICAL AI ERROR:", error.stack);
    return null; // Returning null keeps the notification hidden if there's an error
  }
}
