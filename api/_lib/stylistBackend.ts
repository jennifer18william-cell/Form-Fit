import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
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
} from '../../src/types/stylist';

// ============================================================================
// RATE LIMITING & SECURITY CONSTANTS
// ============================================================================
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 25;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB decoded binary limit
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const FLASH_MODEL_CASCADE = [
  { model: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
  { model: 'gemini-flash-latest', thinkingLevel: ThinkingLevel.LOW },
  { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
] as const;

interface RateBucket {
  timestamps: number[];
}

const ipRateBuckets = new Map<string, RateBucket>();

// In-memory caches for product & prototype embeddings
const productEmbeddingCache = new Map<string, number[]>();
const prototypeEmbeddingCache = new Map<string, number[]>();

const COLOR_FAMILIES: Record<string, string[]> = {
  black: ['black', 'jet', 'onyx', 'obsidian', 'pitch', 'noir', 'carbon'],
  white: ['white', 'ivory', 'off-white', 'chalk', 'snow', 'pearl', 'milk', 'alabaster'],
  neutral_beige: [
    'beige',
    'cream',
    'ecru',
    'sand',
    'oatmeal',
    'tan',
    'camel',
    'taupe',
    'khaki',
    'stone',
    'latte',
    'nude',
    'champagne',
    'fawn',
  ],
  grey: ['grey', 'gray', 'charcoal', 'slate', 'ash', 'heather', 'silver', 'graphite', 'smoke'],
  green: ['green', 'olive', 'sage', 'lime', 'emerald', 'forest', 'mint', 'moss', 'pistachio', 'pine', 'teal'],
  blue: ['blue', 'navy', 'indigo', 'cobalt', 'sky', 'denim', 'azure', 'midnight', 'royal', 'cyan'],
  brown: ['brown', 'chocolate', 'espresso', 'mocha', 'rust', 'terracotta', 'cognac', 'walnut', 'coffee'],
  red: ['red', 'crimson', 'burgundy', 'maroon', 'wine', 'scarlet', 'cherry', 'brick', 'oxblood'],
  pink: ['pink', 'blush', 'rose', 'magenta', 'fuchsia', 'coral', 'peach', 'salmon', 'mauve'],
  purple: ['purple', 'lavender', 'lilac', 'plum', 'violet', 'amethyst', 'berry'],
  yellow_orange: ['yellow', 'mustard', 'gold', 'amber', 'ochre', 'orange', 'tangerine', 'apricot'],
};

const COMPLEMENTARY_COLOR_FAMILIES: Record<string, string[]> = {
  neutral_beige: ['black', 'white', 'brown', 'green', 'blue', 'grey'],
  black: ['white', 'neutral_beige', 'grey', 'green', 'blue', 'red'],
  white: ['black', 'blue', 'neutral_beige', 'green', 'brown', 'grey'],
  grey: ['black', 'white', 'blue', 'green', 'red', 'pink'],
  blue: ['white', 'neutral_beige', 'grey', 'black', 'brown'],
  green: ['neutral_beige', 'white', 'black', 'brown', 'blue'],
  brown: ['neutral_beige', 'white', 'green', 'blue', 'black'],
  red: ['black', 'white', 'blue', 'neutral_beige', 'grey'],
  pink: ['white', 'grey', 'blue', 'neutral_beige', 'black'],
  purple: ['white', 'black', 'grey', 'neutral_beige'],
  yellow_orange: ['blue', 'white', 'black', 'neutral_beige', 'brown'],
};

// ============================================================================
// SERVER HELPERS
// ============================================================================
function getClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).split(',')[0].trim();
  }
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

const modelCooldownUntil = new Map<string, number>();

