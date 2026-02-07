"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return "API Key Missing";

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
    
    // NEW POSE COACH PROMPT
    const prompt = `You are a professional Posing Coach for human portraits.
    1. If you DO NOT see a human in the frame (e.g., just objects, animals, or toys), respond ONLY with: "Please step into the frame so I can help you pose!"
    2. If you see a human, give ONE specific 10-word tip to improve their pose (e.g., 'Tilt your head 5 degrees left' or 'Place your hand on your hip').
    3. Ignore all non-human objects. Focus entirely on human posture and angles.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text();

    // If the AI is blocked or returns nothing, remind the user to pose
    return text && text.length > 5 ? text : "Ready for your pose! Please step into view.";
    
  } catch (error: any) {
    console.error("AI ERROR:", error);
    return "Waiting for a human subject..."; 
  }
}
