"use server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeFrame(base64Image: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Prompt the AI to be a quick photography coach
    const prompt = "You are a professional photography coach. Look at this live camera frame and give 1 short sentence of advice (composition, lighting, or focus) to help the user take a better action figure photo. Be extremely concise.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image.split(",")[1], mimeType: "image/jpeg" } }
    ]);

    return result.response.text();
  } catch (error) {
    console.error("AI Error:", error);
    return "Analyzing...";
  }
}
