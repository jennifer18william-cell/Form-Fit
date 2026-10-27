import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyNoStoreHeaders,
  getSupabaseEnvConfig,
  PUBLIC_PRODUCT_COLUMNS,
} from './catalogBackend';
import {
  normalizeCategoriesList,
  resolveCategoryForProduct,
} from '../../src/lib/categoryMapping';
import { Category, Product, ProductImage, ProductVariant } from '../../src/types';
import {
  MatchTier,
  StylistApiRequest,
  StylistApiResponse,
  StylistOutfitPiece,
  StylistOutfitSuggestion,
  StylistPreferences,
  StylistProductRecommendation,
  VisualGarmentAnalysis,
  VisualMatchGroups,
} from '../../src/types/stylist';

// ============================================================================
// CONFIGURABLE THRESHOLDS & SECURITY CONSTANTS
// ============================================================================
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB decoded binary limit
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getMatchThresholds() {
  const exact = Math.max(70, Math.min(98, Number(process.env.STYLIST_EXACT_MATCH_THRESHOLD || 82)));
  const strong = Math.max(45, Math.min(exact - 5, Number(process.env.STYLIST_STRONG_MATCH_THRESHOLD || 58)));
  const initialLimit = Math.max(1, Math.min(6, Number(process.env.STYLIST_INITIAL_MATCH_LIMIT || 6)));
  return { exact, strong, initialLimit };
}

// Fast vision & structured JSON cascade (gemini-3.1-flash-lite is primary for low-latency ~2s multimodal vision)
const VISION_AND_JSON_MODELS = [
  { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, wallClockMs: 11000 },
  { model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW, wallClockMs: 11000 },
  { model: 'gemini-flash-latest', thinkingLevel: ThinkingLevel.LOW, wallClockMs: 11000 },
] as const;

interface RateBucket {
  timestamps: number[];
}

const ipRateBuckets = new Map<string, RateBucket>();
const modelCooldownUntil = new Map<string, number>();

// Server-side caches keyed by `${productId}:${imageHash}` so catalog images are visually indexed once
const catalogVisualProfileCache = new Map<string, VisualGarmentAnalysis>();
const catalogPureImageEmbeddingCache = new Map<string, number[]>();
const catalogTextEmbeddingCache = new Map<string, number[]>();

const DISK_VISUAL_CACHE_PATH = path.join(os.tmpdir(), 'formfit_catalog_visual_cache_v1.json');
let diskVisualCacheLoaded = false;

function loadDiskVisualCacheOnce(): void {
  if (diskVisualCacheLoaded) return;
  diskVisualCacheLoaded = true;
  try {
    if (!fs.existsSync(DISK_VISUAL_CACHE_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(DISK_VISUAL_CACHE_PATH, 'utf8'));
    if (raw?.profiles && typeof raw.profiles === 'object') {
      for (const [k, v] of Object.entries(raw.profiles)) {
        if (v && typeof v === 'object') {
          catalogVisualProfileCache.set(k, v as VisualGarmentAnalysis);
        }
      }
    }
    if (raw?.embeddings && typeof raw.embeddings === 'object') {
      for (const [k, v] of Object.entries(raw.embeddings)) {
        if (Array.isArray(v) && v.length > 0) {
          catalogPureImageEmbeddingCache.set(k, v as number[]);
        }
      }
    }
  } catch {
    // Ignore corrupt or missing tmp cache
  }
}

function saveDiskVisualCache(): void {
  try {
    const profiles: Record<string, VisualGarmentAnalysis> = {};
    for (const [k, v] of catalogVisualProfileCache.entries()) {
      profiles[k] = v;
    }
    const embeddings: Record<string, number[]> = {};
    for (const [k, v] of catalogPureImageEmbeddingCache.entries()) {
      embeddings[k] = v;
    }
    fs.writeFileSync(DISK_VISUAL_CACHE_PATH, JSON.stringify({ profiles, embeddings }), 'utf8');
  } catch {
    // Ignore read-only fs errors
  }
}

// ============================================================================
// COLOR & PATTERN TAXONOMY FOR STRICT FASHION MATCHING
// ============================================================================
const COLOR_FAMILIES: Record<string, string[]> = {
  navy: ['navy', 'navy blue', 'midnight blue', 'dark blue', 'indigo', 'ink blue'],
  blue: ['blue', 'cobalt', 'royal blue', 'sky blue', 'baby blue', 'powder blue', 'denim blue', 'azure', 'cyan', 'light blue', 'slate blue', 'teal'],
  black: ['black', 'jet black', 'onyx', 'obsidian', 'pitch black', 'noir', 'carbon'],
  white: ['white', 'pure white', 'optic white', 'chalk', 'snow', 'milk', 'alabaster', 'off-white', 'ivory'],
  beige: ['beige', 'cream', 'ecru', 'sand', 'oatmeal', 'tan', 'camel', 'taupe', 'khaki', 'stone', 'latte', 'nude', 'champagne', 'fawn', 'light tan'],
  grey: ['grey', 'gray', 'charcoal', 'slate', 'ash', 'heather', 'silver', 'graphite', 'smoke'],
  green: ['green', 'olive', 'sage', 'lime', 'emerald', 'forest green', 'mint', 'moss', 'pistachio', 'pine', 'khaki green'],
  brown: ['brown', 'chocolate', 'espresso', 'mocha', 'rust', 'terracotta', 'cognac', 'walnut', 'chestnut', 'coffee', 'umber', 'maroon-brown'],
  red: ['red', 'crimson', 'burgundy', 'maroon', 'wine', 'scarlet', 'cherry', 'brick', 'oxblood', 'ruby'],
  pink: ['pink', 'blush', 'rose', 'magenta', 'fuchsia', 'coral', 'peach', 'salmon', 'mauve', 'dusty pink'],
  purple: ['purple', 'lavender', 'lilac', 'plum', 'violet', 'amethyst', 'grape', 'berry'],
  yellow_orange: ['yellow', 'mustard', 'gold', 'amber', 'ochre', 'orange', 'tangerine', 'apricot', 'lemon', 'butter'],
};

// Adjacent color families receive partial credit instead of a harsh conflict penalty
const ADJACENT_COLOR_FAMILIES: Record<string, string[]> = {
  navy: ['blue'],
  blue: ['navy'],
  white: ['beige'],
  beige: ['white', 'brown'],
  brown: ['beige'],
  black: ['grey'],
  grey: ['black'],
  red: ['pink'],
  pink: ['red'],
};

const COMPLEMENTARY_OUTFIT_COLORS: Record<string, string[]> = {
  beige: ['black', 'white', 'brown', 'green', 'navy', 'blue', 'grey'],
  navy: ['white', 'beige', 'grey', 'brown', 'blue'],
  blue: ['white', 'beige', 'grey', 'black', 'brown', 'navy'],
  black: ['white', 'beige', 'grey', 'green', 'blue', 'red'],
  white: ['black', 'navy', 'blue', 'beige', 'green', 'brown', 'grey'],
  grey: ['black', 'white', 'navy', 'blue', 'green', 'red', 'pink'],
  green: ['beige', 'white', 'black', 'brown', 'navy'],
  brown: ['beige', 'white', 'green', 'blue', 'navy', 'black'],
  red: ['black', 'white', 'navy', 'blue', 'beige', 'grey'],
  pink: ['white', 'grey', 'navy', 'blue', 'beige', 'black'],
  purple: ['white', 'black', 'grey', 'beige'],
  yellow_orange: ['navy', 'blue', 'white', 'black', 'beige', 'brown'],
};

type PatternGroup =
  | 'solid'
  | 'stripes'
  | 'checks'
  | 'floral'
  | 'polka_dots'
  | 'graphic_print'
  | 'abstract_geometric'
  | 'animal_print'
  | 'embroidered_textured';

function normalizePatternGroup(rawPattern: string, detail = ''): PatternGroup {
  const s = `${rawPattern} ${detail}`.toLowerCase();
  if (/\b(stripe|striped|stripes|pinstripe|vertical stripe|horizontal stripe)\b/.test(s)) {
    return 'stripes';
  }
  if (/\b(check|checked|checks|checkered|plaid|gingham|tartan|houndstooth|windowpane|buffalo)\b/.test(s)) {
    return 'checks';
  }
  if (/\b(floral|flower|flowers|botanical|rose|daisy|blossom|floral lace)\b/.test(s)) {
    return 'floral';
  }
  if (/\b(polka|dot|dotted|dots)\b/.test(s)) {
    return 'polka_dots';
  }
  if (/\b(animal|leopard|zebra|cheetah|snake|python|tiger)\b/.test(s)) {
    return 'animal_print';
  }
  if (/\b(graphic|logo|slogan|illustration|typography|cartoon|band|back print|chest print)\b/.test(s)) {
    return 'graphic_print';
  }
  if (/\b(abstract|geometric|paisley|tie-dye|tie dye|camo|camouflage|motif|all-over print|printed|block print)\b/.test(s)) {
    return 'abstract_geometric';
  }
  if (/\b(embroider|embroidered|embroidery|lace| eyelet|cable knit|ribbed|jacquard|waffle|textured)\b/.test(s)) {
    return 'embroidered_textured';
  }
  return 'solid';
}

type GarmentSubcategory =
  | 'button_shirt'
  | 'tshirt_top'
  | 'knit_hoodie'
  | 'ethnic_top'
  | 'outerwear'
  | 'jeans_denim'
  | 'trousers_chinos'
  | 'skirt'
  | 'shorts'
  | 'dress_onepiece'
  | 'sneakers_shoes'
  | 'sandals_heels'
  | 'boots_loafers'
  | 'bag_accessory'
  | 'other';

function normalizeGarmentSubcategory(
  garmentType: string,
  broadRole: string,
  extraText = ''
): GarmentSubcategory {
  const s = `${garmentType} ${extraText}`.toLowerCase();

  if (/\b(dress|gown|maxi|midi|mini dress|sundress|jumpsuit|romper|anarkali|saree|co-ord)\b/.test(s)) {
    return 'dress_onepiece';
  }
  if (/\b(wedge|sandal|sandals|heel|heels|stiletto|mule|mules|pump|pumps|slider|slides|flip-flop)\b/.test(s)) {
    return 'sandals_heels';
  }
  if (/\b(boot|boots|chelsea|loafer|loafers|oxford shoe|derby|brogue|moccasin)\b/.test(s)) {
    return 'boots_loafers';
  }
  if (/\b(sneaker|sneakers|trainer|trainers|running shoe|tennis shoe|lace-up shoe|casual shoe|shoes|footwear)\b/.test(s)) {
    return 'sneakers_shoes';
  }
  if (/\b(bag|tote|handbag|backpack|wallet|belt|cap|hat|sunglass|sunglasses|watch|scarf|jewelry|necklace)\b/.test(s)) {
    return 'bag_accessory';
  }
  if (/\b(jacket|blazer|coat|trench|bomber|windbreaker|cardigan|overcoat|gilet|vest|shacket)\b/.test(s)) {
    return 'outerwear';
  }
  if (/\b(skirt|mini skirt|midi skirt|pleated skirt)\b/.test(s)) {
    return 'skirt';
  }
  if (/\b(short|shorts|bermuda)\b/.test(s)) {
    return 'shorts';
  }
  if (/\b(jean|jeans|denim)\b/.test(s)) {
    return 'jeans_denim';
  }
  if (/\b(trouser|trousers|pant|pants|chino|chinos|cargo|cargos|jogger|joggers|palazzo|legging|leggings)\b/.test(s)) {
    return 'trousers_chinos';
  }
  if (/\b(kurta|kurti|sherwani|nehru|tunic)\b/.test(s)) {
    return 'ethnic_top';
  }
  if (/\b(hoodie|sweatshirt|sweater|pullover|jumper|knitwear)\b/.test(s)) {
    return 'knit_hoodie';
  }
  if (/\b(t-shirt|tshirt|tee|tank|camisole|crop top|polo|henley|jersey)\b/.test(s)) {
    return 'tshirt_top';
  }
  if (/\b(shirt|dress shirt|button-down|button down|button-up|oxford shirt|linen shirt|flannel|blouse|top)\b/.test(s)) {
    return 'button_shirt';
  }

  if (broadRole === 'one_piece') return 'dress_onepiece';
  if (broadRole === 'footwear') return 'sneakers_shoes';
  if (broadRole === 'outerwear') return 'outerwear';
  if (broadRole === 'bottom') return 'trousers_chinos';
  if (broadRole === 'accessory') return 'bag_accessory';
  if (broadRole === 'top') return 'tshirt_top';
  return 'other';
}

function resolvePrimaryColorFamilies(colorText: string): string[] {
  const lower = (colorText || '').toLowerCase().trim();
  if (!lower) return [];
  const hits: string[] = [];
  // Check longer multi-word color terms first (e.g. "navy blue" before "blue")
  for (const [family, synonyms] of Object.entries(COLOR_FAMILIES)) {
    const sorted = [...synonyms].sort((a, b) => b.length - a.length);
    for (const term of sorted) {
      if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) {
        hits.push(family);
        break;
      }
    }
  }
  // If both 'navy' and 'blue' matched because of "navy blue", prioritize 'navy'
  if (hits.includes('navy') && hits.includes('blue') && /\bnavy\b/.test(lower)) {
    return hits.filter((h) => h !== 'blue');
  }
  return hits;
}

