"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- DELETE THIS BLOCK ---
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });
// -------------------------
// The SDK automatically reads CLOUDINARY_URL from your Vercel Environment Variables.

// 1. Upload Function
export async function uploadPhoto(base64Image: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai',
    });
    return result.secure_url;
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error('Upload failed: ' + error.message);
  }
}

// 2. Fetch Gallery Function (For Judges)
export async function getCloudImages() {
  try {
    // Search for all images in your folder
    const result = await cloudinary.search
      .expression('folder:aperture-ai')
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    // Return just the URLs
    const urls = result.resources.map((file: any) => file.secure_url);
    return urls;
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
}

// 3. AI Analysis Function
export async function analyzeImage(imageUrl: string) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Fetch the image to pass to Gemini
    const imageResp = await fetch(imageUrl);
    const imageBuffer = await imageResp.arrayBuffer();
    
    const prompt = "You are a professional photography coach. Analyze this photo. Give 2 specific, friendly tips to improve the pose, lighting, or angle for the next shot. Keep it under 50 words.";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: Buffer.from(imageBuffer).toString("base64"),
          mimeType: "image/jpeg",
        },
      },
    ]);

    return result.response.text();
  } catch (error) {
    console.error("AI Error:", error);
    return "Great shot! (AI Analysis temporarily unavailable)";
  }
}