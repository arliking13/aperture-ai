"use server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

export async function analyzePoseData(poseDescription: string): Promise<string> {
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
    
    const prompt = `You are a friendly, encouraging posing coach speaking to someone in real-time.

Based on their current pose measurements, give ONE piece of natural, conversational coaching advice.

POSE DATA:
${poseDescription}

Guidelines:
- Speak like a real human coach, warm and encouraging
- Keep it to 1-2 short sentences (under 25 words total)
- Be specific about what you see in the data
- If the pose is good, give genuine praise
- If there are issues, suggest ONE fix at a time
- Vary your phrasing naturally
- Sound conversational, not robotic

Examples of good coaching:
- "Hey, I notice your left shoulder is higher - try leveling them out"
- "Your posture looks great! Maybe just lift your chin a tiny bit more"
- "You're slouching a little, let's straighten that back"
- "Perfect! That's an excellent pose, just hold it right there"
- "Almost there - relax your shoulders, they're a bit tense"

Now give your natural coaching advice based on the pose data:`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    console.log("🎙️ AI Coach:", text);
    return text;
    
  } catch (error: any) {
    console.error("AI Error:", error.message);
    if (error.message.includes("429")) {
      return "Let's take a quick break"; // Natural response to rate limit
    }
    return "Keep holding that pose";
  }
}