// ============================================================================
// SERVER REQUEST, RATE LIMIT & VALIDATION HELPERS
// ============================================================================
function getClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).split(',')[0].trim();
  return req?.socket?.remoteAddress || req?.ip || 'anonymous-client';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (ipRateBuckets.size > 500) {
    for (const [k, bucket] of ipRateBuckets.entries()) {
      const fresh = bucket.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) ipRateBuckets.delete(k);
      else bucket.timestamps = fresh;
    }
  }
  const existing = ipRateBuckets.get(ip) || { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (existing.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = existing.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
    ipRateBuckets.set(ip, existing);
    return { allowed: false, retryAfterSeconds };
  }
  existing.timestamps.push(now);
  ipRateBuckets.set(ip, existing);
  return { allowed: true, retryAfterSeconds: 0 };
}

async function parseJsonBody(req: any): Promise<StylistApiRequest> {
  if (!req) return {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as StylistApiRequest;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as StylistApiRequest;
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8')) as StylistApiRequest;
    } catch {
      return {};
    }
  }
  if (typeof req.on === 'function') {
    const raw = await new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: any) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', () => resolve(''));
    });
    if (raw.trim()) {
      try {
        req.body = JSON.parse(raw.trim());
        return req.body as StylistApiRequest;
      } catch {
        return {};
      }
    }
  }
  return {};
}

function getGeminiClient(timeoutMs = 14000): GoogleGenAI | null {
  const rawKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!rawKey || rawKey === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: {
      timeout: timeoutMs,
      retryOptions: {
        attempts: 1,
      },
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientCapacityError(err: any): boolean {
  const status = Number(err?.status || err?.code || 0);
  const msg = String(err?.message || '');
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('Deadline expired') ||
    msg.includes('high demand') ||
    msg.includes('timeout') ||
    msg.includes('WALL_CLOCK_TIMEOUT') ||
    msg.includes('AbortError') ||
    msg.includes('fetch failed')
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withWallClockTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WALL_CLOCK_TIMEOUT')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateStructuredJsonWithFailover(
  ai: GoogleGenAI,
  contents: any,
  systemInstruction: string,
  responseSchema: any,
  temperature = 0.15
): Promise<any | null> {
  let lastErr: any = null;
  const now = Date.now();

  const availableCandidates = VISION_AND_JSON_MODELS.filter(
    (c) => (modelCooldownUntil.get(c.model) || 0) <= now
  );
  // Never lock out all models simultaneously; always include primary flash-lite if all were recently cooled
  const candidatesToTry =
    availableCandidates.length > 0 ? availableCandidates : [VISION_AND_JSON_MODELS[0]];

  for (let idx = 0; idx < candidatesToTry.length; idx++) {
    const candidate = candidatesToTry[idx];
    const maxAttempts = candidate.model === 'gemini-3.1-flash-lite' ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await withWallClockTimeout(
          ai.models.generateContent({
            model: candidate.model,
            contents,
            config: {
              systemInstruction,
              temperature,
              thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
          candidate.wallClockMs
        );
        modelCooldownUntil.delete(candidate.model);
        const text = (res.text || '').trim();
        if (text) {
          return JSON.parse(text);
        }
      } catch (err: any) {
        lastErr = err;
        if (!isTransientCapacityError(err)) {
          throw err;
        }
        if (attempt < maxAttempts) {
          await sleepMs(1100);
          continue;
        }
        modelCooldownUntil.set(candidate.model, Date.now() + 5_000);
      }
    }
  }

  if (lastErr && !isTransientCapacityError(lastErr)) {
    throw lastErr;
  }
  return null;
}

function validateAndSanitizeImage(
  image: StylistApiRequest['image']
): {
  valid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  base64Data?: string;
  error?: string;
} {
  if (!image) return { valid: true };

  const rawMime = String(image.mimeType || '')
    .trim()
    .toLowerCase();
  const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;

  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      error: 'Unsupported image format. Please upload a JPG, JPEG, PNG, or WebP photo.',
    };
  }

  let cleanedBase64 = String(image.base64Data || '').trim();
  const prefixMatch = cleanedBase64.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (prefixMatch?.[1]) {
    cleanedBase64 = prefixMatch[1].trim();
  }

  if (!cleanedBase64 || cleanedBase64.length < 128) {
    return {
      valid: false,
      error: 'The uploaded image appears empty or corrupted. Please try another photo.',
    };
  }

  let byteLength = 0;
  try {
    byteLength = Buffer.from(cleanedBase64, 'base64').byteLength;
  } catch {
    return {
      valid: false,
      error: 'Invalid image encoding. Please select a valid JPG, PNG, or WebP image.',
    };
  }

  if (byteLength < 256) {
    return {
      valid: false,
      error: 'The selected image is too small to analyze clearly. Please choose a clearer garment photo.',
    };
  }

  if (byteLength > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      error: 'Image exceeds the 6 MB limit. Please upload a smaller image.',
    };
  }

  if (
    (typeof image.width === 'number' && (image.width < 40 || image.width > 8000)) ||
    (typeof image.height === 'number' && (image.height < 40 || image.height > 8000))
  ) {
    return {
      valid: false,
      error: 'Image dimensions must be between 40px and 8000px.',
    };
  }

  return {
    valid: true,
    mimeType: normalizedMime as 'image/jpeg' | 'image/png' | 'image/webp',
    base64Data: cleanedBase64,
  };
}

// ============================================================================
// CATALOG RETRIEVAL & PRODUCT IMAGE EXTRACTION (SUPPORTS DATA URIS & HTTP URLS)
// ============================================================================
interface EnrichedCatalogItem {
  product: Product;
  effectivePrice: number;
  inStock: boolean;
  totalStock: number;
  availableSizes: string[];
  availableColors: Array<{ name: string; hex?: string }>;
  broadRole: 'top' | 'bottom' | 'one_piece' | 'outerwear' | 'footwear' | 'accessory' | 'other';
  searchableText: string;
  colorFamilies: string[];
  mainImageUrl: string;
  hasRealCatalogImage: boolean;
  imageSignature: string;
  visualProfile?: VisualGarmentAnalysis;
}

function inferBroadRoleFromMetadata(product: Product): EnrichedCatalogItem['broadRole'] {
  const hay = [
    product.name,
    product.category?.name,
    product.category?.slug,
    product.gender_collection,
    product.short_desc,
    product.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    product.gender_collection === 'Footwear' ||
    /\b(shoe|shoes|sneaker|sneakers|loafer|loafers|boot|boots|sandal|sandals|wedge|wedges|heel|heels|footwear|slides|sliders|mule|mules)\b/.test(
      hay
    )
  ) {
    return 'footwear';
  }
  if (
    product.gender_collection === 'Accessories' ||
    /\b(bag|tote|backpack|wallet|belt|cap|hat|beanie|watch|sunglass|sunglasses|scarf|jewelry|necklace|bracelet|ring|earring|socks|accessory|accessories)\b/.test(
      hay
    )
  ) {
    return 'accessory';
  }
  if (/\b(dress|gown|jumpsuit|romper|co-ord|coord|suit set|kurta set|anarkali|saree)\b/.test(hay)) {
    return 'one_piece';
  }
  if (/\b(jacket|coat|blazer|cardigan|windbreaker|bomber|trench|shacket|overcoat|gilet|vest)\b/.test(hay)) {
    return 'outerwear';
  }
  if (
    /\b(trouser|trousers|pant|pants|jean|jeans|denim|cargo|cargos|jogger|joggers|short|shorts|skirt|chino|chinos|legging|leggings|culotte|palazzo|bottom)\b/.test(
      hay
    )
  ) {
    return 'bottom';
  }
  if (
    /\b(shirt|t-shirt|tshirt|tee|polo|top|blouse|hoodie|sweatshirt|sweater|knit|crop|kurta|kurtis|kurti|tank|camisole|tunic|henley|jersey)\b/.test(
      hay
    )
  ) {
    return 'top';
  }
  return 'other';
}

/**
 * Extracts inline image bytes from BOTH `data:image/...;base64,...` data URIs AND `http(s)://` URLs.
 */
