"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function getGeminiAdvice(poseDescription: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "Coach: (Check API Key)";

  const genAI = new GoogleGenerativeAI(key);
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ];

  const prompt = `You are a friendly posing coach. Based on this data, give ONE short tip (max 10 words).
  POSE DATA: ${poseDescription}`;

  // --- STRATEGY: TRY MODEL A -> IF FAIL -> TRY MODEL B ---
  
  try {
    // 1. Try the fast model first
    const modelA = genAI.getGenerativeModel({ model: "gemini-2.0-flash", safetySettings });
    const result = await modelA.generateContent(prompt);
    return result.response.text().trim();

  } catch (errorA: any) {
    console.warn("Gemini 2.0 Failed, switching to 1.5...", errorA.message);

    try {
      // 2. Fallback to the stable model (Different Quota Bucket)
      const modelB = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
      const result = await modelB.generateContent(prompt);
      return result.response.text().trim();

    } catch (errorB: any) {
      console.error("All AI Models Failed:", errorB.message);
      
      // 3. If both fail, return a special "RATE_LIMIT" code so the UI knows to wait
      if (errorB.message.includes("429")) return "RATE_LIMIT";
      return "Looking good!";
    }
  }
}