function getGeminiClient(timeoutMs = 12000): GoogleGenAI | null {
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
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
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

function withWallClockTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('WALL_CLOCK_TIMEOUT'));
    }, ms);
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
  temperature = 0.25
): Promise<any | null> {
  let lastErr: any = null;
  const now = Date.now();

  for (const candidate of FLASH_MODEL_CASCADE) {
    const cooldown = modelCooldownUntil.get(candidate.model) || 0;
    if (cooldown > now) {
      continue;
    }

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
        5500
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
      modelCooldownUntil.set(candidate.model, Date.now() + 45_000);
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
    const buf = Buffer.from(cleanedBase64, 'base64');
    byteLength = buf.byteLength;
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
// CATALOG RETRIEVAL & NORMALIZATION (PUBLIC PUBLISHED SOURCE OF TRUTH)
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
}

function inferBroadRole(product: Product): EnrichedCatalogItem['broadRole'] {
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
    /\b(shoe|shoes|sneaker|sneakers|loafer|loafers|boot|boots|sandal|sandals|heel|heels|footwear|slides|sliders|mule|mules)\b/.test(
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

function detectColorFamilies(text: string): string[] {
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  for (const [family, terms] of Object.entries(COLOR_FAMILIES)) {
    for (const term of terms) {
      if (lower.includes(term)) {
        matched.add(family);
        break;
      }
    }
  }
  return Array.from(matched);
}

function sanitizePublicProduct(raw: any, categoriesList: Category[], supabaseOrigin: string): EnrichedCatalogItem {
  const joinedCat = Array.isArray(raw?.category) ? raw.category[0] : raw?.category;
  const resolvedCat = resolveCategoryForProduct(raw.category_id, joinedCat, categoriesList);

  const rawImages: ProductImage[] = Array.isArray(raw.images) ? raw.images : [];
  const validImages = rawImages
    .filter((img) => Boolean(img?.url) && !String(img.url).startsWith('blob:'))
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

  const fallbackUrl =
    resolvedCat?.image_url ||
    'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800';

  const finalImages: ProductImage[] =
    validImages.length > 0
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

  // Strictly omit cost_price and any private fields
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

  return {
    product: cleanProduct,
    effectivePrice,
    inStock,
    totalStock,
    availableSizes,
    availableColors,
    broadRole: inferBroadRole(cleanProduct),
    searchableText,
    colorFamilies: detectColorFamilies(`${cleanProduct.name} ${cleanProduct.short_desc || ''} ${colorNamesText}`),
    mainImageUrl: finalImages[0]?.url || fallbackUrl,
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
      error: `Unable to read published catalog from Supabase (${prodRes.error.message}). Verify your Supabase project URL, publishable key, and public read policy on products.`,
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
// MULTIMODAL EMBEDDINGS & SIMILARITY SCORING (gemini-embedding-2-preview)
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

async function getOrCreateEmbedding(
  ai: GoogleGenAI,
  cache: Map<string, number[]>,
  key: string,
  contentPart: string | { inlineData: { data: string; mimeType: string } }
): Promise<number[] | null> {
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const res = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [contentPart],
    });
    const vec = res.embeddings?.[0]?.values;
    if (vec && vec.length > 0) {
      cache.set(key, vec);
      return vec;
    }
  } catch {
    // Ignore transient embedding error
  }
  return null;
}

async function computeSemanticSimilarities(
  ai: GoogleGenAI,
  queryParts: Array<string | { inlineData: { data: string; mimeType: string } }>,
  catalog: EnrichedCatalogItem[]
): Promise<{ scores: Map<string, number>; queryVector: number[] | null }> {
  const scores = new Map<string, number>();
  if (catalog.length === 0) return { scores, queryVector: null };

  try {
    const queryEmbedRes = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: queryParts,
    });
    const queryVector = queryEmbedRes.embeddings?.[0]?.values || null;
    if (!queryVector || queryVector.length === 0) return { scores, queryVector: null };

    const uncachedItems = catalog
      .filter((item) => !productEmbeddingCache.has(`${item.product.id}:${item.product.updated_at}`))
      .slice(0, 24);

    if (uncachedItems.length > 0) {
      await Promise.all(
        uncachedItems.map(async (item) => {
          const cacheKey = `${item.product.id}:${item.product.updated_at}`;
          const prodSummary = `${item.product.name}. Category: ${item.product.category?.name || item.product.gender_collection}. Gender: ${item.product.gender_collection}. Colors: ${item.availableColors.map((c) => c.name).join(', ')}. Fit: ${item.product.fit || 'Standard'}. Fabric: ${item.product.fabric_material || 'Apparel'}. Details: ${item.product.short_desc || ''} ${item.product.description || ''}`.slice(
            0,
            1200
          );
          try {
            const imgPart = await fetchProductImageInlinePart(item.mainImageUrl);
            const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = imgPart
              ? [prodSummary, imgPart]
              : [prodSummary];
            const emb = await ai.models.embedContent({
              model: 'gemini-embedding-2-preview',
              contents: parts,
            });
            const vec = emb.embeddings?.[0]?.values;
            if (vec && vec.length > 0) {
              productEmbeddingCache.set(cacheKey, vec);
            }
          } catch {
            await getOrCreateEmbedding(ai, productEmbeddingCache, cacheKey, prodSummary);
          }
        })
      );
    }

    for (const item of catalog) {
      const vec = productEmbeddingCache.get(`${item.product.id}:${item.product.updated_at}`);
      if (vec) {
        const sim = Math.max(0, cosineSimilarity(queryVector, vec));
        scores.set(item.product.id, sim);
      }
    }
    return { scores, queryVector };
  } catch {
    return { scores, queryVector: null };
  }
}

// Multimodal embedding classifier fallback when generative Flash endpoints experience 503 traffic spikes
const GARMENT_PROTOTYPES: Array<{
  label: string;
  broadRole: VisualGarmentAnalysis['broadRole'];
  prompt: string;
  fit: string;
  sleeve: string;
}> = [
  {
    label: 'T-Shirt',
    broadRole: 'top',
    prompt: 'A photo of a person or mannequin wearing a crew-neck short-sleeve cotton t-shirt tee top',
    fit: 'Relaxed Everyday Fit',
    sleeve: 'Short sleeve crew neck',
  },
  {
    label: 'Button-Down Shirt',
    broadRole: 'top',
    prompt: 'A photo of a person or mannequin wearing a collared button-down shirt',
    fit: 'Relaxed Tailored Cut',
    sleeve: 'Collared button placket',
  },
  {
    label: 'Hoodie / Sweatshirt',
    broadRole: 'top',
    prompt: 'A photo of a person wearing a long-sleeve pullover hoodie or fleece sweatshirt',
    fit: 'Oversized Drop-Shoulder',
    sleeve: 'Long sleeve ribbed cuffs',
  },
  {
    label: 'Trousers / Jeans',
    broadRole: 'bottom',
    prompt: 'A lower-body photo of trousers, tailored pants, cargo pants, or denim jeans',
    fit: 'Structured Straight-Leg',
    sleeve: 'Waistband & tailored leg',
  },
  {
    label: 'Dress / Kurta Set',
    broadRole: 'one_piece',
    prompt: 'A full-length photo of a woman wearing a dress, gown, jumpsuit, or ethnic kurta',
    fit: 'Fluid Draped Silhouette',
    sleeve: 'Clean tailored neckline',
  },
  {
    label: 'Jacket / Outerwear',
    broadRole: 'outerwear',
    prompt: 'A photo of a person wearing a zip jacket, blazer, coat, or bomber outerwear',
    fit: 'Structured Layering Cut',
    sleeve: 'Full sleeve outerwear',
  },
  {
    label: 'Footwear / Sneakers',
    broadRole: 'footwear',
    prompt: 'A close-up product photo of a pair of sneakers, loafers, boots, heels, or sandals',
    fit: 'Low-Profile Silhouette',
    sleeve: 'Sculpted sole & upper',
  },
  {
    label: 'Handbag / Accessory',
    broadRole: 'accessory',
    prompt: 'A close-up still-life product photo of a handbag, backpack, leather belt, wristwatch, or baseball cap without a person',
    fit: 'Everyday Carry',
    sleeve: 'Clean hardware finish',
  },
];

