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
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'aperture-ai', // Organize photos in folder
      resource_type: 'image',
    });
    
    return result.secure_url; // Return photo URL
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload photo');
  }
}

export async function deletePhoto(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error('Failed to delete photo');
  }
}
