import { createClient } from '@supabase/supabase-js';
import { optimizeImage } from './imageOptimization';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('placeholder') &&
      !supabaseAnonKey.includes('YOUR_')
  );
};

// Fallback dummy client if credentials are missing
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export interface UploadResult {
  url: string;
  path: string;
  source: 'supabase' | 'local_fallback' | 'local';
  sizeKb?: number;
  message?: string;
}

/**
 * Upload image file to Supabase Storage 'product-images' bucket.
 * Resilient: Automatically optimizes the image (WebP/JPEG, ~100KB) and
 * falls back to high-resolution local Data URL if Supabase storage bucket is not created or RLS denies access.
 * Guaranteed to NEVER return null or lose the admin's image!
 */
export async function uploadProductImage(file: File): Promise<UploadResult> {
  // Step 1: Pre-optimize the image on client to ensure high visual quality and compact size
  let optimizedDataUrl = '';
  let optimizedBlob: Blob = file;
  let sizeKb = Math.round(file.size / 1024);

  try {
    const opt = await optimizeImage(file, 1200, 1600, 0.85);
    optimizedDataUrl = opt.dataUrl;
    optimizedBlob = opt.blob;
    sizeKb = opt.sizeKb;
  } catch (optErr) {
    console.warn('Image optimization warning, continuing with original file:', optErr);
  }

  // If Supabase is not configured, immediately return the optimized Data URL
  if (!isSupabaseConfigured()) {
    if (!optimizedDataUrl) {
      optimizedDataUrl = await fileToDataUrl(file);
    }
    return {
      url: optimizedDataUrl,
      path: `local/${file.name}`,
      source: 'local',
      sizeKb,
      message: 'Saved locally (Supabase not configured)',
    };
  }

  // Step 2: Try uploading to Supabase Storage
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, optimizedBlob, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.warn('Supabase storage bucket upload notice:', uploadError.message);
      // Seamlessly fall back to local optimized Data URL so image is NEVER lost
      if (!optimizedDataUrl) {
        optimizedDataUrl = await fileToDataUrl(file);
      }
      return {
        url: optimizedDataUrl,
        path: filePath,
        source: 'local_fallback',
        sizeKb,
        message: `Saved locally (Supabase storage notice: ${uploadError.message})`,
      };
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      path: filePath,
      source: 'supabase',
      sizeKb,
      message: 'Uploaded to Supabase Cloud Storage',
    };
  } catch (err: any) {
    console.warn('Upload exception, falling back to local image data:', err);
    if (!optimizedDataUrl) {
      optimizedDataUrl = await fileToDataUrl(file);
    }
    return {
      url: optimizedDataUrl,
      path: `local/${file.name}`,
      source: 'local_fallback',
      sizeKb,
      message: 'Saved locally (Network / Storage fallback)',
    };
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
