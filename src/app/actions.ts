"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzeFrame(base64Image: string): Promise<string> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return "ERROR: No API Key";
    }

    const genAI = new GoogleGenerativeAI(key);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });
    
    const base64Data = base64Image.split(",")[1];
    
    // ENHANCED PROMPT - Stricter human detection criteria
    const prompt = `You are a computer vision system analyzing a camera frame for HUMAN PRESENCE ONLY.

CRITICAL RULES:
1. A human MUST have: visible face OR recognizable body structure (head, torso, limbs)
2. 2D images/posters/screens showing humans = OBJECT (not real humans)
3. Partial views (just hands, just feet) = OBJECT
4. Reflections or shadows = OBJECT
5. Toys, figurines, dolls = OBJECT

ANALYSIS STEPS:
Step 1: Describe what you see in 5 words or less
Step 2: Does it match ALL human criteria? (face OR full body structure)
Step 3: Output your classification

OUTPUT FORMAT (choose ONE):
- Real human detected → "HUMAN: [posing tip under 12 words]"
- Anything else → "OBJECT: [main item name]"
- Unclear/blurry → "EMPTY"

Examples:
✓ "HUMAN: Straighten shoulders and lift chin"
✓ "OBJECT: Water bottle"
✓ "OBJECT: Poster of person on wall"
✓ "OBJECT: Action figure"
✓ "EMPTY"

Be extremely strict - when in doubt, classify as OBJECT.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    console.log("🤖 AI Raw Response:", text);
    
    return text;
    
  } catch (error: any) {
    console.error("AI Action Error:", error.message);
    return "ERROR: " + error.message;
  }
}
