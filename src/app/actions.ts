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
      model: "gemini-2.5-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });
    
    const base64Data = base64Image.split(",")[1];
    
    const prompt = `You are a friendly, encouraging photography coach speaking directly to someone.

Analyze their pose and give ONE piece of natural, conversational advice as if you're talking to them in person.

Guidelines:
- Speak naturally like a human coach, not a robot
- Be encouraging and positive in tone
- Keep it to 1-2 sentences (under 20 words)
- Mix technical tips with encouragement
- Vary your language each time
- Use casual, friendly phrasing

Examples of GOOD advice:
- "Hey, try relaxing your shoulders a bit - you're looking a little tense there"
- "That's better! Now let's work on bringing your chin up just slightly"
- "You're doing great, but I think tilting your head a bit to the left would look even better"
- "Perfect posture! Maybe add a subtle smile to really complete the look"
- "Almost there - just straighten your back a touch and you'll nail it"

Analyze this pose and give your natural, conversational coaching:`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const text = result.response.text().trim();
    console.log("🤖 AI Coach says:", text);
    
    return "HUMAN: " + text;
    
  } catch (error: any) {
    console.error("AI Error:", error.message);
    return "ERROR: " + error.message;
  }
}
