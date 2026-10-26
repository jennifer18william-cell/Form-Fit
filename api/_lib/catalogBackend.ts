import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  CANONICAL_CATEGORIES,
  ensureValidUUID,
  getCanonicalCategorySpec,
  isValidUUID,
  normalizeCategoriesList,
  resolveCategoryForProduct,
} from '../../src/lib/categoryMapping';
import { DEFAULT_CATEGORIES } from '../../src/data/initialData';
import { Category, Product, ProductImage, ProductVariant, ProductStatus } from '../../src/types';

export const PUBLIC_PRODUCT_COLUMNS = `
  id,
  name,
  slug,
  sku,
  short_desc,
  description,
  category_id,
  gender_collection,
  regular_price,
  sale_price,
  fabric_material,
  fit,
  care_instructions,
  status,
  featured,
  seo_title,
  seo_description,
  created_at,
  updated_at,
  category:categories(id, name, slug, description, image_url, display_order, parent_id),
  images:product_images(id, product_id, url, storage_path, is_main, alt_text, display_order),
  variants:product_variants(id, product_id, sku, size, color, color_hex, price_override, stock_quantity, variant_image_url, is_active)
`;

export const ADMIN_PRODUCT_COLUMNS = `
  id,
  name,
  slug,
  sku,
  short_desc,
  description,
  category_id,
  gender_collection,
  regular_price,
  sale_price,
  cost_price,
  fabric_material,
  fit,
  care_instructions,
  status,
  featured,
  seo_title,
  seo_description,
  created_at,
  updated_at,
  category:categories(id, name, slug, description, image_url, display_order, parent_id),
  images:product_images(id, product_id, url, storage_path, is_main, alt_text, display_order),
  variants:product_variants(id, product_id, sku, size, color, color_hex, price_override, stock_quantity, variant_image_url, is_active)
`;

export interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  isConfigured: boolean;
  hasServiceRole: boolean;
}

export function getSupabaseEnvConfig(): SupabaseEnvConfig {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  ).trim();

  const validUrl = Boolean(url && !url.includes('placeholder'));
  const validAnon = Boolean(anonKey && !anonKey.includes('YOUR_') && anonKey !== 'placeholder-key');
  const validService = Boolean(serviceRoleKey && !serviceRoleKey.includes('YOUR_'));

  return {
    url,
    anonKey,
    serviceRoleKey,
    isConfigured: validUrl && (validAnon || validService),
    hasServiceRole: validUrl && validService,
  };
}

export function applyNoStoreHeaders(res: any) {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  );
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json');
}

function getHeader(req: any, name: string): string {
  const lower = name.toLowerCase();
  const val = req.headers?.[lower] ?? req.headers?.[name];
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}

function createAnonSupabaseClient(cfg: SupabaseEnvConfig, bearerToken?: string): SupabaseClient {
  const key = cfg.anonKey || cfg.serviceRoleKey;
  return createClient(cfg.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: bearerToken
      ? {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      : undefined,
  });
}

function createServiceSupabaseClient(cfg: SupabaseEnvConfig): SupabaseClient {
  return createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface VerifiedAdminResult {
  authorized: boolean;
  bearerToken?: string;
  viaServiceRole: boolean;
  reason?: string;
}

export async function verifyAdminRequest(
  req: any,
  cfg: SupabaseEnvConfig
): Promise<VerifiedAdminResult> {
  const authHeader = getHeader(req, 'authorization');
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const adminEmail = getHeader(req, 'x-formfit-admin-email').trim().toLowerCase();
  const adminPasscode = getHeader(req, 'x-formfit-admin-passcode').trim();
  const expectedPasscode = (process.env.ADMIN_PASSCODE || 'FormFit2026!Admin').trim();

  const isMasterHeaderValid =
    (adminEmail === 'admin@formandfit.in' || adminEmail === 'owner@formandfit.in') &&
    Boolean(adminPasscode) &&
    adminPasscode === expectedPasscode;

  // 1. If a Supabase JWT bearer token is present and Supabase is configured, verify it
  if (bearerToken && cfg.isConfigured) {
    try {
      const userClient = createAnonSupabaseClient(cfg, bearerToken);
      const { data: userData, error: userErr } = await userClient.auth.getUser(bearerToken);
      if (!userErr && userData?.user) {
        const emailLower = (userData.user.email || '').toLowerCase();
        if (emailLower === 'admin@formandfit.in' || emailLower === 'owner@formandfit.in') {
          return {
            authorized: true,
            bearerToken,
            viaServiceRole: cfg.hasServiceRole,
          };
        }

        const checkClient = cfg.hasServiceRole
          ? createServiceSupabaseClient(cfg)
          : userClient;

        const { data: profile } = await checkClient
          .from('profiles')
          .select('role')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (profile && (profile.role === 'owner' || profile.role === 'admin')) {
          return {
            authorized: true,
            bearerToken,
            viaServiceRole: cfg.hasServiceRole,
          };
        }

        const { data: roleRow } = await checkClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id)
          .in('role', ['owner', 'admin'])
          .maybeSingle();

        if (roleRow) {
          return {
            authorized: true,
            bearerToken,
            viaServiceRole: cfg.hasServiceRole,
          };
        }
      }
    } catch (err) {
      console.warn('Admin JWT verification notice:', err);
    }
  }

  // 2. Check verified Master Owner Portal credentials
  if (isMasterHeaderValid) {
    return {
      authorized: true,
      bearerToken: bearerToken || undefined,
      viaServiceRole: cfg.hasServiceRole,
    };
  }

  return {
    authorized: false,
    viaServiceRole: false,
    reason: 'Admin authentication required.',
  };
}