async function resolveProductImageInlinePart(
  imageUrl: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!imageUrl) return null;

  // 1. Handle data:image/*;base64,... URIs stored directly in Supabase product_images
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    const rawMime = match[1].toLowerCase();
    const normMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    if (!ALLOWED_MIME_TYPES.has(normMime)) return null;
    const data = match[2].trim();
    if (data.length < 128) return null;
    return {
      inlineData: {
        mimeType: normMime,
        data,
      },
    };
  }

  // 2. Handle HTTP(S) Supabase Storage or external product image URLs
  if (!imageUrl.startsWith('http')) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const resp = await fetch(imageUrl, { signal: controller.signal });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const normMime = contentType === 'image/jpg' ? 'image/jpeg' : contentType;
    if (!ALLOWED_MIME_TYPES.has(normMime)) return null;
    const arrayBuf = await resp.arrayBuffer();
    if (arrayBuf.byteLength < 256 || arrayBuf.byteLength > 4 * 1024 * 1024) return null;
    return {
      inlineData: {
        mimeType: normMime,
        data: Buffer.from(arrayBuf).toString('base64'),
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sanitizePublicProduct(raw: any, categoriesList: Category[], supabaseOrigin: string): EnrichedCatalogItem {
  const joinedCat = Array.isArray(raw?.category) ? raw.category[0] : raw?.category;
  const resolvedCat = resolveCategoryForProduct(raw.category_id, joinedCat, categoriesList);

  const rawImages: ProductImage[] = Array.isArray(raw.images) ? raw.images : [];
  const validImages = rawImages
    .filter((img) => {
      if (!img?.url) return false;
      const u = String(img.url).trim();
      if (!u || u.startsWith('blob:')) return false;
      // Ignore bare directory paths without a filename
      if (u.endsWith('/product-images/products/') || u.endsWith('/products')) return false;
      return true;
    })
    .map((img, idx) => {
      let url = String(img.url).trim();
      if (url.startsWith('/storage/v1/object/public/') && supabaseOrigin) {
        url = `${supabaseOrigin}${url}`;
      }
      return {
        id: img.id || crypto.randomUUID(),
        product_id: raw.id,
        storage_path: img.storage_path,
        url,
        is_main: Boolean(img.is_main ?? idx === 0),
        alt_text: img.alt_text || raw.name,
        display_order: img.display_order ?? idx,
      };
    })
    .sort((a, b) => {
      if (Boolean(a.is_main) !== Boolean(b.is_main)) return a.is_main ? -1 : 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });

  const hasRealCatalogImage = validImages.length > 0;
  const fallbackUrl =
    resolvedCat?.image_url ||
    'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800';

  const finalImages: ProductImage[] = hasRealCatalogImage
    ? validImages
    : [
        {
          id: crypto.randomUUID(),
          product_id: raw.id,
          url: fallbackUrl,
          is_main: true,
          alt_text: raw.name,
          display_order: 0,
        },
      ];

  const rawVariants: ProductVariant[] = Array.isArray(raw.variants) ? raw.variants : [];
  const activeVariants = rawVariants
    .filter((v) => v.is_active !== false)
    .map((v) => ({
      id: v.id,
      product_id: raw.id,
      sku: v.sku || `${raw.slug || 'ITEM'}-${v.size || 'OS'}`,
      size: v.size || 'One Size',
      color: v.color || 'Standard',
      color_hex: v.color_hex || undefined,
      price_override: typeof v.price_override === 'number' ? Number(v.price_override) : undefined,
      stock_quantity: Math.max(0, Number(v.stock_quantity ?? 0)),
      variant_image_url: v.variant_image_url || undefined,
      is_active: true,
    }));

  const regularPrice = Number(raw.regular_price ?? 0);
  const salePrice =
    raw.sale_price !== null && raw.sale_price !== undefined && Number(raw.sale_price) > 0
      ? Number(raw.sale_price)
      : undefined;
  const effectivePrice = salePrice && salePrice < regularPrice ? salePrice : regularPrice;

  const inStockVariants = activeVariants.filter((v) => v.stock_quantity > 0);
  const totalStock = inStockVariants.reduce((sum, v) => sum + v.stock_quantity, 0);
  const inStock = totalStock > 0;

  const availableSizes = Array.from(
    new Set(inStockVariants.map((v) => (v.size || '').trim()).filter(Boolean))
  );

  const colorMap = new Map<string, string | undefined>();
  for (const v of inStockVariants.length > 0 ? inStockVariants : activeVariants) {
    const cName = (v.color || '').trim();
    if (cName && !colorMap.has(cName.toLowerCase())) {
      colorMap.set(cName.toLowerCase(), v.color_hex);
    }
  }

  const availableColors = Array.from(colorMap.entries()).map(([lowerName, hex]) => ({
    name: lowerName.replace(/\b\w/g, (ch) => ch.toUpperCase()),
    hex,
  }));

  const cleanProduct: Product = {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    sku: raw.sku || undefined,
    short_desc: raw.short_desc || undefined,
    description: raw.description || undefined,
    category_id: resolvedCat?.id || raw.category_id || undefined,
    gender_collection: raw.gender_collection || 'Unisex',
    regular_price: regularPrice,
    sale_price: salePrice,
    fabric_material: raw.fabric_material || undefined,
    fit: raw.fit || undefined,
    care_instructions: raw.care_instructions || undefined,
    status: 'published',
    featured: Boolean(raw.featured),
    seo_title: raw.seo_title || undefined,
    seo_description: raw.seo_description || undefined,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
    category: resolvedCat,
    images: finalImages,
    variants: activeVariants,
  };

  const colorNamesText = availableColors.map((c) => c.name).join(' ');
  const searchableText = [
    cleanProduct.name,
    cleanProduct.category?.name,
    cleanProduct.gender_collection,
    cleanProduct.short_desc,
    cleanProduct.description,
    cleanProduct.fabric_material,
    cleanProduct.fit,
    colorNamesText,
    availableSizes.join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  const mainImageUrl = finalImages[0]?.url || '';
  const imageSignature = crypto
    .createHash('sha1')
    .update(hasRealCatalogImage ? mainImageUrl : `no-image:${raw.updated_at || ''}`)
    .digest('hex')
    .slice(0, 14);

  return {
    product: cleanProduct,
    effectivePrice,
    inStock,
    totalStock,
    availableSizes,
    availableColors,
    broadRole: inferBroadRoleFromMetadata(cleanProduct),
    searchableText,
    colorFamilies: resolvePrimaryColorFamilies(`${cleanProduct.name} ${cleanProduct.short_desc || ''} ${colorNamesText}`),
    mainImageUrl,
    hasRealCatalogImage,
    imageSignature,
  };
}

async function fetchPublishedCatalog(): Promise<{
  ok: boolean;
  items: EnrichedCatalogItem[];
  error?: string;
}> {
  const cfg = getSupabaseEnvConfig();
  if (!cfg.isConfigured || !cfg.anonKey) {
    return {
      ok: false,
      items: [],
      error:
        'Shared Supabase product database is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in your environment.',
    };
  }

  const publicClient = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [catRes, prodRes] = await Promise.all([
    publicClient.from('categories').select('*').order('display_order', { ascending: true }),
    publicClient
      .from('products')
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
  ]);

  if (prodRes.error) {
    return {
      ok: false,
      items: [],
      error: `Unable to read published catalog from Supabase (${prodRes.error.message}).`,
    };
  }

  const normalizedCategories = normalizeCategoriesList(catRes.data || []);
  const rows = Array.isArray(prodRes.data) ? prodRes.data : [];
  const items = rows
    .filter((row: any) => row && row.status === 'published')
    .map((row: any) => sanitizePublicProduct(row, normalizedCategories, cfg.url));

  return { ok: true, items };
}

// ============================================================================
// AI VISION GARMENT ANALYSIS (SHARED SCHEMA FOR UPLOADED & CATALOG IMAGES)
// ============================================================================
const VISION_GARMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isClothingDetected: {
      type: Type.BOOLEAN,
      description: 'True if clothing, footwear, or fashion accessories are visible.',
    },
    summary: {
      type: Type.STRING,
      description: 'Concise 1-sentence description of the garment, its actual colors, and its pattern.',
    },
    garmentType: {
      type: Type.STRING,
      description:
        'Specific garment type e.g. button-down shirt, T-shirt, polo shirt, hoodie, jeans, trousers, skirt, maxi dress, mini dress, kurta, jacket, sneakers, wedge sandals, loafers, handbag.',
    },
    broadRole: {
      type: Type.STRING,
      description: 'Strictly one of: top, bottom, one_piece, outerwear, footwear, accessory, other.',
    },
    genderFit: {
      type: Type.STRING,
      description: 'Men, Women, or Unisex.',
    },
    primaryColor: {
      type: Type.STRING,
      description:
        'The primary dominant color of the GARMENT ITSELF (ignore studio wall, floor, hanger, skin, or street background). E.g. navy blue, beige, black, white, red, olive green.',
    },
    secondaryColors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Actual secondary or pattern colors ON THE GARMENT ITSELF (e.g. ["white"] for white stripes on a navy shirt, ["black"] for red-and-black checks, [] if solid plain single-color). Never include background colors.',
    },
    colorDistributionAndContrast: {
      type: Type.STRING,
      description: 'Color balance and contrast e.g. solid monochrome low contrast, 85% navy base with high-contrast thin white stripes, 50/50 red-and-black check.',
    },
    pattern: {
      type: Type.STRING,
      description:
        'Strictly one of: plain/solid, stripes, checks, plaid, floral, polka dots, abstract print, graphic print, geometric, animal print, embroidered, textured.',
    },
    patternScaleAndDetail: {
      type: Type.STRING,
      description:
        'Pattern scale, direction, or surface detail e.g. plain smooth weave, thin vertical pinstripes, medium buffalo checks, small ditsy floral print, floral lace overlay, bold chest graphic.',
    },
    collarAndNeckline: {
      type: Type.STRING,
      description: 'Collar/neckline e.g. spread collar, button-down collar, crew neck, V-neck, wrap neckline, round neck, or shoe closure.',
    },
    sleeves: {
      type: Type.STRING,
      description: 'Sleeve type e.g. long sleeves with buttoned cuffs, oversized half sleeves, ruffle short sleeves, sleeveless, or shoe cut.',
    },
    silhouetteAndFit: {
      type: Type.STRING,
      description: 'Fit and cut e.g. slim fit, oversized boxy fit, relaxed regular fit, A-line maxi, high-waist straight leg, low-top sneaker, platform wedge.',
    },
    fabricAppearance: {
      type: Type.STRING,
      description: 'Visible fabric/material appearance e.g. crisp cotton poplin, heavyweight cotton jersey, denim twill, chiffon/crepe, woven jute & floral lace, smooth faux leather.',
    },
    styleCategory: {
      type: Type.STRING,
      description: 'Overall style e.g. Minimalist, Smart Casual, Streetwear, Formal, Ethnic Fusion, Resort/Summer, Athleisure.',
    },
    designDetails: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific visible details: buttons, pockets, logos, graphics, waist tie, pleats, ruffles, lace-up closure, ankle strap.',
    },
    outfitPairingIdeas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 complementary items that pair well with this piece.',
    },
  },
  required: [
    'isClothingDetected',
    'summary',
    'garmentType',
    'broadRole',
    'genderFit',
    'primaryColor',
    'secondaryColors',
    'colorDistributionAndContrast',
    'pattern',
    'patternScaleAndDetail',
    'collarAndNeckline',
    'sleeves',
    'silhouetteAndFit',
    'fabricAppearance',
    'styleCategory',
    'designDetails',
    'outfitPairingIdeas',
  ],
};

function normalizeVisionAnalysisObject(parsed: any): VisualGarmentAnalysis {
  const allowedRoles = new Set(['top', 'bottom', 'one_piece', 'outerwear', 'footwear', 'accessory', 'other']);
  const rawRole = String(parsed.broadRole || '').toLowerCase().trim();
  const garmentType = String(parsed.garmentType || 'Apparel').trim();
  const garmentSubcategory = normalizeGarmentSubcategory(
    garmentType,
    rawRole,
    `${parsed.summary || ''} ${parsed.silhouetteAndFit || ''}`
  );

  let broadRole: VisualGarmentAnalysis['broadRole'] = allowedRoles.has(rawRole)
    ? (rawRole as VisualGarmentAnalysis['broadRole'])
    : 'other';

  // Ensure broadRole is 100% consistent with specific garmentSubcategory
  if (garmentSubcategory === 'dress_onepiece') broadRole = 'one_piece';
  else if (
    garmentSubcategory === 'sneakers_shoes' ||
    garmentSubcategory === 'sandals_heels' ||
    garmentSubcategory === 'boots_loafers'
  ) {
    broadRole = 'footwear';
  } else if (garmentSubcategory === 'bag_accessory') broadRole = 'accessory';
  else if (garmentSubcategory === 'outerwear') broadRole = 'outerwear';
  else if (
    garmentSubcategory === 'jeans_denim' ||
    garmentSubcategory === 'trousers_chinos' ||
    garmentSubcategory === 'skirt' ||
    garmentSubcategory === 'shorts'
  ) {
    broadRole = 'bottom';
  } else if (
    garmentSubcategory === 'button_shirt' ||
    garmentSubcategory === 'tshirt_top' ||
    garmentSubcategory === 'knit_hoodie' ||
    garmentSubcategory === 'ethnic_top'
  ) {
    broadRole = 'top';
  }

  const primaryColor = String(parsed.primaryColor || '').trim() || 'Neutral';
  const secondaryColors = Array.isArray(parsed.secondaryColors)
    ? parsed.secondaryColors
        .map((c: any) => String(c || '').trim())
        .filter((c: string) => Boolean(c) && c.toLowerCase() !== 'none' && c.toLowerCase() !== 'null')
        .slice(0, 3)
    : [];

  const dominantColors = Array.from(
    new Set([primaryColor, ...secondaryColors].filter(Boolean))
  );

  const pattern = String(parsed.pattern || 'plain/solid').trim().toLowerCase();
  const patternScaleAndDetail = String(parsed.patternScaleAndDetail || pattern).trim();
  const collarAndNeckline = String(parsed.collarAndNeckline || '').trim();
  const sleeves = String(parsed.sleeves || '').trim();

  return {
    isClothingDetected: Boolean(parsed.isClothingDetected),
    summary: String(parsed.summary || `${primaryColor} ${garmentType}`).trim(),
    garmentType,
    garmentSubcategory,
    broadRole,
    genderFit: String(parsed.genderFit || 'Unisex').trim(),
    primaryColor,
    secondaryColors,
    dominantColors,
    colorCombination:
      secondaryColors.length > 0
        ? `${primaryColor} with ${secondaryColors.join(', ')}`
        : `Solid ${primaryColor}`,
    colorDistributionAndContrast: String(parsed.colorDistributionAndContrast || '').trim(),
    pattern,
    patternScaleAndDetail,
    patternOrPrint:
      pattern === 'plain/solid'
        ? 'Plain / Solid'
        : `${capitalizeWords(pattern)}${patternScaleAndDetail && patternScaleAndDetail.toLowerCase() !== pattern ? ` (${patternScaleAndDetail})` : ''}`,
    fabricAppearance: String(parsed.fabricAppearance || 'Woven / Knit').trim(),
    silhouetteAndFit: String(parsed.silhouetteAndFit || 'Regular fit').trim(),
    collarAndNeckline,
    sleeves,
    sleeveAndNeckline: [collarAndNeckline, sleeves].filter(Boolean).join(' · ') || 'Standard cut',
    styleCategory: String(parsed.styleCategory || 'Contemporary').trim(),
    designDetails: Array.isArray(parsed.designDetails)
      ? parsed.designDetails.map(String).filter(Boolean).slice(0, 7)
      : [],
    outfitPairingIdeas: Array.isArray(parsed.outfitPairingIdeas)
      ? parsed.outfitPairingIdeas.map(String).filter(Boolean).slice(0, 4)
      : [],
  };
}

