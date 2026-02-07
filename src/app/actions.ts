"use server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize inside the function to ensure it grabs the latest Env Var
export async function analyzeFrame(base64Image: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "ERROR: API Key is missing in Vercel.";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const base64Data = base64Image.split(",")[1];
    const prompt = "You are a professional photography coach. Give 1 short sentence of advice for this action figure photo.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    return result.response.text();
  } catch (error: any) {
    // This will now show the REAL error on your iPhone!
    console.error("AI Error:", error);
    return `AI Error: ${error.message?.slice(0, 40)}...`;
  }
}