const COLOR_PROTOTYPES = [
  { name: 'Black', prompt: 'solid black dark charcoal clothing garment' },
  { name: 'White / Ivory', prompt: 'crisp white off-white ivory clothing garment' },
  { name: 'Beige / Cream', prompt: 'warm beige cream sand oatmeal khaki clothing garment' },
  { name: 'Blue / Navy', prompt: 'navy blue indigo denim sky blue clothing garment' },
  { name: 'Olive / Green', prompt: 'olive sage forest green lime clothing garment' },
  { name: 'Grey / Heather', prompt: 'heather grey slate silver clothing garment' },
  { name: 'Brown / Mocha', prompt: 'chocolate brown espresso rust terracotta clothing garment' },
  { name: 'Red / Burgundy', prompt: 'crimson red burgundy maroon clothing garment' },
];

const STYLE_PROTOTYPES = [
  { name: 'Minimalist', prompt: 'minimalist clean solid timeless neutral fashion aesthetic' },
  { name: 'Streetwear', prompt: 'oversized streetwear graphic urban relaxed fashion style' },
  { name: 'Smart Casual', prompt: 'smart casual refined tailored everyday office fashion style' },
  { name: 'Formal', prompt: 'formal structured dressy evening tailored fashion style' },
  { name: 'Ethnic Fusion', prompt: 'indian ethnic fusion kurta festive contemporary fashion style' },
];

async function classifyImageViaMultimodalEmbeddings(
  ai: GoogleGenAI,
  mimeType: string,
  base64Data: string,
  userMessage?: string
): Promise<VisualGarmentAnalysis> {
  const imgVecRes = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: [{ inlineData: { data: base64Data, mimeType } }],
  });
  const imgVec = imgVecRes.embeddings?.[0]?.values || [];

  // Warm prototype caches in parallel
  await Promise.all([
    ...GARMENT_PROTOTYPES.map((g) =>
      getOrCreateEmbedding(ai, prototypeEmbeddingCache, `g:${g.label}`, g.prompt)
    ),
    ...COLOR_PROTOTYPES.map((c) =>
      getOrCreateEmbedding(ai, prototypeEmbeddingCache, `c:${c.name}`, c.prompt)
    ),
    ...STYLE_PROTOTYPES.map((s) =>
      getOrCreateEmbedding(ai, prototypeEmbeddingCache, `s:${s.name}`, s.prompt)
    ),
  ]);

  let bestGarment = GARMENT_PROTOTYPES[0];
  let bestGarmentScore = -1;
  for (const g of GARMENT_PROTOTYPES) {
    const vec = prototypeEmbeddingCache.get(`g:${g.label}`);
    if (vec && imgVec.length === vec.length) {
      const sim = cosineSimilarity(imgVec, vec);
      if (sim > bestGarmentScore) {
        bestGarmentScore = sim;
        bestGarment = g;
      }
    }
  }

  const rankedColors = COLOR_PROTOTYPES.map((c) => {
    const vec = prototypeEmbeddingCache.get(`c:${c.name}`);
    const sim = vec && imgVec.length === vec.length ? cosineSimilarity(imgVec, vec) : 0;
    return { name: c.name, sim };
  }).sort((a, b) => b.sim - a.sim);

  const rankedStyles = STYLE_PROTOTYPES.map((s) => {
    const vec = prototypeEmbeddingCache.get(`s:${s.name}`);
    const sim = vec && imgVec.length === vec.length ? cosineSimilarity(imgVec, vec) : 0;
    return { name: s.name, sim };
  }).sort((a, b) => b.sim - a.sim);

  const topColors = rankedColors.slice(0, 2).map((c) => c.name);
  const topStyle = rankedStyles[0]?.name || 'Minimalist';

  return {
    isClothingDetected: true,
    summary: `${topStyle} ${topColors[0] || ''} ${bestGarment.label.toLowerCase()}${userMessage ? ` (${userMessage})` : ''}`.trim(),
    garmentType: bestGarment.label,
    broadRole: bestGarment.broadRole,
    genderFit: 'Unisex',
    dominantColors: topColors,
    colorCombination: topColors.join(' & '),
    patternOrPrint: 'Clean contemporary finish',
    fabricAppearance: 'Woven / Cotton knit',
    silhouetteAndFit: bestGarment.fit,
    sleeveAndNeckline: bestGarment.sleeve,
    styleCategory: topStyle,
    designDetails: ['Clean seam construction', 'Versatile everyday silhouette'],
    outfitPairingIdeas: ['Relaxed trousers or denim', 'Minimalist sneakers', 'Structured tote or cap'],
  };
}

function tokenizeKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(
      (w) =>
        w.length >= 3 &&
        !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'look', 'find', 'want', 'show'].includes(w)
    );
}