async function analyzeGarmentImageWithVision(
  ai: GoogleGenAI,
  mimeType: string,
  base64Data: string,
  contextHint = ''
): Promise<VisualGarmentAnalysis | null> {
  const parsed = await generateStructuredJsonWithFailover(
    ai,
    {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            `Carefully inspect ONLY the primary fashion garment/footwear/accessory worn or displayed in this image.` +
            (contextHint ? ` Context: ${contextHint}.` : '') +
            ` Identify the exact garment type, actual garment primary and secondary colors (strictly ignoring walls, floors, studio backdrops, skin, or secondary outfit pieces unless part of a one-piece), exact pattern (plain/solid, stripes, checks, plaid, floral, polka dots, abstract print, graphic print, geometric, animal print, embroidered, or textured), pattern scale/direction, collar, sleeves, silhouette/fit, design details, and fabric appearance.`,
        },
      ],
    },
    'You are a precision computer-vision fashion attribute extractor for Form & Fit. Report ONLY what is visually present on the main garment itself. Never confuse background colors with garment colors. Distinguish plain/solid vs stripes vs checks/plaid vs floral vs graphic print accurately. If no clothing, footwear, or fashion accessory is visible at all, set isClothingDetected to false.',
    VISION_GARMENT_SCHEMA,
    0.1
  );

  if (!parsed) return null;
  return normalizeVisionAnalysisObject(parsed);
}

// ============================================================================
// EMBEDDINGS & CATALOG VISUAL INDEXING
// ============================================================================
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

async function embedSingleImageBytes(
  ai: GoogleGenAI,
  mimeType: string,
  base64Data: string
): Promise<number[] | null> {
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [{ inlineData: { mimeType, data: base64Data } }],
    });
    const vec = res.embeddings?.[0]?.values;
    return vec && vec.length > 0 ? vec : null;
  } catch {
    return null;
  }
}

/**
 * Ensures every published catalog item with a usable image has:
 * 1) A cached AI Vision profile extracted from its actual product photo (so generic titles or default variant colors never mislead matching).
 * 2) A cached pure image embedding vector from gemini-embedding-2-preview for true image-to-image visual comparison.
 */
async function enrichCatalogWithVisualIntelligence(
  ai: GoogleGenAI,
  catalog: EnrichedCatalogItem[]
): Promise<void> {
  loadDiskVisualCacheOnce();
  const imagedItems = catalog.filter((item) => item.hasRealCatalogImage);

  // Process uncached catalog images in gentle pairs (concurrency=2) so cold start never spikes Gemini RPM
  const uncached = imagedItems
    .filter((item) => {
      const key = `${item.product.id}:${item.imageSignature}`;
      return !catalogVisualProfileCache.has(key) || !catalogPureImageEmbeddingCache.has(key);
    })
    .slice(0, 12);

  if (uncached.length > 0) {
    let cacheMutated = false;
    for (let i = 0; i < uncached.length; i += 2) {
      const batch = uncached.slice(i, i + 2);
      await Promise.all(
        batch.map(async (item) => {
          const key = `${item.product.id}:${item.imageSignature}`;
          const imgPart = await resolveProductImageInlinePart(item.mainImageUrl);
          if (!imgPart) return;

          if (!catalogVisualProfileCache.has(key)) {
            const profile = await analyzeGarmentImageWithVision(
              ai,
              imgPart.inlineData.mimeType,
              imgPart.inlineData.data,
              `Catalog title: "${item.product.name}", category: "${item.product.category?.name || item.product.gender_collection}", note: "${item.product.short_desc || ''}"`
            );
            if (profile) {
              catalogVisualProfileCache.set(key, profile);
              cacheMutated = true;
            }
          }

          if (!catalogPureImageEmbeddingCache.has(key)) {
            const vec = await embedSingleImageBytes(
              ai,
              imgPart.inlineData.mimeType,
              imgPart.inlineData.data
            );
            if (vec) {
              catalogPureImageEmbeddingCache.set(key, vec);
              cacheMutated = true;
            }
          }
        })
      );
    }
    if (cacheMutated) {
      saveDiskVisualCache();
    }
  }

  for (const item of catalog) {
    const key = `${item.product.id}:${item.imageSignature}`;
    const cachedProfile = catalogVisualProfileCache.get(key);
    if (cachedProfile) {
      item.visualProfile = cachedProfile;
      // Trust visual garment role if metadata was generic
      if (cachedProfile.broadRole !== 'other') {
        item.broadRole = cachedProfile.broadRole;
      }
      const visualColorFams = resolvePrimaryColorFamilies(
        `${cachedProfile.primaryColor} ${cachedProfile.secondaryColors.join(' ')}`
      );
      if (visualColorFams.length > 0) {
        item.colorFamilies = visualColorFams;
      }
    }
  }
}

// ============================================================================
// STRICT 6-PRIORITY VISUAL MATCHING & FILTERING ENGINE
// ============================================================================
interface EvaluatedVisualCandidate {
  item: EnrichedCatalogItem;
  finalScore: number;
  categoryCompatible: boolean;
  exactSubtypeMatch: boolean;
  colorStatus: 'exact' | 'adjacent' | 'conflict';
  patternStatus: 'exact' | 'related' | 'conflict';
  visualCosine: number;
  matchedTraits: string[];
  conflictTraits: string[];
  matchTier: MatchTier;
  explanation: string;
}

function isBroadCategoryCompatible(
  refRole: VisualGarmentAnalysis['broadRole'],
  candRole: EnrichedCatalogItem['broadRole']
): boolean {
  if (refRole === 'other' || candRole === 'other') return false;
  if (refRole === candRole) return true;
  // Allow shacket/overshirt cross-check only between top and outerwear
  if (
    (refRole === 'outerwear' && candRole === 'top') ||
    (refRole === 'top' && candRole === 'outerwear')
  ) {
    return false;
  }
  return false;
}