/**
 * Normalizes and sorts product images, variants, and category metadata.
 * Strips private `cost_price` and non-active variants when `isPublic === true`.
 */
export function normalizeProductRecord(
  raw: any,
  categories: Category[],
  isPublic: boolean
): Product {
  const rawImages: ProductImage[] = Array.isArray(raw.images) ? raw.images : [];
  const validImages = rawImages
    .filter((img) => img && typeof img.url === 'string' && img.url.trim() && !img.url.startsWith('blob:'))
    .sort((a, b) => {
      if (Boolean(a.is_main) !== Boolean(b.is_main)) {
        return a.is_main ? -1 : 1;
      }
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });

  const rawVariants: ProductVariant[] = Array.isArray(raw.variants) ? raw.variants : [];
  const filteredVariants = isPublic
    ? rawVariants.filter((v) => v && v.is_active !== false)
    : rawVariants;

  const joinedCategory = Array.isArray(raw?.category) ? raw.category[0] : raw?.category;
  const resolvedCategory = resolveCategoryForProduct(
    raw.category_id,
    joinedCategory,
    categories
  );

  const normalized: Product = {
    id: raw.id,
    name: raw.name || 'Untitled Product',
    slug: raw.slug || raw.id,
    sku: raw.sku || undefined,
    short_desc: raw.short_desc || '',
    description: raw.description || '',
    category_id: raw.category_id || resolvedCategory?.id || undefined,
    gender_collection: raw.gender_collection || 'Unisex',
    regular_price: Number(raw.regular_price) || 0,
    sale_price:
      raw.sale_price !== null && raw.sale_price !== undefined && Number(raw.sale_price) > 0
        ? Number(raw.sale_price)
        : undefined,
    ...(isPublic
      ? {}
      : {
          cost_price:
            raw.cost_price !== null && raw.cost_price !== undefined
              ? Number(raw.cost_price)
              : undefined,
        }),
    fabric_material: raw.fabric_material || '',
    fit: raw.fit || '',
    care_instructions: raw.care_instructions || '',
    status: (raw.status as ProductStatus) || 'draft',
    featured: Boolean(raw.featured),
    seo_title: raw.seo_title || raw.name || '',
    seo_description: raw.seo_description || raw.short_desc || '',
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    category: resolvedCategory,
    images: validImages,
    variants: filteredVariants.map((v) => ({
      ...v,
      stock_quantity: Number(v.stock_quantity) || 0,
      price_override:
        v.price_override !== null && v.price_override !== undefined
          ? Number(v.price_override)
          : undefined,
      is_active: v.is_active !== false,
    })),
  };

  if (isPublic) {
    delete (normalized as any).cost_price;
  }

  return normalized;
}

// ============================================================================
// Local File Fallback (Used ONLY in dev/preview when Supabase env is not set)
// ============================================================================

interface LocalCatalogFile {
  categories: Category[];
  products: Product[];
}

function getLocalCatalogFilePath(): string {
  const isVercel = Boolean(process.env.VERCEL);
  const baseDir = isVercel ? '/tmp' : path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  } catch {
    // ignore mkdir errors
  }
  return path.join(baseDir, 'form_fit_catalog.json');
}

function readLocalCatalog(): LocalCatalogFile {
  const filePath = getLocalCatalogFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        categories: normalizeCategoriesList(
          Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_CATEGORIES
        ),
        products: Array.isArray(parsed.products) ? parsed.products : [],
      };
    }
  } catch (err) {
    console.warn('Local catalog read warning:', err);
  }
  return {
    categories: normalizeCategoriesList(DEFAULT_CATEGORIES),
    products: [],
  };
}

