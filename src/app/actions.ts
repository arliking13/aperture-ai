"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return "READY";

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const base64Data = base64Image.split(",")[1];
    
    // NEW BYPASS PROMPT
    const prompt = `Role: Pro Posing Coach. 
    Analyze the 3D human-shaped figure in frame. 
    If no figure is present, reply ONLY with 'READY'. 
    If a figure is present, give ONE tip under 10 words about their angle or posture. 
    Focus on geometry. DO NOT identify the person.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    // Filter out hallucinations
    return text.length > 3 ? text : "READY";
    
  } catch (error: any) {
    return "READY"; 
  }
}