function evaluateCandidateAgainstReference(
  ref: VisualGarmentAnalysis,
  item: EnrichedCatalogItem,
  queryImageVector: number[] | null
): EvaluatedVisualCandidate {
  const matchedTraits: string[] = [];
  const conflictTraits: string[] = [];

  // Exclude items lacking a usable product image or out of stock
  if (!item.hasRealCatalogImage || !item.inStock) {
    return {
      item,
      finalScore: 0,
      categoryCompatible: false,
      exactSubtypeMatch: false,
      colorStatus: 'conflict',
      patternStatus: 'conflict',
      visualCosine: 0,
      matchedTraits: [],
      conflictTraits: [!item.hasRealCatalogImage ? 'missing product image' : 'out of stock'],
      matchTier: 'alternative_style',
      explanation: '',
    };
  }

  const candProfile = item.visualProfile;
  const candRole = candProfile?.broadRole && candProfile.broadRole !== 'other' ? candProfile.broadRole : item.broadRole;

  // --------------------------------------------------------------------------
  // PRIORITY 1: Garment Category & Subcategory Compatibility
  // --------------------------------------------------------------------------
  const categoryCompatible = isBroadCategoryCompatible(ref.broadRole, candRole);
  const refSub =
    (ref.garmentSubcategory as GarmentSubcategory) ||
    normalizeGarmentSubcategory(ref.garmentType, ref.broadRole, ref.summary);
  const candSub = candProfile
    ? (candProfile.garmentSubcategory as GarmentSubcategory) ||
      normalizeGarmentSubcategory(candProfile.garmentType, candRole, candProfile.summary)
    : normalizeGarmentSubcategory(item.product.name, candRole, item.searchableText);

  const exactSubtypeMatch = categoryCompatible && refSub === candSub;

  let score = 0;
  if (!categoryCompatible) {
    score -= 60;
    conflictTraits.push(`different garment category (${candProfile?.garmentType || item.product.name})`);
  } else if (exactSubtypeMatch) {
    score += 26;
    matchedTraits.push(`${(candProfile?.garmentType || item.product.name).toLowerCase()} silhouette`);
  } else {
    // Same broad role, different subtype (e.g., T-shirt vs Dress Shirt, or Sneakers vs Wedge Sandals)
    score += 6;
    conflictTraits.push(
      `${candProfile?.garmentType || item.product.name} instead of ${ref.garmentType.toLowerCase()}`
    );
  }

  // --------------------------------------------------------------------------
  // PRIORITY 2: Primary & Secondary Color Similarity (Heavy Penalty on Conflict)
  // --------------------------------------------------------------------------
  const refPrimaryFams = resolvePrimaryColorFamilies(ref.primaryColor);
  const refSecondaryFams = resolvePrimaryColorFamilies(ref.secondaryColors.join(' '));

  const candPrimaryText = candProfile
    ? candProfile.primaryColor
    : `${item.product.name} ${item.product.short_desc || ''}`;
  const candSecondaryText = candProfile ? candProfile.secondaryColors.join(' ') : '';
  const candPrimaryFams = resolvePrimaryColorFamilies(candPrimaryText);
  const candSecondaryFams = resolvePrimaryColorFamilies(candSecondaryText);
  const allCandColorFams = Array.from(new Set([...candPrimaryFams, ...candSecondaryFams]));

  let colorStatus: 'exact' | 'adjacent' | 'conflict' = 'conflict';

  const exactPrimaryOverlap = refPrimaryFams.some((f) => candPrimaryFams.includes(f));
  const rawNameMatch =
    candProfile &&
    ref.primaryColor.toLowerCase().trim() === candProfile.primaryColor.toLowerCase().trim();

  const adjacentPrimaryOverlap = refPrimaryFams.some((rf) =>
    (ADJACENT_COLOR_FAMILIES[rf] || []).some((adj) => candPrimaryFams.includes(adj))
  );
  const swappedPrimarySecondary =
    refPrimaryFams.some((f) => candSecondaryFams.includes(f)) ||
    refSecondaryFams.some((f) => candPrimaryFams.includes(f));

  if (exactPrimaryOverlap || rawNameMatch) {
    colorStatus = 'exact';
    score += 26;
    matchedTraits.push(`${candProfile?.primaryColor || ref.primaryColor} color`);

    // Check secondary color alignment when reference has prominent accent/pattern colors
    if (refSecondaryFams.length > 0) {
      const secHit = refSecondaryFams.some((sf) => allCandColorFams.includes(sf));
      if (secHit) {
        score += 8;
        matchedTraits.push(`${ref.secondaryColors[0]} accent`);
      } else {
        score -= 6;
      }
    }
  } else if (adjacentPrimaryOverlap || swappedPrimarySecondary) {
    colorStatus = 'adjacent';
    score += 12;
    matchedTraits.push(`related ${candProfile?.primaryColor || 'tonal'} shade`);
  } else {
    colorStatus = 'conflict';
    score -= 26;
    conflictTraits.push(
      `${candProfile?.primaryColor || 'different'} color instead of ${ref.primaryColor}`
    );
  }

  // --------------------------------------------------------------------------
  // PRIORITY 3: Pattern Similarity (Heavy Penalty on Conflict)
  // --------------------------------------------------------------------------
  const refPatGroup = normalizePatternGroup(ref.pattern, ref.patternScaleAndDetail);
  const candPatGroup = candProfile
    ? normalizePatternGroup(candProfile.pattern, candProfile.patternScaleAndDetail)
    : normalizePatternGroup(item.searchableText);

  let patternStatus: 'exact' | 'related' | 'conflict' = 'conflict';

  if (refPatGroup === candPatGroup) {
    patternStatus = 'exact';
    score += 22;
    matchedTraits.push(
      refPatGroup === 'solid'
        ? 'plain solid finish'
        : `${ref.patternScaleAndDetail || ref.pattern} pattern`
    );

    // Extra precision for stripe/check scale & orientation (e.g. vertical vs horizontal)
    const refDetailLower = (ref.patternScaleAndDetail || '').toLowerCase();
    const candDetailLower = (candProfile?.patternScaleAndDetail || '').toLowerCase();
    if (refPatGroup === 'stripes') {
      if (
        (refDetailLower.includes('vertical') && candDetailLower.includes('horizontal')) ||
        (refDetailLower.includes('horizontal') && candDetailLower.includes('vertical'))
      ) {
        score -= 8;
      } else if (
        (refDetailLower.includes('vertical') && candDetailLower.includes('vertical')) ||
        (refDetailLower.includes('thin') && candDetailLower.includes('thin'))
      ) {
        score += 4;
      }
    }
  } else if (
    (refPatGroup === 'solid' && candPatGroup === 'embroidered_textured') ||
    (refPatGroup === 'embroidered_textured' && candPatGroup === 'solid') ||
    (refPatGroup === 'graphic_print' && candPatGroup === 'abstract_geometric') ||
    (refPatGroup === 'abstract_geometric' && candPatGroup === 'graphic_print') ||
    (refPatGroup === 'floral' && candPatGroup === 'embroidered_textured' &&
      (candProfile?.patternScaleAndDetail || '').toLowerCase().includes('floral'))
  ) {
    patternStatus = 'related';
    score += 10;
  } else {
    patternStatus = 'conflict';
    score -= 22;
    conflictTraits.push(
      `${candProfile?.pattern || candPatGroup.replace('_', ' ')} instead of ${ref.pattern}`
    );
  }

  // --------------------------------------------------------------------------
  // PRIORITY 4: Design Details & Silhouette (-8 to +12 pts)
  // --------------------------------------------------------------------------
  const refDetailTokens = new Set(
    tokenizeWords(
      `${ref.collarAndNeckline || ''} ${ref.sleeves || ''} ${ref.silhouetteAndFit} ${(ref.designDetails || []).join(' ')}`
    )
  );
  const candDetailText = candProfile
    ? `${candProfile.collarAndNeckline || ''} ${candProfile.sleeves || ''} ${candProfile.silhouetteAndFit} ${(candProfile.designDetails || []).join(' ')}`
    : `${item.product.fit || ''} ${item.searchableText}`;
  const candDetailTokens = tokenizeWords(candDetailText);

  let detailOverlap = 0;
  const matchedDetailWords: string[] = [];
  for (const tok of candDetailTokens) {
    if (refDetailTokens.has(tok)) {
      detailOverlap++;
      if (matchedDetailWords.length < 2) matchedDetailWords.push(tok);
    }
  }
  score += Math.min(12, detailOverlap * 3);
  if (matchedDetailWords.length > 0) {
    matchedTraits.push(`${matchedDetailWords.join(' ')} detail`);
  }

  // Fit conflict check (e.g. oversized streetwear tee vs slim formal fit)
  const refFitLower = ref.silhouetteAndFit.toLowerCase();
  const candFitLower = (candProfile?.silhouetteAndFit || item.product.fit || '').toLowerCase();
  if (
    (refFitLower.includes('oversized') && candFitLower.includes('slim')) ||
    (refFitLower.includes('slim') && candFitLower.includes('oversized'))
  ) {
    score -= 8;
  }

  // --------------------------------------------------------------------------
  // PRIORITY 5: Pure Visual Image Similarity via Embeddings (0 to +14 pts)
  // --------------------------------------------------------------------------
  const candImgVec = catalogPureImageEmbeddingCache.get(`${item.product.id}:${item.imageSignature}`);
  let visualCosine = 0;
  if (queryImageVector && candImgVec && queryImageVector.length === candImgVec.length) {
    visualCosine = cosineSimilarity(queryImageVector, candImgVec);
    // Typical image-to-image cosine range on Gemini Embedding 2 is ~0.50 (unrelated) to ~0.95 (identical)
    const normalizedVisual = Math.max(0, Math.min(1, (visualCosine - 0.56) / 0.36));
    score += Math.round(normalizedVisual * 14);
  }

  // --------------------------------------------------------------------------
  // PRIORITY 6: Fabric Appearance & Style Compatibility (0 to +6 pts)
  // --------------------------------------------------------------------------
  const refFabTokens = tokenizeWords(`${ref.fabricAppearance} ${ref.styleCategory}`);
  const candFabText = `${candProfile?.fabricAppearance || item.product.fabric_material || ''} ${candProfile?.styleCategory || ''}`.toLowerCase();
  let fabHits = 0;
  for (const t of refFabTokens) {
    if (candFabText.includes(t)) fabHits++;
  }
  score += Math.min(6, fabHits * 3);

  // --------------------------------------------------------------------------
  // HARD CEILINGS FOR ACCURACY (Never promote wrong category, color, or pattern!)
  // --------------------------------------------------------------------------
  if (!categoryCompatible) {
    score = Math.min(score, 10);
  } else if (!exactSubtypeMatch) {
    score = Math.min(score, 48);
  } else if (colorStatus === 'conflict' || patternStatus === 'conflict') {
    // Same garment type, but wrong primary color OR wrong pattern (e.g. black floral dress vs white blue dress, or striped navy shirt vs plain navy shirt)
    score = Math.min(score, 52);
  }

  const finalScore = Math.max(0, Math.min(99, Math.round(score)));
  const { exact: exactThreshold, strong: strongThreshold } = getMatchThresholds();

  let matchTier: MatchTier = 'alternative_style';
  if (
    finalScore >= exactThreshold &&
    exactSubtypeMatch &&
    colorStatus === 'exact' &&
    patternStatus === 'exact'
  ) {
    matchTier = 'exact_match';
  } else if (finalScore >= strongThreshold && categoryCompatible) {
    matchTier = 'very_similar';
  }

  const explanation = buildCandidateExplanation(
    ref,
    candProfile,
    item,
    matchTier,
    matchedTraits,
    conflictTraits
  );

  return {
    item,
    finalScore,
    categoryCompatible,
    exactSubtypeMatch,
    colorStatus,
    patternStatus,
    visualCosine,
    matchedTraits,
    conflictTraits,
    matchTier,
    explanation,
  };
}

function buildCandidateExplanation(
  ref: VisualGarmentAnalysis,
  candProfile: VisualGarmentAnalysis | undefined,
  item: EnrichedCatalogItem,
  tier: MatchTier,
  matchedTraits: string[],
  conflictTraits: string[]
): string {
  const uniqueMatches = Array.from(new Set(matchedTraits)).slice(0, 3);
  if (tier === 'exact_match') {
    return `Matches the ${uniqueMatches.join(', ')} seen in your reference photo.`;
  }
  if (tier === 'very_similar') {
    if (conflictTraits.length > 0) {
      return `Matches the ${uniqueMatches.slice(0, 2).join(' and ')}; features ${conflictTraits[0]}.`;
    }
    return `Closely matches the ${uniqueMatches.join(', ')}.`;
  }
  // Alternative style (e.g., same category different color, or similar pattern)
  const candColor = candProfile?.primaryColor || item.availableColors[0]?.name || 'neutral';
  const candPattern = candProfile?.pattern || 'classic';
  const candType = candProfile?.garmentType || item.product.name;
  if (uniqueMatches.length > 0 && conflictTraits.length > 0) {
    return `Shares the ${uniqueMatches[0]}, offered in ${candColor} (${candPattern}).`;
  }
  return `Available Form & Fit ${candType.toLowerCase()} in ${candColor} (${candPattern}).`;
}

function tokenizeWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(
      (w) =>
        w.length >= 3 &&
        ![
          'the',
          'and',
          'for',
          'with',
          'this',
          'that',
          'from',
          'fit',
          'style',
          'cut',
          'plain',
          'solid',
          'standard',
        ].includes(w)
    );
}

/**
 * Side-by-side AI Vision verification on category-compatible top candidates so visual nuance
 * (exact stripe thickness, neckline shape, print similarity) refines scores & explanations accurately.
 */
async function refineCompatibleCandidatesWithVision(
  ai: GoogleGenAI,
  refMimeType: string,
  refBase64: string,
  refAnalysis: VisualGarmentAnalysis,
  candidates: EvaluatedVisualCandidate[]
): Promise<void> {
  if (candidates.length === 0) return;
  const topToVerify = candidates.slice(0, 4);

  const imageParts = await Promise.all(
    topToVerify.map((c) => resolveProductImageInlinePart(c.item.mainImageUrl))
  );

  // Only run side-by-side vision if at least one candidate image loaded
  if (!imageParts.some(Boolean)) return;

  const parts: any[] = [
    { text: `REFERENCE UPLOADED PHOTO (${refAnalysis.summary}):` },
    { inlineData: { mimeType: refMimeType, data: refBase64 } },
  ];

  topToVerify.forEach((cand, i) => {
    if (!imageParts[i]) return;
    parts.push({
      text: `CANDIDATE #${i + 1} — productId: "${cand.item.product.id}", title: "${cand.item.product.name}", detected profile: "${cand.item.visualProfile?.summary || ''}"`,
    });
    parts.push(imageParts[i]);
  });

  parts.push({
    text: `Compare each CANDIDATE image directly against the REFERENCE UPLOADED PHOTO.
STRICT RULES:
1. Set isTrulyExactItem = true ONLY if the candidate photo shows the exact same garment design, color, pattern, collar/sleeves, and cut.
2. Give visualSimilarityScore (0 to 100):
   - 82-98 ONLY if garment type, primary color, AND pattern all visually match closely.
   - 58-81 if garment type, primary color family, and overall silhouette visually resemble the reference.
   - 10-52 if the primary color OR pattern OR garment subtype differs noticeably (e.g. plain shirt vs striped/checked shirt, white/blue dress vs black floral dress, button-down shirt vs oversized T-shirt).
3. Write a concise 1-sentence explanation citing the specific visual attributes that match or differ.`,
  });

  const verified = await generateStructuredJsonWithFailover(
    ai,
    { parts },
    'You are a strict visual product matching judge for Form & Fit. Penalize conflicting colors and conflicting patterns heavily. Never claim a match is exact without strong visual proof.',
    {
      type: Type.OBJECT,
      properties: {
        evaluations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              isTrulyExactItem: { type: Type.BOOLEAN },
              visualSimilarityScore: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ['productId', 'isTrulyExactItem', 'visualSimilarityScore', 'explanation'],
          },
        },
      },
      required: ['evaluations'],
    },
    0.1
  );

  if (!verified || !Array.isArray(verified.evaluations)) return;

  const { exact: exactThreshold, strong: strongThreshold } = getMatchThresholds();

  for (const ev of verified.evaluations) {
    const target = topToVerify.find((c) => c.item.product.id === String(ev.productId));
    if (!target) continue;

    const visionScore = Math.max(0, Math.min(99, Number(ev.visualSimilarityScore ?? target.finalScore)));
    let blended = Math.round(target.finalScore * 0.55 + visionScore * 0.45);

    // Re-enforce hard color/pattern/subtype ceilings so LLM generosity can never promote a wrong color or pattern!
    if (!target.exactSubtypeMatch) {
      blended = Math.min(blended, 48);
    } else if (target.colorStatus === 'conflict' || target.patternStatus === 'conflict') {
      blended = Math.min(blended, 52);
    }

    target.finalScore = blended;

    if (
      Boolean(ev.isTrulyExactItem) &&
      blended >= exactThreshold &&
      target.exactSubtypeMatch &&
      target.colorStatus === 'exact' &&
      target.patternStatus === 'exact'
    ) {
      target.matchTier = 'exact_match';
    } else if (blended >= strongThreshold && target.categoryCompatible) {
      target.matchTier = 'very_similar';
    } else {
      target.matchTier = 'alternative_style';
    }

    const cleanExp = String(ev.explanation || '').trim();
    if (cleanExp.length >= 16) {
      target.explanation = cleanExp;
    }
  }
}

