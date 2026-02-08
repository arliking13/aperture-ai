"use server";
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPhoto(base64Image: string): Promise<string> {
  try {
    console.log('Starting upload...');
    
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai',
      resource_type: 'image',
    });
    
    console.log('Upload successful:', result.secure_url);
    return result.secure_url;
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload: ' + error.message);
  }
}
