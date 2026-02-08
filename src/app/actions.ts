"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Configure Cloudinary with Vercel Environment Variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- 1. AI COACHING (Gemini 2.0 Flash) ---
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

    // Clean the base64 string
    const cleanBase64 = base64Image.includes("base64,") ? base64Image.split("base64,")[1] : base64Image;
    
    // Updated Prompt for specific, actionable advice
    const prompt = `Act as a strict photography coach. Analyze this photo for lighting, framing, and pose. Give ONE imperative command to improve the shot. Max 10 words.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    return result.response.text() || "Adjust your angle.";

  } catch (error: any) {
    if (error.message && error.message.includes("429")) return "Quota full. Wait 60s.";
    console.error("Gemini Error:", error);
    return "Could not analyze photo.";
  }
}

// --- 2. UPLOAD LOGIC ---
export async function uploadPhoto(base64Image: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai',
      resource_type: 'image',
      tags: ['temporary_capture'] // Tagging for easier bulk management if needed
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return "";
  }
}

// --- 3. RETRIEVAL & CLEANUP LOGIC (THE FIX) ---
export async function getCloudImages(): Promise<string[]> {
  try {
    // A. Fetch recent images (Limit 50 to catch backlog)
    const { resources } = await cloudinary.search
      .expression('folder:aperture-ai')
      .sort_by('created_at', 'desc')
      .max_results(50) 
      .execute();

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const validImages: string[] = [];
    const expiredIds: string[] = [];

    // B. Filter: Separate Valid vs. Expired
    resources.forEach((file: any) => {
        const createdAt = new Date(file.created_at).getTime();
        
        // If older than 5 mins, mark for deletion
        if (now - createdAt > fiveMinutes) {
            expiredIds.push(file.public_id);
        } else {
            validImages.push(file.secure_url);
        }
    });

    // C. Execute Deletion (MUST AWAIT THIS for Vercel)
    if (expiredIds.length > 0) {
        console.log(`Cleaning up ${expiredIds.length} expired images...`);
        await cloudinary.api.delete_resources(expiredIds);
    }

    // Return only the valid images to the frontend
    return validImages.slice(0, 12);
  } catch (error) {
    console.error("Gallery Error:", error);
    return [];
  }
}