function toRecommendationPayload(ev: EvaluatedVisualCandidate): StylistProductRecommendation {
  // Surface actual visual color alongside configured variant colors if helpful
  const colors = [...ev.item.availableColors];
  if (ev.item.visualProfile?.primaryColor) {
    const visCol = capitalizeWords(ev.item.visualProfile.primaryColor);
    if (!colors.some((c) => c.name.toLowerCase() === visCol.toLowerCase())) {
      colors.unshift({ name: visCol });
    }
  }

  return {
    product: ev.item.product,
    matchTier: ev.matchTier,
    matchScore: ev.finalScore,
    matchReason: ev.explanation,
    inStock: ev.item.inStock,
    totalStock: ev.item.totalStock,
    effectivePrice: ev.item.effectivePrice,
    availableSizes: ev.item.availableSizes,
    availableColors: colors,
  };
}

// ============================================================================
// CONVERSATIONAL STYLING & OUTFIT HELPERS (NON-IMAGE QUERIES)
// ============================================================================
function extractPreferencesFromMessageHeuristically(
  message: string,
  existing: StylistPreferences
): StylistPreferences {
  const lower = message.toLowerCase();
  const next: StylistPreferences = { ...existing };

  if (/\b(men|mens|men's|male|boy|guy)\b/.test(lower)) next.gender = 'Men';
  else if (/\b(women|womens|women's|female|girl|lady|ladies)\b/.test(lower)) next.gender = 'Women';
  else if (/\b(unisex)\b/.test(lower)) next.gender = 'Unisex';

  const occasions = ['college', 'office', 'party', 'wedding', 'travel', 'casual', 'everyday', 'date', 'festive'];
  for (const occ of occasions) {
    if (lower.includes(occ)) {
      next.occasion = capitalizeWords(occ);
      break;
    }
  }

  const styles = ['streetwear', 'minimalist', 'smart casual', 'formal', 'ethnic fusion', 'aesthetic', 'trendy'];
  for (const st of styles) {
    if (lower.includes(st)) {
      next.style = capitalizeWords(st);
      break;
    }
  }

  const budgetMatch =
    message.match(/(?:under|below|budget(?:\s+of|\s+is)?|within|max|₹|rs\.?|inr)\s*₹?\s*([0-9][0-9,]{2,6})/i) ||
    message.match(/([0-9][0-9,]{2,6})\s*(?:rupees|inr|rs)\b/i);
  if (budgetMatch?.[1]) {
    const val = Number(budgetMatch[1].replace(/,/g, ''));
    if (val >= 100 && val <= 500000) {
      next.budgetInr = Math.round(val);
    }
  }

  const sizeMatch = message.match(/\b(?:size\s*)?(xxs|xs|s|m|l|xl|xxl|2xl|3xl)\b/i);
  if (sizeMatch?.[1] && (/\bsize\b/i.test(message) || /^(xs|s|m|l|xl|xxl)$/i.test(message.trim()))) {
    next.preferredSize = sizeMatch[1].toUpperCase();
  }

  return next;
}

function buildCoordinatedOutfitFromCatalog(
  catalog: EnrichedCatalogItem[],
  anchorItem: EnrichedCatalogItem | null,
  prefs: StylistPreferences,
  aiSelectedPieces?: Array<{ productId: string; role: string; stylingNote: string }>,
  aiTitle?: string,
  aiOccasion?: string,
  aiColorCoordination?: string,
  aiStylingSummary?: string
): StylistOutfitSuggestion | null {
  const inStockItems = catalog.filter((c) => c.inStock);
  const pool = inStockItems.length > 0 ? inStockItems : catalog;
  if (pool.length === 0) return null;

  const byId = new Map(catalog.map((c) => [c.product.id, c]));
  const chosenPieces: StylistOutfitPiece[] = [];
  const usedIds = new Set<string>();

  if (Array.isArray(aiSelectedPieces) && aiSelectedPieces.length > 0) {
    for (const p of aiSelectedPieces) {
      const found = byId.get(p.productId);
      if (found && !usedIds.has(found.product.id)) {
        usedIds.add(found.product.id);
        chosenPieces.push({
          role: p.role || formatRoleLabel(found.broadRole),
          product: found.product,
          unitPrice: found.effectivePrice,
          inStock: found.inStock,
          availableSizes: found.availableSizes,
          stylingNote: p.stylingNote || `Pairs cleanly in a ${prefs.style || 'modern'} silhouette.`,
        });
      }
    }
  }

  if (chosenPieces.length === 0) {
    const budgetSortedPool = prefs.budgetInr
      ? [...pool].sort((a, b) => {
          const aFits = a.effectivePrice <= prefs.budgetInr! ? 0 : 1;
          const bFits = b.effectivePrice <= prefs.budgetInr! ? 0 : 1;
          return aFits - bFits || a.effectivePrice - b.effectivePrice;
        })
      : pool;

    const primary = anchorItem || budgetSortedPool[0];
    usedIds.add(primary.product.id);
    chosenPieces.push({
      role: formatRoleLabel(primary.broadRole),
      product: primary.product,
      unitPrice: primary.effectivePrice,
      inStock: primary.inStock,
      availableSizes: primary.availableSizes,
      stylingNote: `Anchor ${primary.product.category?.name?.toLowerCase() || 'piece'} from the live Form & Fit catalog.`,
    });

    const desiredRoles: Array<EnrichedCatalogItem['broadRole']> =
      primary.broadRole === 'one_piece'
        ? ['outerwear', 'footwear', 'accessory']
        : (['top', 'bottom', 'outerwear', 'footwear', 'accessory'].filter(
            (r) => r !== primary.broadRole
          ) as Array<EnrichedCatalogItem['broadRole']>);

    const primaryFamily = primary.colorFamilies[0];
    const complementary = primaryFamily ? COMPLEMENTARY_OUTFIT_COLORS[primaryFamily] || [] : [];

    for (const role of desiredRoles) {
      const candidate =
        budgetSortedPool.find(
          (item) =>
            !usedIds.has(item.product.id) &&
            item.broadRole === role &&
            (complementary.length === 0 ||
              item.colorFamilies.length === 0 ||
              item.colorFamilies.some((f) => complementary.includes(f) || f === primaryFamily))
        ) || budgetSortedPool.find((item) => !usedIds.has(item.product.id) && item.broadRole === role);

      if (candidate) {
        if (prefs.budgetInr) {
          const currentSum = chosenPieces.reduce((s, x) => s + x.unitPrice, 0);
          if (currentSum + candidate.effectivePrice > prefs.budgetInr * 1.15 && chosenPieces.length >= 2) {
            continue;
          }
        }
        usedIds.add(candidate.product.id);
        chosenPieces.push({
          role: formatRoleLabel(candidate.broadRole),
          product: candidate.product,
          unitPrice: candidate.effectivePrice,
          inStock: candidate.inStock,
          availableSizes: candidate.availableSizes,
          stylingNote: `Complements ${primary.product.name} with balanced color and proportion.`,
        });
      }
    }
  }

  if (chosenPieces.length === 0) return null;

  const totalPrice = chosenPieces.reduce((sum, p) => sum + p.unitPrice, 0);
  const regularTotalPrice = chosenPieces.reduce(
    (sum, p) => sum + Number(p.product.regular_price || p.unitPrice),
    0
  );
  const withinBudget = prefs.budgetInr ? totalPrice <= prefs.budgetInr : true;

  const coveredRoles = new Set(chosenPieces.map((p) => inferBroadRoleFromMetadata(p.product)));
  const missingLabels: string[] = [];
  if (!coveredRoles.has('one_piece')) {
    if (!coveredRoles.has('top')) missingLabels.push('topwear');
    if (!coveredRoles.has('bottom')) missingLabels.push('bottomwear');
  }
  if (!coveredRoles.has('footwear')) missingLabels.push('footwear');

  const missingCategoryNote =
    missingLabels.length > 0
      ? `Showing live published pieces currently available in Form & Fit. Pair with neutral ${missingLabels.join(' and ')} to complete the head-to-toe look.`
      : undefined;

  return {
    title: aiTitle || `${prefs.style ? capitalizeWords(prefs.style) : 'Signature Form & Fit'} Edit`,
    occasion: aiOccasion || (prefs.occasion ? capitalizeWords(prefs.occasion) : 'Everyday & Smart Casual'),
    colorCoordination:
      aiColorCoordination || 'Balanced tones with crisp contrast for effortless wearability.',
    stylingSummary:
      aiStylingSummary ||
      'Curated exclusively from live Form & Fit catalog pieces with real-time pricing and stock availability.',
    pieces: chosenPieces,
    totalPrice,
    regularTotalPrice,
    withinBudget,
    missingCategoryNote,
  };
}

function formatRoleLabel(role: EnrichedCatalogItem['broadRole']): string {
  switch (role) {
    case 'top':
      return 'Topwear';
    case 'bottom':
      return 'Bottomwear';
    case 'one_piece':
      return 'Statement Piece';
    case 'outerwear':
      return 'Layering';
    case 'footwear':
      return 'Footwear';
    case 'accessory':
      return 'Accessory';
    default:
      return 'Featured Piece';
  }
}

function capitalizeWords(str: string): string {
  return (str || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// MAIN API HANDLER (/api/stylist)
// ============================================================================
export async function handleStylistApi(req: any, res: any) {
  applyNoStoreHeaders(res);

  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST /api/stylist.',
    });
  }

  const clientIp = getClientIp(req);
  const rate = checkRateLimit(clientIp);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      reply: '',
      preferences: {},
      followUpSuggestions: [],
      recommendations: [],
      error: `You're styling fast! Please wait ${rate.retryAfterSeconds} seconds before sending another request.`,
      errorCode: 'RATE_LIMITED',
      retryAfterSeconds: rate.retryAfterSeconds,
    } satisfies StylistApiResponse);
  }

  const body = await parseJsonBody(req);
  const userMessage = String(body.message || '').trim().slice(0, 1200);
  const currentPrefs: StylistPreferences = {
    gender: body.preferences?.gender,
    occasion: body.preferences?.occasion,
    style: body.preferences?.style,
    colors: Array.isArray(body.preferences?.colors) ? body.preferences!.colors.slice(0, 6) : undefined,
    clothingTypes: Array.isArray(body.preferences?.clothingTypes)
      ? body.preferences!.clothingTypes.slice(0, 6)
      : undefined,
    budgetInr:
      typeof body.preferences?.budgetInr === 'number' && body.preferences.budgetInr > 0
        ? Math.round(body.preferences.budgetInr)
        : undefined,
    preferredSize: body.preferences?.preferredSize,
  };

  const { strong: strongThreshold, initialLimit } = getMatchThresholds();
  const offset = Math.max(0, Number(body.offset ?? 0));
  const limit = Math.max(1, Math.min(6, Number(body.limit ?? initialLimit)));
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

  const imgValidation = validateAndSanitizeImage(body.image);
  if (!imgValidation.valid) {
    return res.status(400).json({
      success: false,
      reply: '',
      preferences: currentPrefs,
      followUpSuggestions: [],
      recommendations: [],
      error: imgValidation.error,
      errorCode: 'INVALID_IMAGE',
    } satisfies StylistApiResponse);
  }

  if (!userMessage && !imgValidation.base64Data && !body.cachedAnalysis) {
    return res.status(400).json({
      success: false,
      reply: '',
      preferences: currentPrefs,
      followUpSuggestions: [],
      recommendations: [],
      error: 'Please enter a styling question or upload a clothing photo to search.',
    });
  }

  // Retrieve live published catalog from Supabase (Never use hardcoded demo products!)
  const catalogResult = await fetchPublishedCatalog();
  if (!catalogResult.ok) {
    return res.status(503).json({
      success: false,
      reply: '',
      preferences: currentPrefs,
      followUpSuggestions: [],
      recommendations: [],
      error: catalogResult.error,
      errorCode: 'DATABASE_NOT_CONFIGURED',
    } satisfies StylistApiResponse);
  }

  const catalog = catalogResult.items;
  const inStockCount = catalog.filter((c) => c.inStock).length;

  const ai = getGeminiClient(14000);
  if (!ai) {
    return res.status(503).json({
      success: false,
      reply: '',
      preferences: currentPrefs,
      followUpSuggestions: [],
      recommendations: [],
      error:
        'AI Fashion Stylist requires GEMINI_API_KEY configured on the server (Settings > Secrets or Vercel Environment Variables).',
      errorCode: 'GEMINI_NOT_CONFIGURED',
    } satisfies StylistApiResponse);
  }

  try {
    // ========================================================================
    // FLOW 1: IMAGE-BASED VISUAL PRODUCT MATCHING ("Find this style")
    // ========================================================================
    if (imgValidation.base64Data || body.cachedAnalysis) {
      // Step 1: Analyze the uploaded reference image using AI Vision (never skip or return full catalog on failure!)
      const analysis: VisualGarmentAnalysis | null = body.cachedAnalysis
        ? normalizeVisionAnalysisObject(body.cachedAnalysis)
        : await analyzeGarmentImageWithVision(
            ai,
            imgValidation.mimeType!,
            imgValidation.base64Data!,
            userMessage ? `Customer note: "${userMessage}"` : ''
          );

      if (!analysis) {
        return res.status(503).json({
          success: false,
          reply: '',
          preferences: currentPrefs,
          followUpSuggestions: [],
          recommendations: [],
          error:
            'Unable to analyze the uploaded clothing image right now due to temporary AI vision service load. Please tap Retry in a moment.',
          errorCode: 'VISION_ANALYSIS_FAILED',
        } satisfies StylistApiResponse);
      }

      if (!analysis.isClothingDetected) {
        return res.status(200).json({
          success: true,
          reply:
            'I could not detect a clothing item, footwear, or fashion accessory in this photo. Please upload a clear photo of the garment you would like to match.',
          preferences: currentPrefs,
          followUpSuggestions: ['Find my style', 'Style an outfit', 'Build an outfit under my budget'],
          visualAnalysis: analysis,
          recommendations: [],
          catalogStats: { totalPublished: catalog.length, inStockCount },
        } satisfies StylistApiResponse);
      }

      if (catalog.length === 0 || inStockCount === 0) {
        return res.status(200).json({
          success: true,
          reply: `Detected: ${analysis.summary}. There are currently no in-stock published products in the Form & Fit catalog to match against.`,
          preferences: currentPrefs,
          followUpSuggestions: ['Find my style'],
          visualAnalysis: analysis,
          recommendations: [],
          catalogStats: { totalPublished: catalog.length, inStockCount },
        } satisfies StylistApiResponse);
      }

      // Step 2: Visually index real catalog product images + compute pure image-to-image embeddings in parallel
      const [queryImageVector] = await Promise.all([
        imgValidation.base64Data && imgValidation.mimeType
          ? embedSingleImageBytes(ai, imgValidation.mimeType, imgValidation.base64Data)
          : Promise.resolve(null),
        enrichCatalogWithVisualIntelligence(ai, catalog),
      ]);

      // Step 3: Evaluate every in-stock imaged catalog product with strict 6-priority scoring & penalties
      const evaluatedAll = catalog
        .filter((item) => item.inStock && item.hasRealCatalogImage)
        .map((item) => evaluateCandidateAgainstReference(analysis, item, queryImageVector));

      // Keep strictly category-compatible candidates for visual verification
      const categoryCompatiblePool = evaluatedAll
        .filter((ev) => ev.categoryCompatible)
        .sort((a, b) => b.finalScore - a.finalScore);

      // Step 4: Direct side-by-side AI Vision verification ONLY on non-conflicting same-subtype candidates
      const viableVisionCandidates = categoryCompatiblePool.filter(
        (ev) =>
          ev.exactSubtypeMatch &&
          ev.colorStatus !== 'conflict' &&
          ev.patternStatus !== 'conflict'
      );
      if (offset === 0 && imgValidation.base64Data && imgValidation.mimeType && viableVisionCandidates.length > 0) {
        await refineCompatibleCandidatesWithVision(
          ai,
          imgValidation.mimeType,
          imgValidation.base64Data,
          analysis,
          viableVisionCandidates
        );
        categoryCompatiblePool.sort((a, b) => b.finalScore - a.finalScore);
      }

      // Step 5: Strict Filtering & Thresholding (NEVER return the full catalog!)
      // 1) High-confidence visual matches (score >= strongThreshold, exact subtype, no color/pattern conflict)
      const strongMatches = categoryCompatiblePool.filter(
        (ev) =>
          ev.finalScore >= strongThreshold &&
          ev.exactSubtypeMatch &&
          ev.colorStatus !== 'conflict' &&
          ev.patternStatus !== 'conflict'
      );

      // 2) Moderate closest visual styles in the SAME garment subtype (e.g. plain navy shirt when searching navy striped shirt: matching category + matching color, different pattern; score 42..strongThreshold-1)
      const moderateClosestInSubtype = categoryCompatiblePool.filter(
        (ev) =>
          !strongMatches.includes(ev) &&
          ev.exactSubtypeMatch &&
          (ev.colorStatus === 'exact' || ev.patternStatus === 'exact') &&
          ev.finalScore >= 40
      );

      // 3) Same garment category in a different color (strictly same garment category — NEVER unrelated categories like footwear for a shirt!)
      const sameCategoryDiffColorPool = categoryCompatiblePool
        .filter(
          (ev) =>
            !strongMatches.includes(ev) &&
            !moderateClosestInSubtype.includes(ev) &&
            ev.colorStatus !== 'exact' &&
            (ev.exactSubtypeMatch || ev.categoryCompatible)
        )
        .sort((a, b) => Number(b.exactSubtypeMatch) - Number(a.exactSubtypeMatch) || b.finalScore - a.finalScore)
        .slice(0, 6);

      // 4) Similar pattern or design (strictly compatible garment category — never cross into footwear/unrelated categories)
      const refPatGroup = normalizePatternGroup(analysis.pattern, analysis.patternScaleAndDetail || '');
      const similarPatternPool = categoryCompatiblePool
        .filter(
          (ev) =>
            !strongMatches.includes(ev) &&
            ((refPatGroup !== 'solid' && (ev.patternStatus === 'exact' || ev.patternStatus === 'related')) ||
              (ev.exactSubtypeMatch && ev.patternStatus === 'exact' && ev.colorStatus !== 'exact'))
        )
        .sort((a, b) => Number(b.exactSubtypeMatch) - Number(a.exactSubtypeMatch) || b.finalScore - a.finalScore)
        .slice(0, 6);

      const hasExactMatch = strongMatches.some((m) => m.matchTier === 'exact_match');
      const hasStrongVisualMatch = strongMatches.length > 0;

      // Paginate strictly over strongMatches (at most 6 initially)
      const primaryEligiblePool = hasStrongVisualMatch ? strongMatches : [];
      const pagedRecommendations = primaryEligiblePool
        .slice(offset, offset + limit)
        .map(toRecommendationPayload);

      const lowConfidenceClosest = moderateClosestInSubtype.slice(0, 6).map(toRecommendationPayload);
      const sameCatDiffColorRecs = sameCategoryDiffColorPool.map(toRecommendationPayload);
      const similarPatternRecs = similarPatternPool.map(toRecommendationPayload);

      // Build concise, factual reply grounded in the detected garment & honest match outcome
      const colorDesc =
        analysis.secondaryColors.length > 0
          ? `${analysis.primaryColor} with ${analysis.secondaryColors.join(', ')}`
          : analysis.primaryColor;
      const patternLabel = (analysis.patternScaleAndDetail || analysis.pattern || 'solid').toLowerCase();
      const detectedIntro = `Detected a ${colorDesc.toLowerCase()} ${analysis.garmentType.toLowerCase()} (${patternLabel}, ${analysis.silhouetteAndFit.toLowerCase()}).`;

      let reply = '';
      let lowConfidenceMessage: string | null = null;

      if (offset > 0) {
        reply = `Showing ${pagedRecommendations.length} additional matching ${pagedRecommendations.length === 1 ? 'item' : 'items'} from Form & Fit.`;
      } else if (hasExactMatch) {
        reply = `${detectedIntro} Found ${strongMatches.length === 1 ? 'a direct visual match' : `${strongMatches.length} close visual matches`} in the Form & Fit catalog.`;
      } else if (hasStrongVisualMatch) {
        lowConfidenceMessage =
          "I couldn't find an exact match in Form & Fit. Here are the closest styles available.";
        reply = `${detectedIntro} I couldn't find an identical piece, so here ${strongMatches.length === 1 ? 'is the closest visual match' : 'are the closest visual matches'} available in Form & Fit.`;
      } else {
        lowConfidenceMessage =
          "I couldn't find an exact match in Form & Fit. Here are the closest styles available.";
        if (
          lowConfidenceClosest.length === 0 &&
          sameCatDiffColorRecs.length === 0 &&
          similarPatternRecs.length === 0
        ) {
          reply = `${detectedIntro} Form & Fit doesn't currently have a matching ${analysis.garmentType.toLowerCase()} in stock, so I haven't shown unrelated catalog items.`;
        } else {
          reply = `${detectedIntro} I couldn't find a close visual match with both the same color and pattern in Form & Fit right now. Choose an option below if you'd like to explore available ${analysis.garmentType.toLowerCase()} styles in another color or pattern.`;
        }
      }

      // Only include an Outfit Suggestion if the customer explicitly asked to style/build an outfit around the photo
      const explicitOutfitRequest =
        body.mode === 'outfit_builder' ||
        /\b(outfit|pair with|style with|goes with|wear with|complete look)\b/i.test(userMessage);

      const outfit = explicitOutfitRequest
        ? buildCoordinatedOutfitFromCatalog(
            catalog,
            strongMatches[0]?.item || categoryCompatiblePool[0]?.item || null,
            currentPrefs
          )
        : null;

      const visualMatchGroups: VisualMatchGroups = {
        hasExactMatch,
        hasStrongVisualMatch,
        lowConfidenceMessage,
        closestMatches: hasStrongVisualMatch ? pagedRecommendations : lowConfidenceClosest,
        sameCategoryDifferentColor: sameCatDiffColorRecs,
        similarPatternOrDesign: similarPatternRecs,
      };

      const updatedPrefs: StylistPreferences = {
        ...currentPrefs,
        style: currentPrefs.style || analysis.styleCategory,
        colors:
          currentPrefs.colors && currentPrefs.colors.length > 0
            ? currentPrefs.colors
            : analysis.dominantColors.slice(0, 3),
      };

      return res.status(200).json({
        success: true,
        reply,
        preferences: updatedPrefs,
        followUpSuggestions: [
          `Style an outfit for ${analysis.styleCategory.toLowerCase()} wear`,
          'Find a product from a photo',
          'Build an outfit under ₹2,500',
        ],
        visualAnalysis: analysis,
        visualMatchGroups,
        recommendations: pagedRecommendations,
        outfit,
        pagination: {
          offset,
          limit,
          totalEligible: primaryEligiblePool.length,
          hasMore: offset + limit < primaryEligiblePool.length,
        },
        catalogStats: {
          totalPublished: catalog.length,
          inStockCount,
        },
      } satisfies StylistApiResponse);
    }

    // ========================================================================
    // FLOW 2: NATURAL-LANGUAGE PERSONALIZED STYLING & OUTFIT BUILDER
    // ========================================================================
    const heuristicPrefs = extractPreferencesFromMessageHeuristically(userMessage, currentPrefs);

    if (catalog.length === 0) {
      return res.status(200).json({
        success: true,
        reply:
          "Hi! Our Form & Fit live catalog currently has 0 published products. Once products are published in the Admin Dashboard, I can immediately recommend pieces and build outfits from real inventory!",
        preferences: heuristicPrefs,
        followUpSuggestions: ['Find my style', 'Find a product from a photo'],
        recommendations: [],
        catalogStats: { totalPublished: 0, inStockCount: 0 },
      } satisfies StylistApiResponse);
    }

    // Enrich catalog visual profiles so text chat ALSO knows the real visual colors & patterns of catalog items!
    await enrichCatalogWithVisualIntelligence(ai, catalog);

    const catalogDigest = catalog.slice(0, 30).map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      category: item.product.category?.name || item.product.gender_collection,
      role: item.broadRole,
      gender: item.product.gender_collection,
      visualGarmentType: item.visualProfile?.garmentType || item.product.name,
      visualPrimaryColor: item.visualProfile?.primaryColor || item.availableColors[0]?.name || 'Standard',
      visualPattern: item.visualProfile?.patternScaleAndDetail || item.visualProfile?.pattern || 'Standard',
      effectivePriceInr: item.effectivePrice,
      regularPriceInr: item.product.regular_price,
      onSale: Boolean(item.product.sale_price && item.product.sale_price < item.product.regular_price),
      inStock: item.inStock,
      availableSizes: item.availableSizes,
      availableColors: item.availableColors.map((c) => c.name),
      fit: item.visualProfile?.silhouetteAndFit || item.product.fit || 'Standard',
      fabric: item.visualProfile?.fabricAppearance || item.product.fabric_material || '',
      shortDesc: (item.product.short_desc || item.product.description || '').slice(0, 180),
    }));

    const conversationTranscript = history
      .map((turn) => `${turn.role === 'user' ? 'Shopper' : 'Stylist'}: ${turn.content}`)
      .join('\n');

    const chatPrompt = `SESSION PREFERENCES SO FAR:
${JSON.stringify(heuristicPrefs)}

RECENT CONVERSATION:
${conversationTranscript || '(Start of conversation)'}

CURRENT SHOPPER MESSAGE:
"${userMessage}"

LIVE PUBLISHED FORM & FIT CATALOG (${catalog.length} total published products, ${inStockCount} in stock):
${JSON.stringify(catalogDigest, null, 2)}

INSTRUCTIONS:
1. Update the shopper's session preferences (gender, occasion, style, colors, clothingTypes, budgetInr in Indian Rupees ₹, preferredSize) based on their message merged with existing session preferences.
2. If key details would meaningfully improve recommendations (such as Men's/Women's/Unisex, occasion, style vibe, or ₹ budget), weave 1 or 2 natural, conversational styling questions into your reply.
3. Recommend ONLY relevant, in-stock products from LIVE PUBLISHED FORM & FIT CATALOG (respecting gender, color, category, budgetInr, and preferredSize). Do NOT return unrelated products that clash with what the shopper asked for.
4. NEVER invent productIds, names, prices, discounts, or sizes. ONLY output productIds that exist verbatim in LIVE PUBLISHED FORM & FIT CATALOG.
5. Set includeOutfit = true whenever the shopper asks to style an outfit, build a look, coordinate colors, dress for an occasion, or build an outfit under a budget.`;

    const parsedChat = await generateStructuredJsonWithFailover(
      ai,
      chatPrompt,
      'You are the Form & Fit Personal Fashion Stylist—warm, tasteful, knowledgeable about Indian & contemporary fashion, and 100% honest about real catalog availability. Keep replies concise (2-4 sentences) and accurate to visualPrimaryColor and visualPattern.',
      {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          updatedPreferences: {
            type: Type.OBJECT,
            properties: {
              gender: { type: Type.STRING },
              occasion: { type: Type.STRING },
              style: { type: Type.STRING },
              colors: { type: Type.ARRAY, items: { type: Type.STRING } },
              clothingTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
              budgetInr: { type: Type.NUMBER },
              preferredSize: { type: Type.STRING },
            },
          },
          recommendedItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productId: { type: Type.STRING },
                matchReason: { type: Type.STRING },
                score: { type: Type.INTEGER },
              },
              required: ['productId', 'matchReason', 'score'],
            },
          },
          includeOutfit: { type: Type.BOOLEAN },
          outfit: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              occasion: { type: Type.STRING },
              colorCoordination: { type: Type.STRING },
              stylingSummary: { type: Type.STRING },
              pieces: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    role: { type: Type.STRING },
                    stylingNote: { type: Type.STRING },
                  },
                  required: ['productId', 'role', 'stylingNote'],
                },
              },
            },
          },
          followUpSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['reply', 'updatedPreferences', 'recommendedItems', 'includeOutfit', 'followUpSuggestions'],
      },
      0.3
    );

    if (!parsedChat) {
      return res.status(503).json({
        success: false,
        reply: '',
        preferences: heuristicPrefs,
        followUpSuggestions: [],
        recommendations: [],
        error: 'Our AI stylist is temporarily busy. Please tap Retry in a moment.',
        errorCode: 'SERVER_ERROR',
      } satisfies StylistApiResponse);
    }

    const catalogById = new Map(catalog.map((c) => [c.product.id, c]));
    const rawPrefs = parsedChat.updatedPreferences || {};
    const mergedPrefs: StylistPreferences = {
      gender: rawPrefs.gender || heuristicPrefs.gender || undefined,
      occasion: rawPrefs.occasion || heuristicPrefs.occasion || undefined,
      style: rawPrefs.style || heuristicPrefs.style || undefined,
      colors:
        Array.isArray(rawPrefs.colors) && rawPrefs.colors.length > 0
          ? rawPrefs.colors.map(String).filter(Boolean).slice(0, 6)
          : heuristicPrefs.colors,
      clothingTypes:
        Array.isArray(rawPrefs.clothingTypes) && rawPrefs.clothingTypes.length > 0
          ? rawPrefs.clothingTypes.map(String).filter(Boolean).slice(0, 6)
          : heuristicPrefs.clothingTypes,
      budgetInr:
        typeof rawPrefs.budgetInr === 'number' && rawPrefs.budgetInr > 0
          ? Math.round(rawPrefs.budgetInr)
          : heuristicPrefs.budgetInr,
      preferredSize: rawPrefs.preferredSize || heuristicPrefs.preferredSize || undefined,
    };

    const seenRecIds = new Set<string>();
    const recommendations: StylistProductRecommendation[] = [];
    if (Array.isArray(parsedChat.recommendedItems)) {
      for (const rec of parsedChat.recommendedItems) {
        const item = catalogById.get(String(rec.productId));
        if (!item || !item.inStock || seenRecIds.has(item.product.id)) continue;
        seenRecIds.add(item.product.id);
        recommendations.push({
          product: item.product,
          matchScore: Math.max(10, Math.min(99, Number(rec.score || 85))),
          matchReason:
            String(rec.matchReason || '').trim() ||
            `Selected from Form & Fit's ${item.product.category?.name || item.product.gender_collection} collection.`,
          inStock: item.inStock,
          totalStock: item.totalStock,
          effectivePrice: item.effectivePrice,
          availableSizes: item.availableSizes,
          availableColors: item.availableColors,
        });
      }
    }

    const explicitOutfitIntent =
      Boolean(parsedChat.includeOutfit) ||
      body.mode === 'outfit_builder' ||
      /\b(style an outfit|build an outfit|complete look|full outfit|coordinate|under my budget|under ₹|under rs)\b/i.test(
        userMessage
      );

    const outfit = explicitOutfitIntent
      ? buildCoordinatedOutfitFromCatalog(
          catalog,
          recommendations[0] ? catalogById.get(recommendations[0].product.id) || null : null,
          mergedPrefs,
          parsedChat.outfit?.pieces,
          parsedChat.outfit?.title,
          parsedChat.outfit?.occasion,
          parsedChat.outfit?.colorCoordination,
          parsedChat.outfit?.stylingSummary
        )
      : null;

    const followUps = Array.isArray(parsedChat.followUpSuggestions)
      ? parsedChat.followUpSuggestions.map(String).filter(Boolean).slice(0, 4)
      : ['Style an outfit', 'Build an outfit under ₹2,000', 'Find a product from a photo'];

    return res.status(200).json({
      success: true,
      reply:
        String(parsedChat.reply || '').trim() ||
        'Here are curated options from our live Form & Fit catalog.',
      preferences: mergedPrefs,
      followUpSuggestions: followUps,
      recommendations: recommendations.slice(0, 6),
      outfit,
      catalogStats: {
        totalPublished: catalog.length,
        inStockCount,
      },
    } satisfies StylistApiResponse);
  } catch (err: any) {
    console.error('[Form & Fit AI Stylist Error]:', err);
    const status = Number(err?.status || err?.code || 500);
    const rawMsg = String(err?.message || '');

    if (
      status === 401 ||
      status === 403 ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED')
    ) {
      return res.status(502).json({
        success: false,
        reply: '',
        preferences: currentPrefs,
        followUpSuggestions: [],
        recommendations: [],
        error:
          'The Gemini API key could not be verified. Please check GEMINI_API_KEY in Settings > Secrets (or Vercel environment variables).',
        errorCode: 'GEMINI_QUOTA_OR_AUTH',
      } satisfies StylistApiResponse);
    }

    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        success: false,
        reply: '',
        preferences: currentPrefs,
        followUpSuggestions: [],
        recommendations: [],
        error:
          'Our AI stylist is experiencing high demand right now. Please wait a few seconds and retry.',
        errorCode: 'GEMINI_QUOTA_OR_AUTH',
      } satisfies StylistApiResponse);
    }

    return res.status(500).json({
      success: false,
      reply: '',
      preferences: currentPrefs,
      followUpSuggestions: [],
      recommendations: [],
      error: 'Unable to complete your styling request right now. Please retry in a moment.',
      errorCode: 'SERVER_ERROR',
    } satisfies StylistApiResponse);
  }
}
