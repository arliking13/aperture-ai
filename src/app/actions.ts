"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// EXPORT NAME MATCHES YOUR COMPONENT IMPORT
export async function getGeminiAdvice(poseDescription: string): Promise<string> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("API Key missing");
      return "Coach: (Check API Key)";
    }

    const genAI = new GoogleGenerativeAI(key);
    
    // FIX: Reverted to 'gemini-2.0-flash' because your earlier logs proved this model exists for you.
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
    
    // If you hit the rate limit (429) again, we return a fallback so the app doesn't crash
    if (error.message.includes("429")) return "Great pose! Hold it!"; 
    if (error.message.includes("404")) return "Looking good!";
    
    return "Hold steady!";
  }
}