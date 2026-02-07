"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return "API_MISSING";

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const base64Data = base64Image.split(",")[1];
    
    // THE "TRUTH ANCHOR" PROMPT
    const prompt = `Task: Professional Human Posing Coach.
    Requirement: Analyze the image for a REAL HUMAN being. 
    Rule 1: If there is no clear human person, respond ONLY with the word 'NONE'.
    Rule 2: Do NOT give tips for objects, water bottles, hands, or toys.
    Rule 3: If a human is found, give ONE 10-word tip for their posing angle. 
    Be strict. No human = 'NONE'.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    return text; // Returns 'NONE' or a real tip
    
  } catch (error: any) {
    return "NONE"; 
  }
}
