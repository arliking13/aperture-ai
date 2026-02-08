"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// 1. CONFIGURE CLOUDINARY
// It automatically reads CLOUDINARY_URL from your .env file
cloudinary.config({
  secure: true
});

// --- GEMINI AI SECTION ---
export async function getGeminiAdvice(base64Image: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "System: API Key Missing";

  try {
    const genAI = new GoogleGenerativeAI(key);
    
    // Using 2.0-flash as established
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
    
    const prompt = `Act as a photography coach. Analyze this photo. 
    Give ONE specific instruction to improve the pose, angle, or lighting. 
    Max 10 words.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    
    return result.response.text() || "Adjust your angle.";

  } catch (error: any) {
    console.error("AI Error:", error.message);
    if (error.message.includes("429")) return "Quota full. Wait 60s.";
    return "Could not analyze photo.";
  }
}

// --- CLOUD STORAGE SECTION ---

// Uploads the photo to Cloudinary and returns the real URL
export async function uploadPhoto(base64Image: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai', // Keeps your cloud organized
      resource_type: 'image',
    });
    console.log("✅ Uploaded to Cloudinary:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("❌ Cloudinary Upload Error:", error);
    return ""; // Return empty string on failure so app doesn't crash
  }
}

// Fetches the last 10 photos from your 'aperture-ai' folder
export async function getCloudImages(): Promise<string[]> {
  try {
    const { resources } = await cloudinary.search
      .expression('folder:aperture-ai')
      .sort_by('created_at', 'desc')
      .max_results(12) // Fetch last 12 images
      .execute();
      
    return resources.map((file: any) => file.secure_url);
  } catch (error) {
    console.error("❌ Failed to fetch gallery:", error);
    return [];
  }
}