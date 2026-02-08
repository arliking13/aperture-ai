"use server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function getGeminiAdvice(base64Image: string): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) return "Error: API Key missing.";

    // Clean the base64 string (remove data:image/jpeg;base64, prefix)
    const imagePart = {
      inlineData: {
        data: base64Image.split(",")[1],
        mimeType: "image/jpeg",
      },
    };

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // The Prompt: Ask for specific, human-like photography advice
    const prompt = `
      You are a professional photographer assistant. Analyze this photo specifically for pose, lighting, and composition.
      Give ONE short, actionable, friendly tip to improve the next shot. 
      If the photo is perfect, give a unique, non-generic compliment.
      Keep it under 15 words. Be human, not robotic.
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    return response.text() || "Couldn't analyze that one. Try again!";
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI is taking a nap. Try again later.";
  }
}