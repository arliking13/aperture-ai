"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string): Promise<string> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("No API Key found");
      return "ERROR: No API Key";
    }

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
    
    // NEW DETECTION + DESCRIPTION PROMPT
    const prompt = `You are a vision AI analyzing a camera frame.

TASK:
1. First, tell me what you see in the frame
2. Then give instructions based on what you see

RESPONSE FORMAT:
- If you see a HUMAN/PERSON: "HUMAN: [one short posing tip under 12 words]"
- If you see OBJECTS ONLY (bottle, mouse, desk, etc): "OBJECT: [name the main object you see]"
- If frame is EMPTY/BLURRY: "EMPTY"

Examples:
- "HUMAN: Tilt your chin up slightly for better angle"
- "OBJECT: Water bottle on desk"
- "OBJECT: Computer mouse"
- "EMPTY"

Be honest about what you actually see.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    
    console.log("🤖 AI Raw Response:", text); // This appears in Vercel Logs
    
    return text;
    
  } catch (error: any) {
    console.error("AI Action Error:", error.message);
    return "ERROR: " + error.message;
  }
}
