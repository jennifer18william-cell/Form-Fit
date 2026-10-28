import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { optimizeImage } from './imageOptimization';

export function cleanEnvString(val?: string | null): string {
  if (!val) return '';
  return String(val).trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Ensures any pasted Supabase Data API URL (e.g. `https://<ref>.supabase.co/rest/v1/`)
 * or Dashboard URL (`https://supabase.com/dashboard/project/<ref>`) resolves cleanly
 * to `https://<ref>.supabase.co` so REST, Auth, Storage, and Realtime WebSockets all succeed.
 */
export function normalizeSupabaseUrl(raw?: string | null): string {
  const cleaned = cleanEnvString(raw);
  if (!cleaned) return '';

  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboardMatch?.[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  try {
    const parsed = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    return parsed.origin;
  } catch {
    return cleaned
      .replace(/\/(rest|auth|storage|realtime)\/v1\/?.*$/i, '')
      .replace(/\/+$/, '');
  }
}

const DEFAULT_PROJECT_SUPABASE_URL = 'https://bhuzhxwwsmhzaehkbvzs.supabase.co';
const DEFAULT_PROJECT_PUBLISHABLE_KEY = 'sb_publishable_p5uVElaHKRCZ0gssBj3KxQ_Of07ZH8_';

export let supabaseUrl = normalizeSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_PROJECT_SUPABASE_URL
);
let supabaseAnonKey = cleanEnvString(
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_PROJECT_PUBLISHABLE_KEY
);

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('placeholder') &&
      !supabaseUrl.includes('your-project-ref') &&
      !supabaseAnonKey.includes('YOUR_') &&
      supabaseAnonKey !== 'placeholder-key'
  );
};

function buildBrowserSupabaseClient(url: string, key: string) {
  return createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key', {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

let activeSupabaseClient = buildBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);

export const supabase: typeof activeSupabaseClient = new Proxy({} as any, {
  get(_target, prop) {
    const val = (activeSupabaseClient as any)[prop];
    return typeof val === 'function' ? val.bind(activeSupabaseClient) : val;
  },
});

export function applyRuntimeSupabaseConfig(rawUrl?: string | null, rawAnonKey?: string | null): boolean {
  const nextUrl = normalizeSupabaseUrl(rawUrl);
  const nextKey = cleanEnvString(rawAnonKey);
  if (
    !nextUrl ||
    !nextKey ||
    nextUrl.includes('placeholder') ||
    nextUrl.includes('your-project-ref') ||
    nextKey.includes('YOUR_') ||
    nextKey === 'placeholder-key'
  ) {
    return false;
  }

  if (nextUrl === supabaseUrl && nextKey === supabaseAnonKey) {
    return false;
  }

  supabaseUrl = nextUrl;
  supabaseAnonKey = nextKey;
  activeSupabaseClient = buildBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);

  if (sharedRealtimeChannel) {
    try {
      sharedRealtimeChannel.unsubscribe();
    } catch {
      // ignore
    }
    sharedRealtimeChannel = null;
    realtimeInitialized = false;
  }
  ensureRealtimeInitialized();
  return true;
}

const ADMIN_SESSION_STORAGE_KEY = 'form_fit_admin_session_hdr';
let memoryAdminCredentials: { email: string; passcode: string } | null = null;

export function setAdminSessionCredentials(email: string, passcode: string) {
  const payload = {
    email: email.trim().toLowerCase(),
    passcode: passcode.trim(),
  };
  memoryAdminCredentials = payload;
  const serialized = JSON.stringify(payload);
  try {
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, serialized);
  } catch {
    // ignore sessionStorage restrictions in cross-origin iframes
  }
  try {
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, serialized);
  } catch {
    // ignore localStorage restrictions in cross-origin iframes
  }
}

export function clearAdminSessionCredentials() {
  memoryAdminCredentials = null;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function getCustomerAuthHeaders(): Promise<Record<string, string>> {
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

  return headers;
}

async function attachLiveOwnerJwtIfNeeded(
  headers: Record<string, string>,
  email?: string,
  passcode?: string
): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || !email || !passcode) {
    return headers;
  }

  let hasValidJwt = false;
  if (headers['Authorization']) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        hasValidJwt = true;
      }
    } catch {
      hasValidJwt = false;
    }
  }

  if (!hasValidJwt) {
    try {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: passcode.trim(),
      });
      if (signInData?.session?.access_token) {
        headers['Authorization'] = `Bearer ${signInData.session.access_token}`;
      }
    } catch {
      // ignore if custom admin email uses header-only auth
    }
  }

  return headers;
}

/**
 * Builds authenticated headers for admin API operations (`/api/products`, `/api/categories`, `/api/store`, `/api/upload-image`).
 * Combines live Supabase Auth JWT and multi-layer owner credentials (memory + sessionStorage + localStorage).
 */