function writeLocalCatalog(data: LocalCatalogFile): void {
  const filePath = getLocalCatalogFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================================================
// Supabase Category & Product Persistence Helpers
// ============================================================================

async function ensureCategoryInSupabase(
  db: SupabaseClient,
  requestedCategoryId?: string | null,
  requestedCategoryObj?: Category | null
): Promise<string | null> {
  if (!requestedCategoryId && !requestedCategoryObj) return null;

  const spec =
    getCanonicalCategorySpec(requestedCategoryId) ||
    getCanonicalCategorySpec(requestedCategoryObj?.slug) ||
    getCanonicalCategorySpec(requestedCategoryObj?.id);

  // Check if category already exists in Supabase by slug or UUID
  try {
    if (spec) {
      const { data: existingBySlug } = await db
        .from('categories')
        .select('id, slug')
        .eq('slug', spec.slug)
        .maybeSingle();

      if (existingBySlug?.id) {
        return existingBySlug.id;
      }

      // Ensure parent exists first if subcategory (e.g. Footwear before Men's/Women's Footwear)
      let resolvedParentUuid: string | null = null;
      if (spec.parentAliasId) {
        const parentSpec = getCanonicalCategorySpec(spec.parentAliasId);
        if (parentSpec) {
          const { data: existingParent } = await db
            .from('categories')
            .select('id')
            .eq('slug', parentSpec.slug)
            .maybeSingle();

          if (existingParent?.id) {
            resolvedParentUuid = existingParent.id;
          } else {
            const { data: insertedParent } = await db
              .from('categories')
              .upsert(
                {
                  id: parentSpec.uuid,
                  name: parentSpec.name,
                  slug: parentSpec.slug,
                  description: parentSpec.description,
                  display_order: parentSpec.displayOrder,
                  parent_id: null,
                },
                { onConflict: 'slug' }
              )
              .select('id')
              .maybeSingle();
            resolvedParentUuid = insertedParent?.id || parentSpec.uuid;
          }
        }
      }

      const { data: upsertedCat, error: catErr } = await db
        .from('categories')
        .upsert(
          {
            id: spec.uuid,
            name: spec.name,
            slug: spec.slug,
            description: spec.description,
            display_order: spec.displayOrder,
            parent_id: resolvedParentUuid,
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .maybeSingle();

      if (!catErr && upsertedCat?.id) {
        return upsertedCat.id;
      }
    } else if (requestedCategoryId && isValidUUID(requestedCategoryId)) {
      const { data: existingById } = await db
        .from('categories')
        .select('id')
        .eq('id', requestedCategoryId)
        .maybeSingle();

      if (existingById?.id) {
        return existingById.id;
      }

      if (requestedCategoryObj?.name && requestedCategoryObj?.slug) {
        const { data: upsertedCustom } = await db
          .from('categories')
          .upsert(
            {
              id: requestedCategoryId,
              name: requestedCategoryObj.name,
              slug: requestedCategoryObj.slug,
              description: requestedCategoryObj.description || '',
              display_order: requestedCategoryObj.display_order || 20,
              parent_id: isValidUUID(requestedCategoryObj.parent_id)
                ? requestedCategoryObj.parent_id
                : null,
            },
            { onConflict: 'slug' }
          )
          .select('id')
          .maybeSingle();

        if (upsertedCustom?.id) return upsertedCustom.id;
      }
    }
  } catch (err) {
    console.warn('Category resolution notice:', err);
  }

  return null;
}

function sanitizeSlug(rawSlug: string, fallbackName: string): string {
  const base = (rawSlug || fallbackName || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `item-${Date.now().toString(36)}`;
}

async function resolveUniqueProductSlugAndSku(
  db: SupabaseClient,
  productId: string,
  desiredSlug: string,
  desiredSku: string
): Promise<{ slug: string; sku: string }> {
  let finalSlug = desiredSlug;
  let finalSku = desiredSku;

  const { data: slugOwner } = await db
    .from('products')
    .select('id')
    .eq('slug', finalSlug)
    .maybeSingle();

  if (slugOwner && slugOwner.id !== productId) {
    finalSlug = `${finalSlug}-${productId.slice(0, 6)}`;
  }

  if (finalSku) {
    const { data: skuOwner } = await db
      .from('products')
      .select('id')
      .eq('sku', finalSku)
      .maybeSingle();

    if (skuOwner && skuOwner.id !== productId) {
      finalSku = `${finalSku}-${productId.slice(0, 4).toUpperCase()}`;
    }
  }

  return { slug: finalSlug, sku: finalSku };
}

async function resolveUniqueVariantSku(
  db: SupabaseClient,
  productId: string,
  parentSku: string,
  rawVariantSku: string,
  size: string | undefined,
  index: number,
  usedInBatch: Set<string>
): Promise<string> {
  const cleanSize = (size || `V${index + 1}`).replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
  const isGenericDefault = /^SKU-(S|M|L|XL|XS|XXL|UK\d+|\d+)$/i.test((rawVariantSku || '').trim());

  let candidate =
    !rawVariantSku || !rawVariantSku.trim() || isGenericDefault
      ? `${parentSku}-${cleanSize}`
      : rawVariantSku.trim();

  if (usedInBatch.has(candidate.toUpperCase())) {
    candidate = `${candidate}-${index + 1}`;
  }

  const { data: existingVariant } = await db
    .from('product_variants')
    .select('id, product_id')
    .eq('sku', candidate)
    .maybeSingle();

  if (existingVariant && existingVariant.product_id !== productId) {
    candidate = `${parentSku}-${cleanSize}-${productId.slice(0, 4).toUpperCase()}-${index + 1}`;
  }

  usedInBatch.add(candidate.toUpperCase());
  return candidate;
}

function getWriteSupabaseClient(
  cfg: SupabaseEnvConfig,
  adminAuth: VerifiedAdminResult
): SupabaseClient | null {
  if (cfg.hasServiceRole) {
    return createServiceSupabaseClient(cfg);
  }
  if (cfg.isConfigured && adminAuth.bearerToken) {
    return createAnonSupabaseClient(cfg, adminAuth.bearerToken);
  }
  if (cfg.isConfigured) {
    return createAnonSupabaseClient(cfg);
  }
  return null;
}

// ============================================================================
// HTTP Route Handlers (/api/products, /api/categories, /api/upload-image)
// ============================================================================

export async function handleProductsApi(req: any, res: any) {
  applyNoStoreHeaders(res);

  const method = (req.method || 'GET').toUpperCase();
  const reqUrl = new URL(req.url || '/api/products', `http://${req.headers?.host || 'localhost'}`);
  const scope = req.query?.scope || reqUrl.searchParams.get('scope') || 'public';
  const targetId = req.query?.id || reqUrl.searchParams.get('id') || '';
  const cfg = getSupabaseEnvConfig();

  // --------------------------------------------------------------------------
  // GET /api/products
  // --------------------------------------------------------------------------
  if (method === 'GET') {
    const wantsAdminScope = scope === 'admin';
    let isAuthorizedAdmin = false;
    let adminAuth: VerifiedAdminResult = { authorized: false, viaServiceRole: false };

    if (wantsAdminScope) {
      adminAuth = await verifyAdminRequest(req, cfg);
      isAuthorizedAdmin = adminAuth.authorized;
    }

    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      const sourceList = isAuthorizedAdmin
        ? local.products
        : local.products.filter((p) => p.status === 'published');

      const sorted = [...sourceList]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((p) => normalizeProductRecord(p, local.categories, !isAuthorizedAdmin));

      return res.status(200).json({
        success: true,
        storageMode: 'local-server',
        hasServiceRole: false,
        products: sorted,
      });
    }

    try {
      const readClient =
        isAuthorizedAdmin && cfg.hasServiceRole
          ? createServiceSupabaseClient(cfg)
          : createAnonSupabaseClient(cfg, isAuthorizedAdmin ? adminAuth.bearerToken : undefined);

      const { data: catRows } = await readClient
        .from('categories')
        .select('id, name, slug, description, image_url, display_order, parent_id')
        .order('display_order', { ascending: true });

      const categories = normalizeCategoriesList((catRows as Category[]) || DEFAULT_CATEGORIES);

      const canSelectAdminColumns =
        isAuthorizedAdmin && (cfg.hasServiceRole || Boolean(adminAuth.bearerToken));

      const buildReadQuery = (columns: string) => {
        let q = readClient
          .from('products')
          .select(columns)
          .order('created_at', { ascending: false });
        if (!isAuthorizedAdmin) {
          q = q.eq('status', 'published');
        }
        return q;
      };

      let { data, error } = await buildReadQuery(
        canSelectAdminColumns ? ADMIN_PRODUCT_COLUMNS : PUBLIC_PRODUCT_COLUMNS
      );

      // Fallback if column-level security blocks cost_price on anon key
      if (error && canSelectAdminColumns && error.code === '42501') {
        const retry = await buildReadQuery(PUBLIC_PRODUCT_COLUMNS);
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return res.status(500).json({
          success: false,
          storageMode: 'supabase',
          code: error.code,
          error: error.message,
        });
      }

      const normalizedProducts = (data || []).map((row: any) =>
        normalizeProductRecord(row, categories, !isAuthorizedAdmin)
      );

      return res.status(200).json({
        success: true,
        storageMode: 'supabase',
        hasServiceRole: cfg.hasServiceRole,
        products: normalizedProducts,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        storageMode: 'supabase',
        error: err?.message || 'Failed to read products from database.',
      });
    }
  }

  // All write methods (POST, PATCH, DELETE) strictly require verified admin credentials
  const adminAuth = await verifyAdminRequest(req, cfg);
  if (!adminAuth.authorized) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_ADMIN',
      error: adminAuth.reason || 'Admin authorization required to modify catalog.',
    });
  }

  // --------------------------------------------------------------------------
  // POST /api/products (Create or Update Product + Images + Variants)
  // --------------------------------------------------------------------------
  if (method === 'POST') {
    const body = req.body || {};
    const productInput: Partial<Product> = body.product || body;

    if (!productInput || !productInput.name || !String(productInput.name).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required.',
      });
    }

    const now = new Date().toISOString();
    const productId = ensureValidUUID(productInput.id);
    const parentSku =
      (productInput.sku && String(productInput.sku).trim()) ||
      `FF-${Math.floor(100000 + Math.random() * 900000)}`;
    const desiredSlug = sanitizeSlug(productInput.slug || '', productInput.name);

    // Local server fallback ONLY when Supabase is not configured
    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      const resolvedCat = resolveCategoryForProduct(
        productInput.category_id,
        productInput.category,
        local.categories
      );

      const images: ProductImage[] = (productInput.images || [])
        .filter((i) => i && i.url && !i.url.startsWith('blob:'))
        .map((img, idx) => ({
          id: ensureValidUUID(img.id),
          product_id: productId,
          url: img.url,
          storage_path: img.storage_path,
          is_main: img.is_main ?? idx === 0,
          alt_text: img.alt_text || productInput.name,
          display_order: img.display_order ?? idx,
        }));

      const mainUrl = images.find((i) => i.is_main)?.url || images[0]?.url;

      const variants: ProductVariant[] = (productInput.variants || []).map((v, idx) => ({
        id: ensureValidUUID(v.id),
        product_id: productId,
        sku:
          v.sku && !/^SKU-(S|M|L|UK\d+)$/i.test(v.sku)
            ? v.sku
            : `${parentSku}-${(v.size || idx + 1).toString().replace(/\s+/g, '')}`,
        size: v.size,
        color: v.color,
        color_hex: v.color_hex,
        price_override: v.price_override ? Number(v.price_override) : undefined,
        stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
        variant_image_url: v.variant_image_url || (idx === 0 ? mainUrl : undefined),
        is_active: v.is_active !== false,
      }));

      const existingIdx = local.products.findIndex((p) => p.id === productId);
      const savedProduct: Product = {
        id: productId,
        name: productInput.name.trim(),
        slug:
          local.products.some((p) => p.slug === desiredSlug && p.id !== productId)
            ? `${desiredSlug}-${productId.slice(0, 6)}`
            : desiredSlug,
        sku: parentSku,
        short_desc: productInput.short_desc || '',
        description: productInput.description || '',
        category_id: productInput.category_id || resolvedCat?.id,
        gender_collection: productInput.gender_collection || 'Unisex',
        regular_price: Number(productInput.regular_price) || 0,
        sale_price: productInput.sale_price ? Number(productInput.sale_price) : undefined,
        cost_price: productInput.cost_price ? Number(productInput.cost_price) : undefined,
        fabric_material: productInput.fabric_material || '',
        fit: productInput.fit || '',
        care_instructions: productInput.care_instructions || '',
        status: productInput.status || 'published',
        featured: Boolean(productInput.featured),
        seo_title: productInput.seo_title || productInput.name.trim(),
        seo_description: productInput.seo_description || productInput.short_desc || '',
        created_at:
          existingIdx > -1 ? local.products[existingIdx].created_at : productInput.created_at || now,
        updated_at: now,
        category: resolvedCat,
        images,
        variants,
      };

      if (existingIdx > -1) {
        local.products[existingIdx] = savedProduct;
      } else {
        local.products.unshift(savedProduct);
      }
      writeLocalCatalog(local);

      return res.status(200).json({
        success: true,
        storageMode: 'local-server',
        product: normalizeProductRecord(savedProduct, local.categories, false),
      });
    }

    // Production Supabase Write Path
    const writeClient = getWriteSupabaseClient(cfg, adminAuth);
    if (!writeClient) {
      return res.status(500).json({
        success: false,
        error: 'Supabase client is not configured on server.',
      });
    }

    try {
      const resolvedCategoryUuid = await ensureCategoryInSupabase(
        writeClient,
        productInput.category_id,
        productInput.category
      );

      const { slug: uniqueSlug, sku: uniqueSku } = await resolveUniqueProductSlugAndSku(
        writeClient,
        productId,
        desiredSlug,
        parentSku
      );

      const dbPayload: Record<string, any> = {
        id: productId,
        name: productInput.name.trim(),
        slug: uniqueSlug,
        sku: uniqueSku,
        short_desc: productInput.short_desc || '',
        description: productInput.description || '',
        category_id: resolvedCategoryUuid,
        gender_collection: productInput.gender_collection || 'Unisex',
        regular_price: Number(productInput.regular_price) || 0,
        sale_price:
          productInput.sale_price !== undefined &&
          productInput.sale_price !== null &&
          Number(productInput.sale_price) > 0
            ? Number(productInput.sale_price)
            : null,
        cost_price:
          productInput.cost_price !== undefined &&
          productInput.cost_price !== null &&
          Number(productInput.cost_price) > 0
            ? Number(productInput.cost_price)
            : null,
        fabric_material: productInput.fabric_material || '',
        fit: productInput.fit || '',
        care_instructions: productInput.care_instructions || '',
        status: productInput.status || 'published',
        featured: Boolean(productInput.featured),
        seo_title: productInput.seo_title || productInput.name.trim(),
        seo_description: productInput.seo_description || productInput.short_desc || '',
        updated_at: now,
      };

      if (productInput.created_at) {
        dbPayload.created_at = productInput.created_at;
      }

      let { error: prodErr } = await writeClient.from('products').upsert(dbPayload);

      // If category_id FK still failed (e.g. unseeded categories table under anon/user RLS), retry with category_id: null
      if (prodErr && prodErr.code === '23503' && dbPayload.category_id) {
        dbPayload.category_id = null;
        const retryRes = await writeClient.from('products').upsert(dbPayload);
        prodErr = retryRes.error;
      }

      if (prodErr) {
        const isRls = prodErr.code === '42501';
        return res.status(isRls ? 403 : 400).json({
          success: false,
          code: prodErr.code,
          error: isRls
            ? 'Supabase RLS blocked product write: sign in with your Supabase Owner account, add SUPABASE_SERVICE_ROLE_KEY in Vercel, or run supabase/fix_product_visibility_rls.sql in Supabase SQL Editor.'
            : `Database product save failed: ${prodErr.message}`,
        });
      }

      // Sync product_images
      const incomingImages = (productInput.images || []).filter(
        (img) => img && typeof img.url === 'string' && img.url.trim() && !img.url.startsWith('blob:')
      );
      const normalizedImages = incomingImages.map((img, idx) => ({
        id: ensureValidUUID(img.id),
        product_id: productId,
        url: img.url,
        storage_path: img.storage_path || null,
        is_main: img.is_main ?? idx === 0,
        alt_text: img.alt_text || productInput.name || null,
        display_order: img.display_order ?? idx,
      }));

      const { data: existingImgs } = await writeClient
        .from('product_images')
        .select('id')
        .eq('product_id', productId);

      const keepImageIds = new Set(normalizedImages.map((i) => i.id));
      const removeImageIds = (existingImgs || [])
        .map((r: any) => r.id)
        .filter((id: string) => !keepImageIds.has(id));

      if (removeImageIds.length > 0) {
        await writeClient.from('product_images').delete().in('id', removeImageIds);
      }

      if (normalizedImages.length > 0) {
        const { error: imgErr } = await writeClient
          .from('product_images')
          .upsert(normalizedImages);
        if (imgErr) {
          return res.status(400).json({
            success: false,
            code: imgErr.code,
            error: `Product saved, but image sync failed: ${imgErr.message}`,
          });
        }
      }

      // Sync product_variants with collision-proof SKUs
      const mainImgUrl =
        normalizedImages.find((i) => i.is_main)?.url || normalizedImages[0]?.url || null;
      const incomingVariants = productInput.variants || [];
      const usedSkus = new Set<string>();
      const normalizedVariants: Array<Record<string, any>> = [];

      for (let idx = 0; idx < incomingVariants.length; idx++) {
        const v = incomingVariants[idx];
        const vId = ensureValidUUID(v.id);
        const safeSku = await resolveUniqueVariantSku(
          writeClient,
          productId,
          uniqueSku,
          v.sku,
          v.size,
          idx,
          usedSkus
        );
        normalizedVariants.push({
          id: vId,
          product_id: productId,
          sku: safeSku,
          size: v.size || null,
          color: v.color || null,
          color_hex: v.color_hex || null,
          price_override:
            v.price_override !== undefined && v.price_override !== null && Number(v.price_override) > 0
              ? Number(v.price_override)
              : null,
          stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
          variant_image_url:
            v.variant_image_url && !v.variant_image_url.startsWith('blob:')
              ? v.variant_image_url
              : idx === 0
              ? mainImgUrl
              : null,
          is_active: v.is_active !== false,
          updated_at: now,
        });
      }

      const { data: existingVars } = await writeClient
        .from('product_variants')
        .select('id')
        .eq('product_id', productId);

      const keepVarIds = new Set(normalizedVariants.map((v) => v.id));
      const removeVarIds = (existingVars || [])
        .map((r: any) => r.id)
        .filter((id: string) => !keepVarIds.has(id));

      if (removeVarIds.length > 0) {
        await writeClient.from('product_variants').delete().in('id', removeVarIds);
      }

      if (normalizedVariants.length > 0) {
        const { error: varErr } = await writeClient
          .from('product_variants')
          .upsert(normalizedVariants);
        if (varErr) {
          return res.status(400).json({
            success: false,
            code: varErr.code,
            error: `Product saved, but variant sync failed: ${varErr.message}`,
          });
        }
      }

      // Read back the persisted record to confirm 100% database persistence
      const { data: verifiedRow, error: verifyErr } = await writeClient
        .from('products')
        .select(ADMIN_PRODUCT_COLUMNS)
        .eq('id', productId)
        .maybeSingle();

      if (verifyErr || !verifiedRow) {
        return res.status(500).json({
          success: false,
          error:
            verifyErr?.message ||
            'Product write could not be verified in Supabase. Check RLS policies.',
        });
      }

      const { data: catRows } = await writeClient
        .from('categories')
        .select('id, name, slug, description, image_url, display_order, parent_id');
      const categories = normalizeCategoriesList((catRows as Category[]) || DEFAULT_CATEGORIES);

      return res.status(200).json({
        success: true,
        storageMode: 'supabase',
        product: normalizeProductRecord(verifiedRow, categories, false),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Unexpected error saving product to Supabase.',
      });
    }
  }

  // --------------------------------------------------------------------------
  // PATCH /api/products (Toggle status or update variant stock)
  // --------------------------------------------------------------------------
  if (method === 'PATCH') {
    const body = req.body || {};
    const id = body.id || targetId;

    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      if (body.variantId && typeof body.quantityChange === 'number') {
        local.products = local.products.map((p) => ({
          ...p,
          variants: (p.variants || []).map((v) =>
            v.id === body.variantId
              ? { ...v, stock_quantity: Math.max(0, v.stock_quantity + body.quantityChange) }
              : v
          ),
        }));
        writeLocalCatalog(local);
        return res.status(200).json({ success: true, storageMode: 'local-server' });
      }

      const idx = local.products.findIndex((p) => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }
      const nextStatus: ProductStatus =
        body.status || (local.products[idx].status === 'published' ? 'draft' : 'published');
      local.products[idx] = {
        ...local.products[idx],
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      writeLocalCatalog(local);
      return res.status(200).json({
        success: true,
        storageMode: 'local-server',
        product: local.products[idx],
      });
    }

    const writeClient = getWriteSupabaseClient(cfg, adminAuth);
    if (!writeClient) {
      return res.status(500).json({ success: false, error: 'Supabase not configured.' });
    }

    if (body.variantId && typeof body.quantityChange === 'number') {
      const { data: vRow, error: vFetchErr } = await writeClient
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', body.variantId)
        .maybeSingle();

      if (vFetchErr || !vRow) {
        return res.status(404).json({
          success: false,
          error: vFetchErr?.message || 'Variant not found in database.',
        });
      }
      const nextQty = Math.max(0, Number(vRow.stock_quantity) + Number(body.quantityChange));
      const { error: vUpdErr } = await writeClient
        .from('product_variants')
        .update({ stock_quantity: nextQty, updated_at: new Date().toISOString() })
        .eq('id', body.variantId);

      if (vUpdErr) {
        return res.status(400).json({ success: false, error: vUpdErr.message });
      }
      return res.status(200).json({ success: true, stock_quantity: nextQty });
    }

    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID is required.' });
    }

    const nextStatus: ProductStatus = body.status;
    const { data: updatedRows, error: updErr } = await writeClient
      .from('products')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', ensureValidUUID(id))
      .select(ADMIN_PRODUCT_COLUMNS);

    if (updErr) {
      return res.status(updErr.code === '42501' ? 403 : 400).json({
        success: false,
        code: updErr.code,
        error: updErr.message,
      });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'PRODUCT_NOT_IN_DB',
        error: 'Product does not exist in database yet. Save/sync the full product first.',
      });
    }

    return res.status(200).json({
      success: true,
      storageMode: 'supabase',
      product: normalizeProductRecord(updatedRows[0], DEFAULT_CATEGORIES, false),
    });
  }

  // --------------------------------------------------------------------------
  // DELETE /api/products?id=...
  // --------------------------------------------------------------------------
  if (method === 'DELETE') {
    const id = targetId || req.body?.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID is required.' });
    }

    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      local.products = local.products.filter((p) => p.id !== id);
      writeLocalCatalog(local);
      return res.status(200).json({ success: true, storageMode: 'local-server' });
    }

    const writeClient = getWriteSupabaseClient(cfg, adminAuth);
    if (!writeClient) {
      return res.status(500).json({ success: false, error: 'Supabase not configured.' });
    }

    const { error: delErr } = await writeClient
      .from('products')
      .delete()
      .eq('id', ensureValidUUID(id));

    if (delErr) {
      return res.status(delErr.code === '42501' ? 403 : 400).json({
        success: false,
        code: delErr.code,
        error: delErr.message,
      });
    }

    return res.status(200).json({ success: true, storageMode: 'supabase' });
  }

  return res.status(405).json({ success: false, error: `Method ${method} not allowed.` });
}

