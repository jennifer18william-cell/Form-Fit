/**
 * FORM & FIT — Client-Side Image Optimization & Fashion Image Helpers
 *
 * Compresses and resizes raw camera/device uploads before storing in Supabase or LocalStorage.
 * Keeps image quality exceptionally sharp (1200x1600 retina) while reducing file size from 5-15MB to ~80-180KB.
 * Eliminates browser LocalStorage QuotaExceededError and delivers ultra-fast rendering.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  sizeKb: number;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback below
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Optimizes an image File or Blob by resizing to fashion retina standards and compressing to WebP/JPEG.
 */
export async function optimizeImage(
  file: File | Blob,
  maxWidth = 1200,
  maxHeight = 1600,
  quality = 0.85
): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    // If not in a browser environment, return basic fallback
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          dataUrl: reader.result as string,
          blob: file,
          width: 800,
          height: 1000,
          sizeKb: Math.round(file.size / 1024),
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate proportional constrained dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to raw FileReader if 2D context fails
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            dataUrl: reader.result as string,
            blob: file,
            width,
            height,
            sizeKb: Math.round(file.size / 1024),
          });
        };
        reader.readAsDataURL(file);
        return;
      }

      // High-quality image rendering settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try webp first, fallback to jpeg
      let outputMime = 'image/webp';
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          outputMime = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
      } catch {
        outputMime = 'image/jpeg';
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      canvas.toBlob(
        (blob) => {
          const finalBlob = blob || file;
          resolve({
            dataUrl,
            blob: finalBlob,
            width,
            height,
            sizeKb: Math.round((blob?.size || dataUrl.length * 0.75) / 1024),
          });
        },
        outputMime,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      // Fallback to FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          dataUrl: reader.result as string,
          blob: file,
          width: 800,
          height: 1000,
          sizeKb: Math.round(file.size / 1024),
        });
      };
      reader.onerror = () => reject(err);
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Curated high-resolution fashion studio presets that store owners can pick from
 * for immediate testing and professional catalog staging.
 */
export interface FashionPreset {
  id: string;
  name: string;
  category: string;
  url: string;
  thumb: string;
}

export const FASHION_PRESETS: FashionPreset[] = [
  {
    id: 'preset-shirt-black',
    name: 'Luxury Black Tailored Shirt',
    category: 'Shirt',
    url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-shirt-white',
    name: 'Crisp White Oxford Shirt',
    category: 'Shirt',
    url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-tee-heavy-black',
    name: '240 GSM Boxy Heavy Tee',
    category: 'T-Shirts & Tops',
    url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-tee-street-model',
    name: 'Streetwear Graphic Tee',
    category: 'T-Shirts & Tops',
    url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-hoodie-charcoal',
    name: '420 GSM Oversized Hoodie',
    category: 'Hoodies & Sweatshirts',
    url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-hoodie-minimal',
    name: 'Minimalist Sand Hoodie',
    category: 'Hoodies & Sweatshirts',
    url: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-bottom-denim',
    name: 'Wide Leg Raw Denim',
    category: 'Bottom Wear',
    url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-bottom-trousers',
    name: 'Pleated Relaxed Trousers',
    category: 'Bottom Wear',
    url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'preset-custom-apparel',
    name: 'Custom Studio Print Tee',
    category: 'Custom Apparel',
    url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=80',
    thumb: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=200&q=70',
  },
];

/**
 * Returns a smart fallback fashion photograph matching the product name or category
 * when a product has no uploaded photos yet or if an image URL fails to load.
 */
export function getFashionFallbackImage(productName?: string, categoryName?: string): string {
  const query = `${productName || ''} ${categoryName || ''}`.toLowerCase();

  if (query.includes('hoodie') || query.includes('sweat')) {
    return FASHION_PRESETS[4].url;
  }
  if (query.includes('shirt') || query.includes('button')) {
    return FASHION_PRESETS[0].url;
  }
  if (query.includes('denim') || query.includes('pant') || query.includes('trouser') || query.includes('bottom')) {
    return FASHION_PRESETS[6].url;
  }
  if (query.includes('custom') || query.includes('print')) {
    return FASHION_PRESETS[8].url;
  }
  // Default to 240 GSM heavy tee
  return FASHION_PRESETS[2].url;
}
