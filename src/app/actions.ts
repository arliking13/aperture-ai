"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- AI COACHING ---
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
    const prompt = `Act as a minimalist photography coach. Focus on centering and lighting. Give ONE imperative command to improve the shot. Max 8 words.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } }
    ]);
    return result.response.text() || "Adjust your angle.";

  } catch (error: any) {
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

// --- DELETION LOGIC (FIXED) ---
export async function getCloudImages(): Promise<string[]> {
  try {
    // 1. Fetch recent images
    const { resources } = await cloudinary.search
      .expression('folder:aperture-ai')
      .sort_by('created_at', 'desc')
      .max_results(50) 
      .execute();

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const validImages: string[] = [];
    const expiredIds: string[] = [];

    // 2. Filter & Detect Expired
    resources.forEach((file: any) => {
        const createdAt = new Date(file.created_at).getTime();
        const age = now - createdAt;

        if (age > fiveMinutes) {
            expiredIds.push(file.public_id);
        } else {
            validImages.push(file.secure_url);
        }
    });

    // 3. EXECUTE DELETION (Parallel & Fast)
    if (expiredIds.length > 0) {
        console.log(`Destroying ${expiredIds.length} images...`);
        
        // Use Promise.all to delete them all at once using the UPLOADER API (Faster)
        await Promise.all(
          expiredIds.map(id => 
            cloudinary.uploader.destroy(id, { invalidate: true })
          )
        );
    }

    return validImages.slice(0, 12);
  } catch (error) {
    console.error("Gallery Error:", error);
    return [];
  }
}