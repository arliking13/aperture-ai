"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { detected: false, advice: "" };

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });
    
    const base64Data = base64Image.split(",")[1];
    
    const prompt = `You are a professional posing coach analyzing a camera frame.
    
    Task:
    1. If you see a human figure in the frame, give ONE specific 10-word tip to improve their pose (e.g., "Tilt chin up 10 degrees for better angle").
    2. If the frame is empty or shows only objects (bottles, desk items, animals), respond with exactly: "EMPTY"
    
    Focus on posture geometry. Do not identify the person.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    
    // Return structured response
    if (text === "EMPTY" || text.length < 5) {
      return { detected: false, advice: "" };
    }
    
    return { detected: true, advice: text };
    
  } catch (error: any) {
    console.error("AI Error:", error);
    return { detected: false, advice: "" };
  }
}