export async function handleCategoriesApi(req: any, res: any) {
  applyNoStoreHeaders(res);
  const method = (req.method || 'GET').toUpperCase();
  const reqUrl = new URL(req.url || '/api/categories', `http://${req.headers?.host || 'localhost'}`);
  const targetId = req.query?.id || reqUrl.searchParams.get('id') || '';
  const cfg = getSupabaseEnvConfig();

  if (method === 'GET') {
    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      return res.status(200).json({
        success: true,
        storageMode: 'local-server',
        categories: local.categories,
      });
    }

    try {
      const client = createAnonSupabaseClient(cfg);
      const { data, error } = await client
        .from('categories')
        .select('id, name, slug, description, image_url, display_order, parent_id')
        .order('display_order', { ascending: true });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      const categories =
        data && data.length > 0
          ? normalizeCategoriesList(data as Category[])
          : normalizeCategoriesList(DEFAULT_CATEGORIES);

      return res.status(200).json({
        success: true,
        storageMode: 'supabase',
        categories,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to load categories.',
      });
    }
  }

  const adminAuth = await verifyAdminRequest(req, cfg);
  if (!adminAuth.authorized) {
    return res.status(401).json({
      success: false,
      error: 'Admin authorization required to modify categories.',
    });
  }

  if (method === 'POST') {
    const catInput: Partial<Category> = req.body?.category || req.body || {};
    if (!catInput.name || !catInput.name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }

    const spec = getCanonicalCategorySpec(catInput.id) || getCanonicalCategorySpec(catInput.slug);
    const catId = spec ? spec.uuid : ensureValidUUID(catInput.id);
    const slug =
      spec?.slug ||
      sanitizeSlug(catInput.slug || '', catInput.name);

    const parentSpec = getCanonicalCategorySpec(catInput.parent_id);
    const parentId = parentSpec
      ? parentSpec.uuid
      : isValidUUID(catInput.parent_id)
      ? catInput.parent_id
      : undefined;

    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      const newCat: Category = {
        id: catInput.id || catId,
        name: catInput.name.trim(),
        slug,
        description: catInput.description || '',
        image_url: catInput.image_url,
        display_order: catInput.display_order || local.categories.length + 1,
        parent_id: catInput.parent_id || parentId,
      };
      const existsIdx = local.categories.findIndex((c) => c.id === newCat.id || c.slug === newCat.slug);
      if (existsIdx > -1) {
        local.categories[existsIdx] = newCat;
      } else {
        local.categories.push(newCat);
      }
      writeLocalCatalog(local);
      return res.status(200).json({ success: true, category: newCat, categories: local.categories });
    }

    const writeClient = getWriteSupabaseClient(cfg, adminAuth);
    if (!writeClient) {
      return res.status(500).json({ success: false, error: 'Supabase not configured.' });
    }

    // Seed all canonical categories first if table is empty so parent FKs exist
    for (const cSpec of CANONICAL_CATEGORIES.filter((c) => !c.parentUuid)) {
      await writeClient
        .from('categories')
        .upsert(
          {
            id: cSpec.uuid,
            name: cSpec.name,
            slug: cSpec.slug,
            description: cSpec.description,
            display_order: cSpec.displayOrder,
            parent_id: null,
          },
          { onConflict: 'slug' }
        );
    }

    const { data: savedCat, error: saveErr } = await writeClient
      .from('categories')
      .upsert(
        {
          id: catId,
          name: catInput.name.trim(),
          slug,
          description: catInput.description || '',
          image_url: catInput.image_url || null,
          display_order: catInput.display_order || 20,
          parent_id: parentId || null,
        },
        { onConflict: 'slug' }
      )
      .select('*')
      .maybeSingle();

    if (saveErr) {
      return res.status(saveErr.code === '42501' ? 403 : 400).json({
        success: false,
        error: saveErr.message,
      });
    }

    return res.status(200).json({ success: true, category: savedCat });
  }

  if (method === 'DELETE') {
    const id = targetId || req.body?.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Category ID is required.' });
    }

    if (!cfg.isConfigured) {
      const local = readLocalCatalog();
      local.categories = local.categories.filter((c) => c.id !== id);
      writeLocalCatalog(local);
      return res.status(200).json({ success: true });
    }

    const writeClient = getWriteSupabaseClient(cfg, adminAuth);
    if (!writeClient) {
      return res.status(500).json({ success: false, error: 'Supabase not configured.' });
    }

    const spec = getCanonicalCategorySpec(id);
    const deleteQuery = spec
      ? writeClient.from('categories').delete().eq('slug', spec.slug)
      : writeClient.from('categories').delete().eq('id', ensureValidUUID(id));

    const { error: delErr } = await deleteQuery;
    if (delErr) {
      return res.status(400).json({ success: false, error: delErr.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: `Method ${method} not allowed.` });
}

