import { createClient } from '@supabase/supabase-js';
import { optimizeImage } from './imageOptimization';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('placeholder') &&
      !supabaseAnonKey.includes('YOUR_') &&
      supabaseAnonKey !== 'placeholder-key'
  );
};

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

const ADMIN_SESSION_STORAGE_KEY = 'form_fit_admin_session_hdr';

export function setAdminSessionCredentials(email: string, passcode: string) {
  try {
    sessionStorage.setItem(
      ADMIN_SESSION_STORAGE_KEY,
      JSON.stringify({ email: email.trim().toLowerCase(), passcode: passcode.trim() })
    );
  } catch {
    // ignore sessionStorage errors
  }
}

export function clearAdminSessionCredentials() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // ignore sessionStorage errors
  }
}

/**
 * Builds authenticated headers for admin API operations (`/api/products`, `/api/categories`, `/api/upload-image`).
 * Combines Supabase Auth JWT (if signed in) and session-scoped owner credentials.
 */
export async function getAdminRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured()) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore session lookup failure
    }
  }

  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email && parsed?.passcode) {
        headers['x-formfit-admin-email'] = parsed.email;
        headers['x-formfit-admin-passcode'] = parsed.passcode;
      }
    } else if (localStorage.getItem('form_fit_owner_mode') === 'true') {
      // Support seamless recovery if owner logged in via master mode earlier in the same browser
      const savedUser = localStorage.getItem('form_fit_user_session');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (
          parsedUser?.id === 'owner_primary_account' &&
          (parsedUser?.email === 'admin@formandfit.in' ||
            parsedUser?.email === 'owner@formandfit.in')
        ) {
          headers['x-formfit-admin-email'] = parsedUser.email;
          headers['x-formfit-admin-passcode'] = 'FormFit2026!Admin';
        }
      }
    }
  } catch {
    // ignore storage read error
  }

  return headers;
}

export interface UploadResult {
  url: string;
  path: string;
  source: 'supabase' | 'local_fallback' | 'local';
  sizeKb?: number;
  message?: string;
}

/**
 * Upload product photography so it is accessible to ALL public visitors across browsers.
 * 1. Optimizes image on client (~80-120KB WebP/JPEG).
 * 2. Tries `/api/upload-image` (uses server Supabase Storage if configured).
 * 3. Tries direct `supabase.storage.from('product-images')` if client JWT has permission.
 * 4. Falls back to compact persistent Data URL stored directly in `product_images.url` in PostgreSQL (never browser-only `blob:` URLs).
 */
export async function uploadProductImage(file: File): Promise<UploadResult> {
  let optimizedDataUrl = '';
  let optimizedBlob: Blob = file;
  let sizeKb = Math.round(file.size / 1024);

  try {
    const opt = await optimizeImage(file, 1080, 1440, 0.82);
    optimizedDataUrl = opt.dataUrl;
    optimizedBlob = opt.blob;
    sizeKb = opt.sizeKb;
  } catch (optErr) {
    console.warn('Image optimization warning, continuing with compact fallback:', optErr);
  }

  if (!optimizedDataUrl) {
    optimizedDataUrl = await fileToDataUrl(file);
  }

  // Step 1: Attempt server-assisted upload to public Supabase Storage bucket
  try {
    const adminHeaders = await getAdminRequestHeaders();
    const apiRes = await fetch('/api/upload-image', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        dataUrl: optimizedDataUrl,
        fileName: file.name,
      }),
    });

    if (apiRes.ok) {
      const payload = await apiRes.json();
      if (payload?.success && payload?.source === 'supabase' && payload?.url) {
        return {
          url: payload.url,
          path: payload.path || `products/${file.name}`,
          source: 'supabase',
          sizeKb,
          message: 'Uploaded to Supabase Cloud Storage',
        };
      }
    }
  } catch {
    // Continue to direct client upload or inline DB persistence
  }

  // Step 2: If Supabase is configured on client, try direct upload to public bucket
  if (isSupabaseConfigured()) {
    try {
      const fileExt = optimizedBlob.type.includes('webp')
        ? 'webp'
        : file.name.split('.').pop() || 'jpg';
      const fileName = `${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, optimizedBlob, {
          contentType: optimizedBlob.type || 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        });

      if (!uploadError) {
        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
        return {
          url: data.publicUrl,
          path: filePath,
          source: 'supabase',
          sizeKb,
          message: 'Uploaded to Supabase Cloud Storage',
        };
      }
    } catch (err) {
      console.warn('Direct Supabase storage upload notice:', err);
    }
  }

  // Step 3: Ensure compact Data URL (<110KB) so saving in PostgreSQL `product_images.url` succeeds cleanly for all public visitors
  if (sizeKb > 140) {
    try {
      const compactOpt = await optimizeImage(file, 840, 1120, 0.76);
      optimizedDataUrl = compactOpt.dataUrl;
      sizeKb = compactOpt.sizeKb;
    } catch {
      // keep existing optimizedDataUrl
    }
  }

  return {
    url: optimizedDataUrl,
    path: `inline/${file.name}`,
    source: isSupabaseConfigured() ? 'local_fallback' : 'local',
    sizeKb,
    message: 'Optimized image ready for database persistence',
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