function scoreCatalogItemForVisualAnalysis(
  item: EnrichedCatalogItem,
  analysis: VisualGarmentAnalysis,
  prefs: StylistPreferences,
  embeddingScore: number
): { score: number; preliminaryTier: MatchTier; reasonHints: string[] } {
  let score = 0;
  const hints: string[] = [];
  const lowerSearchable = item.searchableText.toLowerCase();

  const roleMatches =
    analysis.broadRole !== 'other' &&
    item.broadRole !== 'other' &&
    analysis.broadRole === item.broadRole;

  const garmentTokens = tokenizeKeywords(analysis.garmentType);
  const exactGarmentWordHit = garmentTokens.some((tok) => lowerSearchable.includes(tok));

  if (roleMatches && exactGarmentWordHit) {
    score += 34;
    hints.push(`matching ${analysis.garmentType.toLowerCase()} silhouette`);
  } else if (roleMatches) {
    score += 24;
    hints.push(`same ${item.broadRole.replace('_', '-')} category`);
  } else if (exactGarmentWordHit) {
    score += 20;
    hints.push('related garment cut');
  }

  const queryColorFamilies = detectColorFamilies(
    `${analysis.dominantColors.join(' ')} ${analysis.colorCombination}`
  );
  const directColorHit = analysis.dominantColors.some((c) =>
    lowerSearchable.includes(c.split('/')[0].trim().toLowerCase())
  );
  const familyOverlap = queryColorFamilies.filter((f) => item.colorFamilies.includes(f));

  if (directColorHit) {
    score += 22;
    hints.push(`close ${analysis.dominantColors[0]} color alignment`);
  } else if (familyOverlap.length > 0) {
    score += 15;
    hints.push(`coordinated ${familyOverlap[0].replace('neutral_', '')} palette`);
  }

  const attrTokens = tokenizeKeywords(
    [
      analysis.patternOrPrint,
      analysis.fabricAppearance,
      analysis.silhouetteAndFit,
      analysis.sleeveAndNeckline,
      analysis.styleCategory,
      ...(analysis.designDetails || []),
    ].join(' ')
  );

  let matchedAttrCount = 0;
  for (const tok of attrTokens) {
    if (lowerSearchable.includes(tok)) {
      matchedAttrCount++;
    }
  }
  if (matchedAttrCount > 0) {
    score += Math.min(20, matchedAttrCount * 5);
    hints.push('aligned fit & styling details');
  }

  const targetGender = (prefs.gender || analysis.genderFit || '').toLowerCase();
  const prodGender = item.product.gender_collection.toLowerCase();
  if (!targetGender || prodGender === 'unisex' || targetGender.includes('unisex')) {
    score += 6;
  } else if (
    (targetGender.startsWith('men') && prodGender === 'men') ||
    (targetGender.startsWith('women') && prodGender === 'women')
  ) {
    score += 8;
  }

  if (embeddingScore > 0) {
    score += Math.round(embeddingScore * 20);
  }

  if (prefs.budgetInr && item.effectivePrice <= prefs.budgetInr) {
    score += 4;
  }
  if (
    prefs.preferredSize &&
    item.availableSizes.some((s) => s.toLowerCase() === prefs.preferredSize!.toLowerCase())
  ) {
    score += 4;
  }

  if (!item.inStock) {
    score = Math.max(1, score - 25);
  }

  const clampedScore = Math.max(8, Math.min(99, score));
  let preliminaryTier: MatchTier = 'alternative_style';
  if (clampedScore >= 52 && (roleMatches || exactGarmentWordHit)) {
    preliminaryTier = 'very_similar';
  }

  return { score: clampedScore, preliminaryTier, reasonHints: hints };
}

async function fetchProductImageInlinePart(
  imageUrl: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const resp = await fetch(imageUrl, { signal: controller.signal });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const normMime = contentType === 'image/jpg' ? 'image/jpeg' : contentType;
    if (!ALLOWED_MIME_TYPES.has(normMime)) return null;
    const arrayBuf = await resp.arrayBuffer();
    if (arrayBuf.byteLength < 256 || arrayBuf.byteLength > 1.8 * 1024 * 1024) return null;
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

async function analyzeUploadedGarmentImage(
  ai: GoogleGenAI,
  mimeType: string,
  base64Data: string,
  userMessage?: string
): Promise<VisualGarmentAnalysis> {
  const parsed = await generateStructuredJsonWithFailover(
    ai,
    {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            `Analyze this fashion/clothing photo uploaded by a Form & Fit shopper.` +
            (userMessage ? ` Shopper note: "${userMessage}".` : '') +
            ` Identify the primary garment or fashion item visible with accurate fashion terminology.`,
        },
      ],
    },
    'You are an expert fashion merchandiser and visual garment analyst for Form & Fit. Extract accurate, objective visual attributes of the clothing, footwear, or accessory shown in the image. If no fashion, apparel, footwear, or accessory item is visible at all, set isClothingDetected to false and explain politely in summary.',
    {
      type: Type.OBJECT,
      properties: {
        isClothingDetected: { type: Type.BOOLEAN },
        summary: { type: Type.STRING },
        garmentType: { type: Type.STRING },
        broadRole: { type: Type.STRING },
        genderFit: { type: Type.STRING },
        dominantColors: { type: Type.ARRAY, items: { type: Type.STRING } },
        colorCombination: { type: Type.STRING },
        patternOrPrint: { type: Type.STRING },
        fabricAppearance: { type: Type.STRING },
        silhouetteAndFit: { type: Type.STRING },
        sleeveAndNeckline: { type: Type.STRING },
        styleCategory: { type: Type.STRING },
        designDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
        outfitPairingIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'isClothingDetected',
        'summary',
        'garmentType',
        'broadRole',
        'genderFit',
        'dominantColors',
        'colorCombination',
        'patternOrPrint',
        'fabricAppearance',
        'silhouetteAndFit',
        'sleeveAndNeckline',
        'styleCategory',
        'designDetails',
        'outfitPairingIdeas',
      ],
    },
    0.2
  );

  if (!parsed) {
    return classifyImageViaMultimodalEmbeddings(ai, mimeType, base64Data, userMessage);
  }

  const allowedRoles = new Set(['top', 'bottom', 'one_piece', 'outerwear', 'footwear', 'accessory', 'other']);
  const normalizedRole = allowedRoles.has(String(parsed.broadRole || '').toLowerCase())
    ? (String(parsed.broadRole).toLowerCase() as VisualGarmentAnalysis['broadRole'])
    : 'other';

  return {
    isClothingDetected: Boolean(parsed.isClothingDetected),
    summary: String(parsed.summary || 'Analyzed uploaded fashion image.'),
    garmentType: String(parsed.garmentType || 'Apparel'),
    broadRole: normalizedRole,
    genderFit: String(parsed.genderFit || 'Unisex'),
    dominantColors: Array.isArray(parsed.dominantColors) ? parsed.dominantColors.map(String).slice(0, 4) : [],
    colorCombination: String(parsed.colorCombination || 'Neutral palette'),
    patternOrPrint: String(parsed.patternOrPrint || 'Solid'),
    fabricAppearance: String(parsed.fabricAppearance || 'Woven / Knit'),
    silhouetteAndFit: String(parsed.silhouetteAndFit || 'Regular fit'),
    sleeveAndNeckline: String(parsed.sleeveAndNeckline || 'Standard cut'),
    styleCategory: String(parsed.styleCategory || 'Minimalist'),
    designDetails: Array.isArray(parsed.designDetails) ? parsed.designDetails.map(String).slice(0, 6) : [],
    outfitPairingIdeas: Array.isArray(parsed.outfitPairingIdeas)
      ? parsed.outfitPairingIdeas.map(String).slice(0, 4)
      : [],
  };
}

