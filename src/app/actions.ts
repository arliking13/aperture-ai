"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// RENAMED: Changed from 'analyzePoseData' to 'getGeminiAdvice' to match your import
export async function getGeminiAdvice(poseDescription: string): Promise<string> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("API Key missing");
      return "Coach: (Check API Key)";
    }

    const genAI = new GoogleGenerativeAI(key);
    
    // Using 'gemini-2.0-flash' as it worked for you previously
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash", 
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });
    
    const prompt = `You are a friendly, energetic posing coach.
    Based on this data, give ONE short, specific tip (max 10 words).
    
    POSE DATA:
    ${poseDescription}
    
    Examples:
    "Chin up slightly!"
    "Relax those shoulders."
    "Perfect! Hold that!"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    return text;
    
  } catch (error: any) {
    console.error("AI Error:", error.message);
    
    // Fallback responses if AI fails
    if (error.message.includes("429")) return "Great pose! Hold it!"; 
    if (error.message.includes("404")) return "Looking good!";
    
    return "Hold steady!";
  }
}