"use server";
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary auto-configures from CLOUDINARY_URL environment variable
// No need to manually set cloud_name, api_key, api_secret

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