// ============================================================================
// NATURAL-LANGUAGE PREFERENCE EXTRACTION & OUTFIT BUILDER HELPERS
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

  const detectedCols: string[] = [];
  for (const [, synonyms] of Object.entries(COLOR_FAMILIES)) {
    for (const term of synonyms) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(lower)) {
        detectedCols.push(capitalizeWords(term));
        break;
      }
    }
  }
  if (detectedCols.length > 0) {
    next.colors = Array.from(new Set([...(existing.colors || []), ...detectedCols])).slice(0, 4);
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
    const complementary = primaryFamily ? COMPLEMENTARY_COLOR_FAMILIES[primaryFamily] || [] : [];

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

  const coveredRoles = new Set(chosenPieces.map((p) => inferBroadRole(p.product)));
  const missingLabels: string[] = [];
  if (!coveredRoles.has('one_piece')) {
    if (!coveredRoles.has('top')) missingLabels.push('topwear');
    if (!coveredRoles.has('bottom')) missingLabels.push('bottomwear');
  }
  if (!coveredRoles.has('footwear')) missingLabels.push('footwear');

  const missingCategoryNote =
    missingLabels.length > 0
      ? `Showing live published pieces currently available in Form & Fit. Pair with neutral ${missingLabels.join(' and ')} to complete the head-to-toe look as new drops arrive.`
      : undefined;

  return {
    title: aiTitle || `${prefs.style ? capitalizeWords(prefs.style) : 'Signature Form & Fit'} Edit`,
    occasion: aiOccasion || (prefs.occasion ? capitalizeWords(prefs.occasion) : 'Everyday & Smart Casual'),
    colorCoordination:
      aiColorCoordination || 'Balanced warm neutrals with crisp tonal contrast for effortless wearability.',
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
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
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
    const payload: StylistApiResponse = {
      success: false,
      reply: '',
      preferences: {},
      followUpSuggestions: [],
      recommendations: [],
      error: `You're styling fast! Please wait ${rate.retryAfterSeconds} seconds before sending another request.`,
      errorCode: 'RATE_LIMITED',
      retryAfterSeconds: rate.retryAfterSeconds,
    };
    return res.status(429).json(payload);
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
  const offset = Math.max(0, Number(body.offset ?? 0));
  const limit = Math.max(1, Math.min(8, Number(body.limit ?? 4)));
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

  // Verify Shared Supabase Catalog Connection (Zero fake/demo fallback!)
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

  const ai = getGeminiClient(15000);
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
    // FLOW 1: VISUAL PRODUCT SEARCH ("Find this style" / Image Uploaded / Load More)
    // ========================================================================
    if (imgValidation.base64Data || body.cachedAnalysis) {
      const analysis: VisualGarmentAnalysis = body.cachedAnalysis
        ? body.cachedAnalysis
        : await analyzeUploadedGarmentImage(
            ai,
            imgValidation.mimeType!,
            imgValidation.base64Data!,
            userMessage
          );

      if (!analysis.isClothingDetected) {
        return res.status(200).json({
          success: true,
          reply: `${analysis.summary} Please upload or snap a clear photo of clothing, shoes, or accessories—like an outfit from Instagram, Pinterest, or your wardrobe—and I'll match it against the Form & Fit catalog.`,
          preferences: currentPrefs,
          followUpSuggestions: ['Find my style', 'Style an outfit', 'Build an outfit under my budget'],
          visualAnalysis: analysis,
          recommendations: [],
          catalogStats: { totalPublished: catalog.length, inStockCount },
        } satisfies StylistApiResponse);
      }

      if (catalog.length === 0) {
        return res.status(200).json({
          success: true,
          reply: `I analyzed your photo (${analysis.summary.toLowerCase()}), featuring a ${analysis.silhouetteAndFit.toLowerCase()} ${analysis.garmentType.toLowerCase()} in ${analysis.dominantColors.join(', ') || 'neutral tones'}. However, there are currently no published products in the Form & Fit catalog yet. As soon as products are published in the Admin Dashboard, they will automatically appear in visual search.`,
          preferences: currentPrefs,
          followUpSuggestions: ['Find my style', 'Recommend products for an occasion'],
          visualAnalysis: analysis,
          recommendations: [],
          catalogStats: { totalPublished: 0, inStockCount: 0 },
        } satisfies StylistApiResponse);
      }

      const queryEmbedParts: Array<string | { inlineData: { data: string; mimeType: string } }> = [
        `${analysis.garmentType}. ${analysis.summary}. Colors: ${analysis.dominantColors.join(', ')}. Style: ${analysis.styleCategory}. Pattern: ${analysis.patternOrPrint}. Fabric: ${analysis.fabricAppearance}. Fit: ${analysis.silhouetteAndFit}. ${userMessage}`,
      ];
      if (imgValidation.base64Data && imgValidation.mimeType) {
        queryEmbedParts.push({
          inlineData: {
            data: imgValidation.base64Data,
            mimeType: imgValidation.mimeType,
          },
        });
      }

      const { scores: semanticMap } = await computeSemanticSimilarities(ai, queryEmbedParts, catalog);

      const preliminarilyRanked = catalog
        .map((item) => {
          const sem = semanticMap.get(item.product.id) || 0;
          const scored = scoreCatalogItemForVisualAnalysis(item, analysis, currentPrefs, sem);
          return {
            item,
            score: scored.score,
            tier: scored.preliminaryTier,
            hints: scored.reasonHints,
          };
        })
        .sort((a, b) => b.score - a.score);

      let aiReply = '';
      let wantsOutfit =
        body.mode === 'outfit_builder' ||
        /\b(outfit|pair|style with|goes with|wear with|complete look|match with)\b/i.test(userMessage);
      let aiOutfitData: {
        title?: string;
        occasion?: string;
        colorCoordination?: string;
        pieces?: Array<{ productId: string; role: string; stylingNote: string }>;
      } | null = null;

      if (offset === 0 && imgValidation.base64Data && imgValidation.mimeType) {
        const topCandidates = preliminarilyRanked.slice(0, Math.min(6, preliminarilyRanked.length));
        const candidateImageParts = await Promise.all(
          topCandidates.slice(0, 4).map((c) => fetchProductImageInlinePart(c.item.mainImageUrl))
        );

        const verificationParts: any[] = [
          { text: 'CUSTOMER UPLOADED REFERENCE PHOTO:' },
          { inlineData: { mimeType: imgValidation.mimeType, data: imgValidation.base64Data } },
        ];

        topCandidates.forEach((cand, idx) => {
          const p = cand.item.product;
          verificationParts.push({
            text: `CATALOG CANDIDATE #${idx + 1}:
- productId: "${p.id}"
- name: "${p.name}"
- category: "${p.category?.name || p.gender_collection}"
- gender: "${p.gender_collection}"
- priceInr: ${cand.item.effectivePrice}
- inStock: ${cand.item.inStock} (sizes: ${cand.item.availableSizes.join(', ') || 'None'})
- colors: "${cand.item.availableColors.map((c) => c.name).join(', ') || 'Standard'}"
- fitAndFabric: "${[p.fit, p.fabric_material].filter(Boolean).join(', ') || 'Standard'}"
- description: "${(p.short_desc || p.description || '').slice(0, 240)}"`,
          });
          if (idx < 4 && candidateImageParts[idx]) {
            verificationParts.push(candidateImageParts[idx]);
          }
        });

        verificationParts.push({
          text: `Shopper message: "${userMessage || 'Find this style in Form & Fit.'}"
Detected garment attributes: ${JSON.stringify(analysis)}
Compare the customer's photo against the real Form & Fit catalog candidates above.
CRITICAL HONESTY RULES:
1. Classify each candidate strictly as:
   - "exact_match": ONLY when visual appearance, garment type, color, print/graphics, and cut prove it is genuinely the exact same item in the catalog. NEVER claim exact_match if it is merely similar!
   - "very_similar": Same garment type with closely aligned color palette, cut, or vibe.
   - "alternative_style": Closest available Form & Fit piece in a different garment category, color, or alternative vibe when no close match exists in the catalog.
2. If NO candidate is an exact_match or very_similar match, state that honestly and warmly in your reply and present the closest available Form & Fit alternatives.`,
        });

        const verifiedJson = await generateStructuredJsonWithFailover(
          ai,
          { parts: verificationParts },
          'You are the Form & Fit Senior Fashion Stylist & Visual Matcher. Never invent products, prices, discounts, or sizes. Only reference productIds provided in CATALOG CANDIDATE entries.',
          {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              verifiedMatches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    matchTier: { type: Type.STRING },
                    visualScore: { type: Type.INTEGER },
                    matchReason: { type: Type.STRING },
                  },
                  required: ['productId', 'matchTier', 'visualScore', 'matchReason'],
                },
              },
              buildOutfit: { type: Type.BOOLEAN },
              outfitTitle: { type: Type.STRING },
              outfitOccasion: { type: Type.STRING },
              outfitColorCoordination: { type: Type.STRING },
              outfitPieces: {
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
            required: ['reply', 'verifiedMatches'],
          },
          0.25
        );

        if (verifiedJson) {
          aiReply = String(verifiedJson.reply || '').trim();
          const verifiedMap = new Map<
            string,
            { matchTier: MatchTier; visualScore: number; matchReason: string }
          >();

          if (Array.isArray(verifiedJson.verifiedMatches)) {
            for (const vm of verifiedJson.verifiedMatches) {
              const rawTier = String(vm.matchTier || '').toLowerCase();
              const safeTier: MatchTier =
                rawTier === 'exact_match'
                  ? 'exact_match'
                  : rawTier === 'very_similar'
                  ? 'very_similar'
                  : 'alternative_style';
              verifiedMap.set(String(vm.productId), {
                matchTier: safeTier,
                visualScore: Math.max(10, Math.min(99, Number(vm.visualScore || 50))),
                matchReason: String(vm.matchReason || '').trim(),
              });
            }
          }

          for (const entry of preliminarilyRanked) {
            const v = verifiedMap.get(entry.item.product.id);
            if (v) {
              entry.tier = v.matchTier;
              entry.score = Math.round(v.visualScore * 0.65 + entry.score * 0.35);
              if (v.matchReason) {
                entry.hints = [v.matchReason];
              }
            }
          }
          preliminarilyRanked.sort((a, b) => b.score - a.score);

          if (verifiedJson.buildOutfit || wantsOutfit) {
            wantsOutfit = true;
            aiOutfitData = {
              title: verifiedJson.outfitTitle,
              occasion: verifiedJson.outfitOccasion,
              colorCoordination: verifiedJson.outfitColorCoordination,
              pieces: verifiedJson.outfitPieces,
            };
          }
        }
      }

      const pageSlice = preliminarilyRanked.slice(offset, offset + limit);
      const recommendations: StylistProductRecommendation[] = pageSlice.map((entry) => ({
        product: entry.item.product,
        matchTier: entry.tier,
        matchScore: entry.score,
        matchReason:
          entry.hints[0] && entry.hints[0].length > 28
            ? entry.hints[0]
            : entry.tier === 'exact_match'
            ? `Matches the ${analysis.garmentType.toLowerCase()} design, color palette, and cut in your photo.`
            : entry.tier === 'very_similar'
            ? `Shares a similar ${analysis.styleCategory.toLowerCase()} silhouette and ${entry.item.availableColors.map((c) => c.name).join('/') || 'versatile'} palette.`
            : `Closest available Form & Fit piece offering an alternative ${entry.item.product.fit || formatRoleLabel(entry.item.broadRole).toLowerCase()} option in stock.`,
        inStock: entry.item.inStock,
        totalStock: entry.item.totalStock,
        effectivePrice: entry.item.effectivePrice,
        availableSizes: entry.item.availableSizes,
        availableColors: entry.item.availableColors,
      }));

      const hasCloseMatch = recommendations.some(
        (r) => r.matchTier === 'exact_match' || r.matchTier === 'very_similar'
      );

      if (!aiReply) {
        aiReply =
          offset > 0
            ? `Here ${recommendations.length === 1 ? 'is another option' : `are ${recommendations.length} more options`} from our live catalog ranked for your ${analysis.garmentType.toLowerCase()} search.`
            : hasCloseMatch
            ? `I spotted a ${analysis.silhouetteAndFit.toLowerCase()} ${analysis.garmentType.toLowerCase()} in ${analysis.dominantColors.join(', ') || 'neutral tones'}. Here are the closest matches from our live Form & Fit collection.`
            : `I analyzed your ${analysis.dominantColors.join(' ')} ${analysis.garmentType.toLowerCase()} (${analysis.styleCategory.toLowerCase()} style). We don't carry an identical piece in the current Form & Fit drop, so here are our closest available catalog alternatives.`;
      }

      const outfitSuggestion =
        offset === 0 && (wantsOutfit || catalog.length >= 2)
          ? buildCoordinatedOutfitFromCatalog(
              catalog,
              preliminarilyRanked[0]?.item || null,
              currentPrefs,
              aiOutfitData?.pieces,
              aiOutfitData?.title,
              aiOutfitData?.occasion,
              aiOutfitData?.colorCoordination,
              undefined
            )
          : null;

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
        reply: aiReply,
        preferences: updatedPrefs,
        followUpSuggestions: [
          'Style a complete outfit around this vibe',
          'Build an outfit under ₹2,500',
          'Show minimalist alternatives',
        ],
        visualAnalysis: analysis,
        recommendations,
        outfit: wantsOutfit ? outfitSuggestion : null,
        pagination: {
          offset,
          limit,
          totalEligible: preliminarilyRanked.length,
          hasMore: offset + limit < preliminarilyRanked.length,
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
          "Hi! I'd love to style a look for you, though our Form & Fit live catalog currently has 0 published products. Once products are published in the Admin Dashboard, I can immediately recommend pieces and build outfits from real inventory!",
        preferences: heuristicPrefs,
        followUpSuggestions: ['Find my style', 'Find a product from a photo'],
        recommendations: [],
        catalogStats: { totalPublished: 0, inStockCount: 0 },
      } satisfies StylistApiResponse);
    }

    const { scores: semanticTextScores } = await computeSemanticSimilarities(
      ai,
      [
        `${userMessage} ${heuristicPrefs.gender || ''} ${heuristicPrefs.occasion || ''} ${heuristicPrefs.style || ''} ${(heuristicPrefs.colors || []).join(' ')} ${(heuristicPrefs.clothingTypes || []).join(' ')}`.trim(),
      ],
      catalog
    );

    const sortedForContext = [...catalog]
      .sort((a, b) => {
        const budgetBonusA =
          heuristicPrefs.budgetInr && a.effectivePrice <= heuristicPrefs.budgetInr ? 0.15 : 0;
        const budgetBonusB =
          heuristicPrefs.budgetInr && b.effectivePrice <= heuristicPrefs.budgetInr ? 0.15 : 0;
        const sA = (semanticTextScores.get(a.product.id) || 0) + (a.inStock ? 0.25 : 0) + budgetBonusA;
        const sB = (semanticTextScores.get(b.product.id) || 0) + (b.inStock ? 0.25 : 0) + budgetBonusB;
        return sB - sA;
      })
      .slice(0, 30);

    const catalogDigest = sortedForContext.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      category: item.product.category?.name || item.product.gender_collection,
      role: item.broadRole,
      gender: item.product.gender_collection,
      effectivePriceInr: item.effectivePrice,
      regularPriceInr: item.product.regular_price,
      onSale: Boolean(item.product.sale_price && item.product.sale_price < item.product.regular_price),
      inStock: item.inStock,
      availableSizes: item.availableSizes,
      availableColors: item.availableColors.map((c) => c.name),
      fit: item.product.fit || 'Standard',
      fabric: item.product.fabric_material || '',
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
3. Recommend real products from LIVE PUBLISHED FORM & FIT CATALOG above (prioritizing inStock: true items, respecting budgetInr and preferredSize when specified).
4. NEVER invent productIds, names, prices, discounts, or sizes. ONLY output productIds that exist verbatim in LIVE PUBLISHED FORM & FIT CATALOG.
5. Set includeOutfit = true whenever the shopper asks to style an outfit, build a look, coordinate colors, dress for an occasion, or build an outfit under a budget.`;

    const parsedChat = await generateStructuredJsonWithFailover(
      ai,
      chatPrompt,
      'You are the Form & Fit Personal Fashion Stylist—warm, tasteful, knowledgeable about Indian & contemporary fashion (casual, college, office, party, wedding, travel, streetwear, minimalist, ethnic fusion), and 100% honest about real catalog availability. Keep replies concise (2-4 sentences), editorial, and helpful.',
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
      0.35
    );

    const catalogById = new Map(catalog.map((c) => [c.product.id, c]));

    // Seamless semantic + catalog response if generative Flash endpoints hit a temporary 503 spike
    if (!parsedChat) {
      const asksAccessories = /\b(accessor|bag|cap|watch|belt|sunglass|shoe|footwear)\b/i.test(userMessage);
      const filteredMatches = sortedForContext
        .filter((item) => {
          if (asksAccessories) {
            return item.broadRole === 'accessory' || item.broadRole === 'footwear';
          }
          if (heuristicPrefs.budgetInr && sortedForContext.some((x) => x.effectivePrice <= heuristicPrefs.budgetInr!)) {
            return item.effectivePrice <= heuristicPrefs.budgetInr;
          }
          return true;
        })
        .slice(0, 4);

      const chosenList = filteredMatches.length > 0 ? filteredMatches : sortedForContext.slice(0, 4);
      const fallbackRecs: StylistProductRecommendation[] = chosenList.map((item) => ({
        product: item.product,
        matchScore: Math.round(78 + (semanticTextScores.get(item.product.id) || 0.1) * 18),
        matchReason: `Matches your ${[heuristicPrefs.occasion, heuristicPrefs.style, heuristicPrefs.gender]
          .filter(Boolean)
          .join(' ')
          .toLowerCase() || 'everyday Form & Fit'} styling criteria${heuristicPrefs.budgetInr ? ` and ₹${heuristicPrefs.budgetInr.toLocaleString('en-IN')} target` : ''}.`,
        inStock: item.inStock,
        totalStock: item.totalStock,
        effectivePrice: item.effectivePrice,
        availableSizes: item.availableSizes,
        availableColors: item.availableColors,
      }));

      const explicitOutfitIntent =
        body.mode === 'outfit_builder' ||
        /\b(style an outfit|build an outfit|complete look|full outfit|coordinate|under my budget|under ₹|under rs|college|office|party|occasion)\b/i.test(
          userMessage
        );

      const outfit = explicitOutfitIntent
        ? buildCoordinatedOutfitFromCatalog(catalog, chosenList[0] || null, heuristicPrefs)
        : null;

      const missingFollowUpQuestions: string[] = [];
      if (!heuristicPrefs.gender) missingFollowUpQuestions.push("Men's, Women's, or Unisex fits");
      if (!heuristicPrefs.occasion) missingFollowUpQuestions.push('the occasion (casual, college, office, or party)');
      if (!heuristicPrefs.budgetInr) missingFollowUpQuestions.push('your preferred budget in ₹');

      const replyParts: string[] = [];
      if (asksAccessories && filteredMatches.length === 0) {
        replyParts.push(
          "We don't currently have standalone accessories or footwear published in stock yet, so I've pulled our most versatile published Form & Fit pieces below."
        );
      } else {
        replyParts.push(
          `Here ${fallbackRecs.length === 1 ? 'is a standout piece' : 'are curated pieces'} from our live Form & Fit catalog${heuristicPrefs.occasion ? ` for ${heuristicPrefs.occasion.toLowerCase()} wear` : ''}${heuristicPrefs.budgetInr ? ` tailored to your ₹${heuristicPrefs.budgetInr.toLocaleString('en-IN')} budget` : ''}.`
        );
      }
      if (missingFollowUpQuestions.length > 0) {
        replyParts.push(
          `Tell me ${missingFollowUpQuestions.slice(0, 2).join(' and ')} if you'd like me to refine the look further.`
        );
      }

      return res.status(200).json({
        success: true,
        reply: replyParts.join(' '),
        preferences: heuristicPrefs,
        followUpSuggestions: [
          'Style for Men · Casual under ₹2,000',
          'Style for Women · Smart Casual',
          'Find a product from a photo',
        ],
        recommendations: fallbackRecs,
        outfit,
        catalogStats: { totalPublished: catalog.length, inStockCount },
      } satisfies StylistApiResponse);
    }

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
        if (!item || seenRecIds.has(item.product.id)) continue;
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
      recommendations,
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
          'Our AI stylist is experiencing high demand right now. Please wait a few seconds and retry—or upgrade API quota in Settings > Secrets for higher throughput.',
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
