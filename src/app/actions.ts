"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function getGeminiAdvice(base64Image: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "System: API Key Missing";

  try {
    const genAI = new GoogleGenerativeAI(key);
    
    // FIX: Switched back to 2.0 because your logs prove 1.5 doesn't exist for you.
    // 2.0 works, it just has a rate limit.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });

    // Clean the Base64 string
    const cleanBase64 = base64Image.includes("base64,") 
      ? base64Image.split("base64,")[1] 
      : base64Image;

    const prompt = `You are a professional photography coach. 
    Analyze this photo visually. 
    Give ONE specific instruction to improve the pose, angle, or lighting. 
    Max 10 words.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    
    return result.response.text() || "Adjust your angle slightly.";

  } catch (error: any) {
    console.error("AI Vision Error:", error.message);
    
    // Handle the specific errors you are seeing
    if (error.message.includes("429")) return "Quota full. Wait 60s.";
    if (error.message.includes("404")) return "Error: Model not found.";
    
    return "Could not analyze photo.";
  }
}