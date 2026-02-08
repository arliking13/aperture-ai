"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

cloudinary.config({ secure: true });

export async function getGeminiAdvice(base64Image: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "System: API Key Missing";

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ]
    });

    const cleanBase64 = base64Image.includes("base64,") ? base64Image.split("base64,")[1] : base64Image;
    const prompt = `Act as a photography coach. Analyze this photo. Give ONE specific instruction to improve the pose, angle, or lighting. Max 10 words.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    return result.response.text() || "Adjust your angle.";

  } catch (error: any) {
    if (error.message.includes("429")) return "Quota full. Wait 60s.";
    return "Could not analyze photo.";
  }
}

// --- CLOUD STORAGE SECTION ---

export async function uploadPhoto(base64Image: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai',
      resource_type: 'image',
      // This tag helps us identify and clean up images later
      tags: ['temporary_capture'], 
      // This metadata helps Cloudinary's background systems if you have 
      // "Auto-Purge" enabled in your dashboard settings.
      context: `expires_at=${Math.floor(Date.now() / 1000) + 300}` 
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return "";
  }
}

export async function getCloudImages(): Promise<string[]> {
  try {
    // We fetch images, but we've added a filter to only show 
    // things uploaded in the last 5 minutes.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { resources } = await cloudinary.search
      .expression(`folder:aperture-ai AND created_at >= ${fiveMinutesAgo}`)
      .sort_by('created_at', 'desc')
      .max_results(12)
      .execute();
      
    return resources.map((file: any) => file.secure_url);
  } catch (error) {
    console.error("Gallery Fetch Error:", error);
    return [];
  }
}