export async function handleUploadImageApi(req: any, res: any) {
  applyNoStoreHeaders(res);
  if ((req.method || '').toUpperCase() !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const cfg = getSupabaseEnvConfig();
  const adminAuth = await verifyAdminRequest(req, cfg);
  if (!adminAuth.authorized) {
    return res.status(401).json({ success: false, error: 'Admin authorization required.' });
  }

  const { dataUrl, fileName } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ success: false, error: 'Valid image dataUrl is required.' });
  }

  if (!cfg.isConfigured) {
    return res.status(200).json({
      success: true,
      url: dataUrl,
      path: `inline/${fileName || 'image.webp'}`,
      source: 'inline-db',
    });
  }

  const writeClient = getWriteSupabaseClient(cfg, adminAuth);
  if (!writeClient) {
    return res.status(200).json({
      success: true,
      url: dataUrl,
      path: `inline/${fileName || 'image.webp'}`,
      source: 'inline-db',
    });
  }

  try {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
      return res.status(200).json({
        success: true,
        url: dataUrl,
        path: `inline/${fileName || 'image.webp'}`,
        source: 'inline-db',
      });
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType.includes('webp')
      ? 'webp'
      : mimeType.includes('png')
      ? 'png'
      : 'jpg';
    const safeName = `${Math.random().toString(36).slice(2, 12)}_${Date.now()}.${ext}`;
    const storagePath = `products/${safeName}`;

    // If service role is available, ensure the public bucket exists
    if (cfg.hasServiceRole) {
      await writeClient.storage.createBucket('product-images', {
        public: true,
      }).catch(() => {});
    }

    const { error: uploadErr } = await writeClient.storage
      .from('product-images')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadErr) {
      return res.status(200).json({
        success: true,
        url: dataUrl,
        path: storagePath,
        source: 'inline-db',
        notice: uploadErr.message,
      });
    }

    const { data: pubData } = writeClient.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    return res.status(200).json({
      success: true,
      url: pubData.publicUrl,
      path: storagePath,
      source: 'supabase',
    });
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      url: dataUrl,
      path: `inline/${fileName || 'image.webp'}`,
      source: 'inline-db',
      notice: err?.message,
    });
  }
}
