"use server";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Cloudinary automatically connects using your CLOUDINARY_URL environment variable.
// DO NOT add a manual cloudinary.config() block here, or it will break.

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

// 2. Fetch Gallery (With 1-Hour Auto-Delete)
export async function getCloudImages() {
  try {
    // Get the last 50 photos
    const result = await cloudinary.search
      .expression('folder:aperture-ai')
      .sort_by('created_at', 'desc')
      .max_results(50)
      .execute();

    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 Hour in milliseconds
    
    const validUrls: string[] = [];
    const idsToDelete: string[] = [];

    // Filter photos
    for (const file of result.resources) {
      const fileTime = new Date(file.created_at).getTime();
      const age = now - fileTime;

      if (age > oneHour) {
        // If older than 1 hour, mark for deletion
        idsToDelete.push(file.public_id);
      } else {
        // If fresh, keep it
        validUrls.push(file.secure_url);
      }
    }

    // Delete the old ones from the cloud immediately
    if (idsToDelete.length > 0) {
      // We don't await this so it doesn't slow down the user
      cloudinary.api.delete_resources(idsToDelete);
      console.log(`Cleaned up ${idsToDelete.length} expired photos.`);
    }

    return validUrls;
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