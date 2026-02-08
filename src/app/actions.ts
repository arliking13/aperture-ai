"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI } from "@google/generative-ai";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- GOOGLE GEMINI COACHING (100% FREE) ---
export async function getGeminiAdvice(base64Image: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY; // <--- Get this from aistudio.google.com
  if (!key) return "System: API Key Missing";

  try {
    const genAI = new GoogleGenerativeAI(key);
    // Use "gemini-2.0-flash" for max speed
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const cleanBase64 = base64Image.includes("base64,") ? base64Image.split("base64,")[1] : base64Image;
    const prompt = "Act as a minimalist photography coach. Focus on centering and lighting. Give ONE imperative command to improve the shot. Max 8 words.";

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    return result.response.text() || "Adjust your angle.";

  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("429")) return "Quota full. Wait 60s.";
    return "Could not analyze photo.";
  }
}

// --- UPLOAD LOGIC ---
export async function uploadPhoto(base64Image: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai',
      resource_type: 'image',
      tags: ['temporary_capture']
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return "";
  }
}

// --- PRIVACY DELETION LOGIC (NO CHANGES) ---
export async function getCloudImages(): Promise<string[]> {
  try {
    const { resources } = await cloudinary.search
      .expression('folder:aperture-ai')
      .sort_by('created_at', 'desc')
      .max_results(50) 
      .execute();

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const validImages: string[] = [];
    const expiredIds: string[] = [];

    resources.forEach((file: any) => {
        const age = now - new Date(file.created_at).getTime();
        if (age > fiveMinutes) expiredIds.push(file.public_id);
        else validImages.push(file.secure_url);
    });

    if (expiredIds.length > 0) {
        Promise.all(expiredIds.map(id => cloudinary.uploader.destroy(id, { invalidate: true })))
            .catch(err => console.error("Cleanup Error:", err));
    }
    return validImages.slice(0, 12);
  } catch (error) {
    console.error("Gallery Error:", error);
    return [];
  }
}
