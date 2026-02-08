"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function getGeminiAdvice(base64Image: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "System: API Key Missing";

  try {
    const genAI = new GoogleGenerativeAI(key);
    
    // Use gemini-1.5-flash for Vision (it sees images best)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });

    // Strip the data:image/jpeg;base64 part if present
    const cleanBase64 = base64Image.includes("base64,") 
      ? base64Image.split("base64,")[1] 
      : base64Image;

    const prompt = `You are a professional photography coach. 
    Analyze this selfie/photo visually. 
    Do NOT say "looking good" or generic praise.
    Give ONE specific, actionable instruction to improve the photo immediately.
    Focus on: Head tilt, chin position, lighting, or angle.
    Keep it under 10 words.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    
    return result.response.text() || "Adjust your angle slightly.";

  } catch (error: any) {
    console.error("AI Vision Error:", error.message);
    if (error.message.includes("429")) return "Too fast! Wait a moment.";
    return "Could not analyze photo.";
  }
}