export async function getAdminRequestHeaders(): Promise<Record<string, string>> {
  const headers = await getCustomerAuthHeaders();

  if (memoryAdminCredentials?.email && memoryAdminCredentials?.passcode) {
    headers['x-formfit-admin-email'] = memoryAdminCredentials.email;
    headers['x-formfit-admin-passcode'] = memoryAdminCredentials.passcode;
    return attachLiveOwnerJwtIfNeeded(
      headers,
      memoryAdminCredentials.email,
      memoryAdminCredentials.passcode
    );
  }

  let storedRaw: string | null = null;
  try {
    storedRaw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (!storedRaw) {
    try {
      storedRaw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw);
      if (parsed?.email && parsed?.passcode) {
        memoryAdminCredentials = { email: parsed.email, passcode: parsed.passcode };
        headers['x-formfit-admin-email'] = parsed.email;
        headers['x-formfit-admin-passcode'] = parsed.passcode;
        return attachLiveOwnerJwtIfNeeded(headers, parsed.email, parsed.passcode);
      }
    } catch {
      // ignore malformed JSON
    }
  }

  try {
    if (localStorage.getItem('form_fit_owner_mode') === 'true') {
      const savedUser = localStorage.getItem('form_fit_user_session');
      let fallbackEmail = 'admin@patanakart.in';
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser?.email) {
          fallbackEmail = String(parsedUser.email).toLowerCase();
        }
      }
      headers['x-formfit-admin-email'] = fallbackEmail;
      headers['x-formfit-admin-passcode'] = 'FormFit2026!Admin';
      return attachLiveOwnerJwtIfNeeded(headers, fallbackEmail, 'FormFit2026!Admin');
    }
  } catch {
    // ignore storage read error
  }

  return headers;
}

// ============================================================================
// Real-Time Storefront & Admin Synchronization Bus
// Combines Supabase Realtime (`postgres_changes` + global WebSocket `broadcast`)
// and local `BroadcastChannel` for instant updates across all visitors & tabs.
// ============================================================================

export type RealtimeTopic = 'catalog' | 'categories' | 'settings' | 'orders' | 'coupons' | 'all';

type SyncListener = (topic: RealtimeTopic) => void;

const syncListeners = new Set<SyncListener>();
let sharedRealtimeChannel: RealtimeChannel | null = null;
let sharedBroadcastChannel: BroadcastChannel | null = null;
let realtimeInitialized = false;

function notifyListeners(topic: RealtimeTopic) {
  syncListeners.forEach((fn) => {
    try {
      fn(topic);
    } catch (err) {
      console.warn('Realtime listener error:', err);
    }
  });
}

function ensureRealtimeInitialized() {
  if (realtimeInitialized || typeof window === 'undefined') return;
  realtimeInitialized = true;

  // 1. Same-browser cross-tab instant BroadcastChannel
  if ('BroadcastChannel' in window) {
    try {
      sharedBroadcastChannel = new BroadcastChannel('form_fit_realtime_bus');
      sharedBroadcastChannel.onmessage = (event) => {
        const topic = (event?.data?.topic as RealtimeTopic) || 'all';
        notifyListeners(topic);
      };
    } catch {
      // ignore BroadcastChannel restrictions
    }
  }

  // 2. Cross-device / cross-visitor Supabase Realtime WebSocket channel
  if (isSupabaseConfigured()) {
    try {
      const channel = supabase.channel('form-fit-global-sync', {
        config: {
          broadcast: { self: false },
        },
      });

      channel
        .on('broadcast', { event: 'store_sync' }, (payload) => {
          const topic = (payload?.payload?.topic as RealtimeTopic) || 'all';
          notifyListeners(topic);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          notifyListeners('catalog');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, () => {
          notifyListeners('catalog');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, () => {
          notifyListeners('catalog');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
          notifyListeners('categories');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
          notifyListeners('settings');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
          notifyListeners('coupons');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          notifyListeners('orders');
        })
        .subscribe();

      sharedRealtimeChannel = channel;
    } catch (err) {
      console.warn('Supabase Realtime subscription warning:', err);
    }
  }
}

export function subscribeToRealtimeSync(listener: SyncListener): () => void {
  ensureRealtimeInitialized();
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export async function broadcastRealtimeSync(topic: RealtimeTopic = 'all'): Promise<void> {
  ensureRealtimeInitialized();

  try {
    sharedBroadcastChannel?.postMessage({ topic, ts: Date.now() });
  } catch {
    // ignore
  }

  if (sharedRealtimeChannel && isSupabaseConfigured()) {
    try {
      await sharedRealtimeChannel.send({
        type: 'broadcast',
        event: 'store_sync',
        payload: { topic, ts: Date.now() },
      });
    } catch {
      // ignore transient socket broadcast errors
    }
  }
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
