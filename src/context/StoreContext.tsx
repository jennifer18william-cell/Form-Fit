import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Product,
  Category,
  CartItem,
  WishlistItem,
  Order,
  Coupon,
  Review,
  StoreSettings,
  ContactMessage,
  ProductVariant,
  ProductImage,
  ShippingAddress,
  CustomDesignData,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_STORE_SETTINGS,
  DEFAULT_COUPONS,
  INITIAL_PRODUCTS,
} from '../data/initialData';
import {
  supabase,
  isSupabaseConfigured,
  getAdminRequestHeaders,
  getCustomerAuthHeaders,
  subscribeToRealtimeSync,
  broadcastRealtimeSync,
  RealtimeTopic,
} from '../lib/supabase';
import {
  generateUUID,
  getFashionFallbackImage,
  resolvePublicImageUrl,
} from '../lib/imageOptimization';
import {
  CANONICAL_CATEGORIES,
  ensureValidUUID,
  getCanonicalCategorySpec,
  isValidUUID,
  normalizeCategoriesList,
  resolveCategoryForProduct,
} from '../lib/categoryMapping';
import { useAuth } from './AuthContext';

export interface InventoryLog {
  id: string;
  productName: string;
  variantSku: string;
  quantityChange: number;
  reason: string;
  createdAt: string;
}

const PUBLIC_PRODUCT_SELECT = `
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

const ADMIN_PRODUCT_SELECT = `
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

interface StoreContextType {
  products: Product[];
  categories: Category[];
  cart: CartItem[];
  wishlist: WishlistItem[];
  orders: Order[];
  coupons: Coupon[];
  reviews: Review[];
  addresses: ShippingAddress[];
  storeSettings: StoreSettings;
  contactMessages: ContactMessage[];
  inventoryLogs: InventoryLog[];
  appliedCoupon: Coupon | null;
  loading: boolean;
  catalogError: string | null;
  unsyncedLocalProducts: Product[];
  refreshCatalog: () => Promise<void>;
  syncLocalProductsToDatabase: () => Promise<{ synced: number; failed: number; error?: string }>;

  // Product operations
  saveProduct: (productData: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductStatus: (id: string) => Promise<void>;

  // Category operations
  saveCategory: (categoryData: Partial<Category>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  // Inventory operations
  adjustVariantStock: (variantId: string, quantityChange: number, reason: string) => Promise<void>;

  // Cart operations
  addToCart: (
    product: Product,
    variant: ProductVariant,
    quantity?: number,
    customDesign?: CustomDesignData
  ) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;

  // Coupon operations
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  saveCoupon: (couponData: Partial<Coupon>) => Promise<Coupon>;
  deleteCoupon: (id: string) => Promise<void>;

  // Wishlist operations
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;

  // Order & Address operations
  createOrder: (orderData: {
    customerEmail: string;
    customerPhone: string;
    shippingAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<{ success: boolean; orderId?: string; orderNumber?: string; message?: string }>;
  updateOrderStatus: (orderId: string, status: OrderStatus, trackingNumber?: string) => Promise<void>;
  updatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => Promise<void>;
  saveAddress: (address: ShippingAddress) => Promise<void>;

  // Review & Settings
  addReview: (productId: string, rating: number, comment: string, reviewerName: string) => Promise<void>;
  updateStoreSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  sendContactMessage: (msg: { name: string; email: string; subject?: string; message: string }) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

function safeStorageSet(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`LocalStorage write warning for ${key}:`, err);
  }
}

function readLegacyLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem('form_fit_products');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeClientProduct(
  raw: any,
  categoriesList: Category[],
  stripPrivateFields: boolean
): Product {
  const joinedCat = Array.isArray(raw?.category) ? raw.category[0] : raw?.category;
  const resolvedCat = resolveCategoryForProduct(raw.category_id, joinedCat, categoriesList);
  const fallbackImg = getFashionFallbackImage(raw.name, resolvedCat?.name);

  const rawImages: ProductImage[] = Array.isArray(raw.images) ? raw.images : [];
  const cleanedImages: ProductImage[] =
    rawImages.length > 0 && rawImages.some((i) => Boolean(i?.url) && !String(i.url).startsWith('blob:'))
      ? rawImages
          .filter((i) => Boolean(i?.url) && !String(i.url).startsWith('blob:'))
          .map((img, idx) => ({
            ...img,
            id: img.id || generateUUID(),
            product_id: raw.id,
            url: resolvePublicImageUrl(img.url, raw.name, resolvedCat?.name),
            is_main: img.is_main ?? idx === 0,
            display_order: img.display_order ?? idx,
          }))
          .sort((a, b) => {
            if (Boolean(a.is_main) !== Boolean(b.is_main)) return a.is_main ? -1 : 1;
            return (a.display_order ?? 0) - (b.display_order ?? 0);
          })
      : [
          {
            id: generateUUID(),
            product_id: raw.id,
            url: fallbackImg,
            is_main: true,
            display_order: 0,
          },
        ];

  const mainUrl = cleanedImages.find((i) => i.is_main)?.url || cleanedImages[0]?.url || fallbackImg;
  const rawVariants: ProductVariant[] = Array.isArray(raw.variants) ? raw.variants : [];
  const filteredVariants = stripPrivateFields
    ? rawVariants.filter((v) => v && v.is_active !== false)
    : rawVariants;

  const cleaned: Product = {
    ...raw,
    regular_price: Number(raw.regular_price) || 0,
    sale_price:
      raw.sale_price !== undefined && raw.sale_price !== null && Number(raw.sale_price) > 0
        ? Number(raw.sale_price)
        : undefined,
    category: resolvedCat,
    images: cleanedImages,
    variants: filteredVariants.map((v, idx) => ({
      ...v,
      stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
      is_active: v.is_active !== false,
      variant_image_url: v.variant_image_url
        ? resolvePublicImageUrl(v.variant_image_url, raw.name, resolvedCat?.name)
        : idx === 0
        ? mainUrl
        : undefined,
    })),
  };

  if (stripPrivateFields) {
    delete (cleaned as any).cost_price;
  }

  return cleaned;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();

  // Never initialize public storefront from stale browser localStorage; always load authoritative shared DB state
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [unsyncedLocalProducts, setUnsyncedLocalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const autoSyncAttemptedRef = useRef<boolean>(false);
  const realtimeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('form_fit_categories');
    if (!saved) return normalizeCategoriesList(DEFAULT_CATEGORIES);
    try {
      const parsed: Category[] = JSON.parse(saved);
      return normalizeCategoriesList(parsed);
    } catch {
      return normalizeCategoriesList(DEFAULT_CATEGORIES);
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('form_fit_cart');
    if (!saved) return [];
    try {
      const parsed: CartItem[] = JSON.parse(saved);
      return parsed.map((item) => {
        const resolvedUrl = resolvePublicImageUrl(
          item.variant?.variant_image_url ||
            item.product?.images?.find((i) => i.is_main)?.url ||
            item.product?.images?.[0]?.url,
          item.product?.name,
          item.product?.category?.name
        );
        return {
          ...item,
          variant: {
            ...item.variant,
            variant_image_url: resolvedUrl,
          },
          product: {
            ...item.product,
            images:
              item.product?.images &&
              item.product.images.length > 0 &&
              item.product.images.some((i) => Boolean(i.url))
                ? item.product.images.map((img) => ({
                    ...img,
                    url: resolvePublicImageUrl(img.url, item.product?.name, item.product?.category?.name),
                  }))
                : [
                    {
                      id: generateUUID(),
                      product_id: item.product?.id || 'prod',
                      url: resolvedUrl,
                      is_main: true,
                      display_order: 0,
                    },
                  ],
          },
        };
      });
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    const saved = localStorage.getItem('form_fit_wishlist');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('form_fit_orders');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    const saved = localStorage.getItem('form_fit_coupons');
    if (!saved) return DEFAULT_COUPONS;
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_COUPONS;
    }
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem('form_fit_reviews');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [addresses, setAddresses] = useState<ShippingAddress[]>(() => {
    const saved = localStorage.getItem('form_fit_addresses');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('form_fit_store_settings');
    if (!saved) return DEFAULT_STORE_SETTINGS;
    try {
      return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_STORE_SETTINGS;
    }
  });

  const [contactMessages, setContactMessages] = useState<ContactMessage[]>(() => {
    const saved = localStorage.getItem('form_fit_contact_messages');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>(() => {
    const saved = localStorage.getItem('form_fit_inventory_logs');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    safeStorageSet('form_fit_categories', categories);
  }, [categories]);

  useEffect(() => {
    safeStorageSet('form_fit_cart', cart);
  }, [cart]);

  useEffect(() => {
    safeStorageSet('form_fit_wishlist', wishlist);
  }, [wishlist]);

  useEffect(() => {
    safeStorageSet('form_fit_orders', orders);
  }, [orders]);

  useEffect(() => {
    safeStorageSet('form_fit_coupons', coupons);
  }, [coupons]);

  useEffect(() => {
    safeStorageSet('form_fit_addresses', addresses);
  }, [addresses]);

  useEffect(() => {
    safeStorageSet('form_fit_store_settings', storeSettings);
  }, [storeSettings]);

  useEffect(() => {
    safeStorageSet('form_fit_inventory_logs', inventoryLogs);
  }, [inventoryLogs]);

  // Fetch Store Settings, Promo Coupons, and Reviews from Shared Database
  const fetchStoreBootstrap = useCallback(async () => {
    try {
      const res = await fetch(`/api/store?resource=bootstrap&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          if (json.storeSettings) {
            setStoreSettings((prev) => ({ ...prev, ...json.storeSettings }));
          }
          if (Array.isArray(json.coupons) && json.coupons.length > 0) {
            setCoupons(json.coupons);
          }
          if (Array.isArray(json.reviews)) {
            setReviews(json.reviews);
          }
          return;
        }
      }
    } catch {
      // fall through to direct Supabase read
    }

    if (isSupabaseConfigured()) {
      try {
        const [settingsRes, couponsRes, reviewsRes] = await Promise.all([
          supabase.from('store_settings').select('value').eq('key', 'general').maybeSingle(),
          supabase.from('coupons').select('*').order('created_at', { ascending: false }),
          supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(100),
        ]);
        if (settingsRes.data?.value && typeof settingsRes.data.value === 'object') {
          setStoreSettings((prev) => ({ ...prev, ...(settingsRes.data!.value as Partial<StoreSettings>) }));
        }
        if (couponsRes.data && couponsRes.data.length > 0) {
          setCoupons(couponsRes.data as Coupon[]);
        }
        if (reviewsRes.data) {
          setReviews(reviewsRes.data as Review[]);
        }
      } catch (err) {
        console.warn('Store bootstrap fetch notice:', err);
      }
    }
  }, []);

  // Fetch Categories from Shared Database / API
  const fetchCategories = useCallback(async (): Promise<Category[]> => {
    try {
      const apiRes = await fetch(`/api/categories?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (
          json?.success &&
          Array.isArray(json.categories) &&
          (json.storageMode === 'supabase' || !isSupabaseConfigured())
        ) {
          const normalized = normalizeCategoriesList(json.categories);
          setCategories(normalized);
          return normalized;
        }
      }
    } catch {
      // fall through to direct Supabase fetch
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, slug, description, image_url, display_order, parent_id')
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          const normalized = normalizeCategoriesList(data as Category[]);
          setCategories(normalized);
          return normalized;
        }
      } catch (err) {
        console.error('Failed to fetch categories from Supabase:', err);
      }
    }

    return categories;
  }, []);

  // Fetch Products from Shared Production Database (Never masked by stale localStorage)
  const refreshCatalog = useCallback(async () => {
    setCatalogError(null);
    const activeCategories = await fetchCategories();

    let fetchedFromSharedDb = false;
    let dbProducts: Product[] = [];
    let lastError: string | null = null;

    // 1. Query backend API `/api/products` (cache-busted, strips `cost_price` for public visitors)
    try {
      const scopeParam = isAdmin ? 'admin' : 'public';
      const headers = isAdmin ? await getAdminRequestHeaders() : undefined;
      const res = await fetch(`/api/products?scope=${scopeParam}&t=${Date.now()}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (res.ok) {
        const payload = await res.json();
        const useApiResult =
          payload?.success &&
          Array.isArray(payload.products) &&
          (payload.storageMode === 'supabase' || !isSupabaseConfigured());

        if (useApiResult) {
          dbProducts = (payload.products as Product[]).map((p) =>
            normalizeClientProduct(p, activeCategories, !isAdmin)
          );
          fetchedFromSharedDb = true;
        }
      } else {
        const errPayload = await res.json().catch(() => null);
        if (errPayload?.error && isSupabaseConfigured()) {
          lastError = errPayload.error;
        }
      }
    } catch {
      // Fall back to direct Supabase SDK query below if configured
    }

    // 2. Direct Supabase query fallback
    if (!fetchedFromSharedDb && isSupabaseConfigured()) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const hasSupabaseJwt = Boolean(sessionData?.session?.access_token);
        const selectColumns = isAdmin && hasSupabaseJwt ? ADMIN_PRODUCT_SELECT : PUBLIC_PRODUCT_SELECT;

        const runSelect = async (cols: string) => {
          let q = supabase
            .from('products')
            .select(cols)
            .order('created_at', { ascending: false });
          if (!isAdmin) {
            q = q.eq('status', 'published');
          }
          return q;
        };

        let { data, error } = await runSelect(selectColumns);
        if (error && selectColumns === ADMIN_PRODUCT_SELECT && error.code === '42501') {
          const retry = await runSelect(PUBLIC_PRODUCT_SELECT);
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          lastError = error.message;
        } else {
          dbProducts = ((data as any[]) || []).map((row) =>
            normalizeClientProduct(row as Product, activeCategories, !isAdmin)
          );
          fetchedFromSharedDb = true;
          lastError = null;
        }
      } catch (err: any) {
        lastError = err?.message || 'Unable to load catalog from database.';
      }
    }

    if (fetchedFromSharedDb) {
      const sorted = [...dbProducts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setProducts(sorted);

      if (isAdmin) {
        const legacyLocal = readLegacyLocalProducts();
        if (legacyLocal.length > 0) {
          const dbIdSet = new Set(sorted.map((p) => ensureValidUUID(p.id)));
          const dbSlugSet = new Set(sorted.map((p) => p.slug?.toLowerCase()));
          const stranded = legacyLocal.filter(
            (lp) =>
              lp &&
              lp.name &&
              !dbIdSet.has(ensureValidUUID(lp.id)) &&
              !dbSlugSet.has((lp.slug || '').toLowerCase())
          );
          setUnsyncedLocalProducts(stranded);
          if (stranded.length === 0) {
            localStorage.removeItem('form_fit_products');
          }
        } else {
          setUnsyncedLocalProducts([]);
        }
      } else {
        setUnsyncedLocalProducts([]);
      }
    } else if (lastError) {
      setCatalogError(lastError);
    }

    setLoading(false);
  }, [isAdmin, fetchCategories]);

  // Fetch Orders for Admin (all orders) or Logged-In Customer (their own orders)
  const fetchOrdersFromSupabase = useCallback(async () => {
    if (!user && !isAdmin) return;
    try {
      const headers = isAdmin ? await getAdminRequestHeaders() : await getCustomerAuthHeaders();
      const apiRes = await fetch(`/api/store?resource=orders&t=${Date.now()}`, {
        headers,
        cache: 'no-store',
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json?.success && Array.isArray(json.orders) && json.storageMode === 'supabase') {
          setOrders(json.orders as Order[]);
          return;
        }
      }
    } catch {
      // fall through to direct Supabase query
    }

    if (!isSupabaseConfigured()) return;
    try {
      let query = supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false });
      if (!isAdmin && user) {
        query = query.eq('user_id', user.id);
      }
      const { data, error } = await query;
      if (!error && data) {
        setOrders(data as Order[]);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, [isAdmin, user]);

  // Fetch Saved Shipping Addresses for Logged-In Customer
  const fetchAddressesFromSupabase = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      return;
    }
    try {
      const headers = await getCustomerAuthHeaders();
      if (headers.Authorization) {
        const res = await fetch(`/api/store?resource=addresses&t=${Date.now()}`, {
          headers,
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.addresses)) {
            setAddresses(json.addresses as ShippingAddress[]);
            return;
          }
        }
      }
    } catch {
      // fall through
    }

    if (isSupabaseConfigured() && isValidUUID(user.id)) {
      try {
        const { data } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (data) {
          setAddresses(data as ShippingAddress[]);
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

  // Initial load, tab visibility refresh, and LIVE Real-Time WebSocket + Cross-Tab Subscription
  useEffect(() => {
    refreshCatalog();
    fetchStoreBootstrap();
    fetchOrdersFromSupabase();
    fetchAddressesFromSupabase();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshCatalog();
        fetchStoreBootstrap();
        fetchOrdersFromSupabase();
      }
    };

    const scheduleRealtimeRefresh = (topic: RealtimeTopic) => {
      if (realtimeTimersRef.current[topic]) {
        clearTimeout(realtimeTimersRef.current[topic]);
      }
      realtimeTimersRef.current[topic] = setTimeout(() => {
        if (topic === 'catalog' || topic === 'categories' || topic === 'all') {
          refreshCatalog();
        }
        if (topic === 'settings' || topic === 'coupons' || topic === 'all') {
          fetchStoreBootstrap();
        }
        if (topic === 'orders' || topic === 'all') {
          fetchOrdersFromSupabase();
        }
      }, 220);
    };

    const unsubscribeRealtime = subscribeToRealtimeSync(scheduleRealtimeRefresh);

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      unsubscribeRealtime();
      Object.values(realtimeTimersRef.current).forEach(clearTimeout);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [
    refreshCatalog,
    fetchStoreBootstrap,
    fetchOrdersFromSupabase,
    fetchAddressesFromSupabase,
  ]);

  /**
   * Direct client-side Supabase persistence fallback when server does not hold `SUPABASE_SERVICE_ROLE_KEY`,
   * using the browser's authenticated Owner JWT session + UUID category mapping + collision-safe SKUs.
   */
  const persistProductViaSupabaseClient = async (fullProduct: Product): Promise<Product> => {
    const productId = ensureValidUUID(fullProduct.id);
    const now = new Date().toISOString();

    let resolvedCategoryUuid: string | null = null;
    const catSpec =
      getCanonicalCategorySpec(fullProduct.category_id) ||
      getCanonicalCategorySpec(fullProduct.category?.slug);

    if (catSpec) {
      const { data: foundCat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', catSpec.slug)
        .maybeSingle();

      if (foundCat?.id) {
        resolvedCategoryUuid = foundCat.id;
      } else {
        let parentUuid: string | null = null;
        if (catSpec.parentAliasId) {
          const pSpec = getCanonicalCategorySpec(catSpec.parentAliasId);
          if (pSpec) {
            const { data: pRow } = await supabase
              .from('categories')
              .upsert(
                {
                  id: pSpec.uuid,
                  name: pSpec.name,
                  slug: pSpec.slug,
                  description: pSpec.description,
                  display_order: pSpec.displayOrder,
                  parent_id: null,
                },
                { onConflict: 'slug' }
              )
              .select('id')
              .maybeSingle();
            parentUuid = pRow?.id || pSpec.uuid;
          }
        }

        const { data: createdCat } = await supabase
          .from('categories')
          .upsert(
            {
              id: catSpec.uuid,
              name: catSpec.name,
              slug: catSpec.slug,
              description: catSpec.description,
              display_order: catSpec.displayOrder,
              parent_id: parentUuid,
            },
            { onConflict: 'slug' }
          )
          .select('id')
          .maybeSingle();

        resolvedCategoryUuid = createdCat?.id || null;
      }
    } else if (fullProduct.category_id && isValidUUID(fullProduct.category_id)) {
      resolvedCategoryUuid = fullProduct.category_id;
    }

    let safeSlug = fullProduct.slug;
    const { data: existingSlug } = await supabase
      .from('products')
      .select('id')
      .eq('slug', safeSlug)
      .maybeSingle();
    if (existingSlug && existingSlug.id !== productId) {
      safeSlug = `${safeSlug}-${productId.slice(0, 6)}`;
    }

    let safeParentSku = fullProduct.sku || `FF-${Math.floor(100000 + Math.random() * 900000)}`;
    const { data: existingSku } = await supabase
      .from('products')
      .select('id')
      .eq('sku', safeParentSku)
      .maybeSingle();
    if (existingSku && existingSku.id !== productId) {
      safeParentSku = `${safeParentSku}-${productId.slice(0, 4).toUpperCase()}`;
    }

    const payload: Record<string, any> = {
      id: productId,
      name: fullProduct.name,
      slug: safeSlug,
      sku: safeParentSku,
      short_desc: fullProduct.short_desc || '',
      description: fullProduct.description || '',
      category_id: resolvedCategoryUuid,
      gender_collection: fullProduct.gender_collection,
      regular_price: fullProduct.regular_price,
      sale_price: fullProduct.sale_price || null,
      cost_price: fullProduct.cost_price || null,
      fabric_material: fullProduct.fabric_material || '',
      fit: fullProduct.fit || '',
      care_instructions: fullProduct.care_instructions || '',
      status: fullProduct.status,
      featured: fullProduct.featured,
      seo_title: fullProduct.seo_title || fullProduct.name,
      seo_description: fullProduct.seo_description || fullProduct.short_desc || '',
      updated_at: now,
    };

    let { error: prodErr } = await supabase.from('products').upsert(payload);
    if (prodErr && prodErr.code === '23503' && payload.category_id) {
      payload.category_id = null;
      const retry = await supabase.from('products').upsert(payload);
      prodErr = retry.error;
    }

    if (prodErr) {
      if (prodErr.code === '42501') {
        throw new Error(
          'Database permission denied (Supabase RLS): Sign in with your Supabase Owner account or verify SUPABASE_SERVICE_ROLE_KEY.'
        );
      }
      throw new Error(`Failed to save product in database: ${prodErr.message}`);
    }

    const imageRows = (fullProduct.images || [])
      .filter((img) => img && img.url && !img.url.startsWith('blob:'))
      .map((img, idx) => ({
        id: ensureValidUUID(img.id),
        product_id: productId,
        url: img.url,
        storage_path: img.storage_path || null,
        is_main: img.is_main ?? idx === 0,
        alt_text: img.alt_text || fullProduct.name,
        display_order: img.display_order ?? idx,
      }));

    if (imageRows.length > 0) {
      const { error: imgErr } = await supabase.from('product_images').upsert(imageRows);
      if (imgErr) {
        throw new Error(`Product saved, but image upload to database failed: ${imgErr.message}`);
      }
    }

    const usedSkus = new Set<string>();
    const variantRows: Array<Record<string, any>> = [];
    const mainImgUrl = imageRows.find((i) => i.is_main)?.url || imageRows[0]?.url || null;

    for (let idx = 0; idx < (fullProduct.variants || []).length; idx++) {
      const v = fullProduct.variants![idx];
      const vId = ensureValidUUID(v.id);
      const cleanSize = (v.size || `V${idx + 1}`).replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
      const isGeneric = /^SKU-(S|M|L|XL|XS|XXL|UK\d+|\d+)$/i.test((v.sku || '').trim());

      let vSku = !v.sku || isGeneric ? `${safeParentSku}-${cleanSize}` : v.sku.trim();
      if (usedSkus.has(vSku.toUpperCase())) {
        vSku = `${vSku}-${idx + 1}`;
      }

      const { data: skuCollision } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('sku', vSku)
        .maybeSingle();

      if (skuCollision && skuCollision.product_id !== productId) {
        vSku = `${safeParentSku}-${cleanSize}-${productId.slice(0, 4).toUpperCase()}-${idx + 1}`;
      }
      usedSkus.add(vSku.toUpperCase());

      variantRows.push({
        id: vId,
        product_id: productId,
        sku: vSku,
        size: v.size || null,
        color: v.color || null,
        color_hex: v.color_hex || null,
        price_override: v.price_override || null,
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

    if (variantRows.length > 0) {
      const { error: varErr } = await supabase.from('product_variants').upsert(variantRows);
      if (varErr) {
        throw new Error(`Product saved, but variants failed to save: ${varErr.message}`);
      }
    }

    const { data: verified, error: verifyErr } = await supabase
      .from('products')
      .select(ADMIN_PRODUCT_SELECT)
      .eq('id', productId)
      .maybeSingle();

    if (verifyErr || !verified) {
      throw new Error(
        verifyErr?.message ||
          'Product could not be verified in Supabase after saving. Please check database RLS policies.'
      );
    }

    return normalizeClientProduct(verified, categories, false);
  };

  // Product Operations
  const saveProduct = async (productData: Partial<Product>): Promise<Product> => {
    const productId = ensureValidUUID(productData.id, generateUUID);
    const now = new Date().toISOString();
    const parentSku =
      (productData.sku && productData.sku.trim()) ||
      `FF-${Math.floor(100000 + Math.random() * 900000)}`;

    const resolvedCat = resolveCategoryForProduct(
      productData.category_id,
      productData.category,
      categories
    );

    let productImages = (productData.images || []).filter(
      (i) => Boolean(i?.url) && !String(i.url).startsWith('blob:')
    );
    if (productImages.length === 0) {
      const fallbackUrl = getFashionFallbackImage(productData.name, resolvedCat?.name);
      productImages = [
        {
          id: generateUUID(),
          product_id: productId,
          url: fallbackUrl,
          is_main: true,
          display_order: 0,
        },
      ];
    } else {
      productImages = productImages.map((img, idx) => ({
        ...img,
        id: ensureValidUUID(img.id, generateUUID),
        product_id: productId,
        url: resolvePublicImageUrl(img.url, productData.name, resolvedCat?.name),
        is_main: img.is_main ?? idx === 0,
        display_order: img.display_order ?? idx,
      }));
    }

    const mainImgUrl = productImages.find((i) => i.is_main)?.url || productImages[0]?.url;

    let productVariants = productData.variants || [];
    if (productVariants.length === 0) {
      productVariants = [
        {
          id: generateUUID(),
          product_id: productId,
          sku: `${parentSku}-M`,
          size: 'M',
          color: 'Standard',
          stock_quantity: 10,
          is_active: true,
          variant_image_url: mainImgUrl,
        },
      ];
    } else {
      productVariants = productVariants.map((v, idx) => {
        const cleanSize = (v.size || `V${idx + 1}`).replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
        const isGeneric = /^SKU-(S|M|L|XL|XS|XXL|UK\d+|\d+)$/i.test((v.sku || '').trim());
        return {
          ...v,
          id: ensureValidUUID(v.id, generateUUID),
          product_id: productId,
          sku: !v.sku || isGeneric ? `${parentSku}-${cleanSize}` : v.sku.trim(),
          variant_image_url: v.variant_image_url
            ? resolvePublicImageUrl(v.variant_image_url, productData.name, resolvedCat?.name)
            : idx === 0
            ? mainImgUrl
            : undefined,
        };
      });
    }

    const fullProduct: Product = {
      id: productId,
      name: (productData.name || 'New Fashion Piece').trim(),
      slug:
        (productData.slug || '').trim() ||
        (productData.name || 'product')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      sku: parentSku,
      short_desc: productData.short_desc || '',
      description: productData.description || '',
      category_id: productData.category_id,
      gender_collection: productData.gender_collection || 'Unisex',
      regular_price: Number(productData.regular_price) || 0,
      sale_price: productData.sale_price ? Number(productData.sale_price) : undefined,
      cost_price: productData.cost_price ? Number(productData.cost_price) : undefined,
      fabric_material: productData.fabric_material || '',
      fit: productData.fit || '',
      care_instructions: productData.care_instructions || '',
      status: productData.status || 'published',
      featured: Boolean(productData.featured),
      seo_title: productData.seo_title || productData.name,
      seo_description: productData.seo_description || productData.short_desc,
      created_at: productData.created_at || now,
      updated_at: now,
      images: productImages,
      variants: productVariants,
      category: resolvedCat,
    };

    let savedProduct: Product | null = null;
    let apiErrorMsg = '';

    try {
      const headers = await getAdminRequestHeaders();
      const apiRes = await fetch('/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({ product: fullProduct }),
      });

      const apiJson = await apiRes.json().catch(() => null);
      if (
        apiRes.ok &&
        apiJson?.success &&
        apiJson?.product &&
        (apiJson.storageMode === 'supabase' || !isSupabaseConfigured())
      ) {
        savedProduct = normalizeClientProduct(apiJson.product as Product, categories, false);
      } else if (apiJson?.error) {
        apiErrorMsg = apiJson.error;
      }
    } catch (err: any) {
      apiErrorMsg = err?.message || '';
    }

    if (!savedProduct && isSupabaseConfigured()) {
      savedProduct = await persistProductViaSupabaseClient(fullProduct);
    }

    if (!savedProduct) {
      throw new Error(
        apiErrorMsg ||
          'Unable to persist product to the shared database. Please verify your admin session and database connection.'
      );
    }

    setProducts((prev) => {
      const exists = prev.some((p) => ensureValidUUID(p.id) === savedProduct!.id);
      if (exists) {
        return prev.map((p) => (ensureValidUUID(p.id) === savedProduct!.id ? savedProduct! : p));
      }
      return [savedProduct!, ...prev];
    });

    setUnsyncedLocalProducts((prev) =>
      prev.filter(
        (lp) =>
          ensureValidUUID(lp.id) !== savedProduct!.id &&
          lp.slug?.toLowerCase() !== savedProduct!.slug?.toLowerCase()
      )
    );

    broadcastRealtimeSync('catalog');
    return savedProduct;
  };

  // Sync any legacy browser-only owner products into the shared production database
  const syncLocalProductsToDatabase = useCallback(async (): Promise<{
    synced: number;
    failed: number;
    error?: string;
  }> => {
    const legacy = unsyncedLocalProducts.length > 0 ? unsyncedLocalProducts : readLegacyLocalProducts();
    if (legacy.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    let lastErr: string | undefined;

    for (const item of legacy) {
      try {
        await saveProduct(item);
        synced++;
      } catch (err: any) {
        failed++;
        lastErr = err?.message || 'Database sync failed';
      }
    }

    if (failed === 0) {
      localStorage.removeItem('form_fit_products');
      setUnsyncedLocalProducts([]);
      await refreshCatalog();
    }

    return { synced, failed, error: lastErr };
  }, [unsyncedLocalProducts, refreshCatalog]);

  useEffect(() => {
    if (isAdmin && unsyncedLocalProducts.length > 0 && !autoSyncAttemptedRef.current) {
      autoSyncAttemptedRef.current = true;
      syncLocalProductsToDatabase().catch(() => {});
    }
    if (!isAdmin) {
      autoSyncAttemptedRef.current = false;
    }
  }, [isAdmin, unsyncedLocalProducts.length, syncLocalProductsToDatabase]);

  const deleteProduct = async (id: string) => {
    const validId = ensureValidUUID(id);
    let deletedOnServer = false;
    let errMessage = '';

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch(`/api/products?id=${encodeURIComponent(validId)}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && (json.storageMode === 'supabase' || !isSupabaseConfigured())) {
        deletedOnServer = true;
      } else if (json?.error) {
        errMessage = json.error;
      }
    } catch (err: any) {
      errMessage = err?.message || '';
    }

    if (!deletedOnServer && isSupabaseConfigured()) {
      const { error } = await supabase.from('products').delete().eq('id', validId);
      if (error) {
        throw new Error(`Failed to delete product from database: ${error.message}`);
      }
      deletedOnServer = true;
    }

    if (!deletedOnServer) {
      throw new Error(errMessage || 'Failed to delete product from shared database.');
    }

    setProducts((prev) => prev.filter((p) => p.id !== id && ensureValidUUID(p.id) !== validId));
    setUnsyncedLocalProducts((prev) =>
      prev.filter((p) => p.id !== id && ensureValidUUID(p.id) !== validId)
    );
    broadcastRealtimeSync('catalog');
  };

  const toggleProductStatus = async (id: string) => {
    const target = products.find((p) => p.id === id || ensureValidUUID(p.id) === ensureValidUUID(id));
    if (!target) return;

    const nextStatus = target.status === 'published' ? 'draft' : 'published';
    const validId = ensureValidUUID(target.id);

    let updatedOnServer = false;
    let needsFullUpsert = false;
    let errMessage = '';

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: validId, status: nextStatus }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && (json.storageMode === 'supabase' || !isSupabaseConfigured())) {
        updatedOnServer = true;
      } else if (json?.code === 'PRODUCT_NOT_IN_DB' || res.status === 404) {
        needsFullUpsert = true;
      } else if (json?.error) {
        errMessage = json.error;
      }
    } catch (err: any) {
      errMessage = err?.message || '';
    }

    if (needsFullUpsert) {
      await saveProduct({ ...target, status: nextStatus });
      return;
    }

    if (!updatedOnServer && isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('products')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', validId)
        .select('id, status');

      if (error) {
        throw new Error(`Failed to update product status in database: ${error.message}`);
      }
      if (!data || data.length === 0) {
        await saveProduct({ ...target, status: nextStatus });
        return;
      }
      updatedOnServer = true;
    }

    if (!updatedOnServer) {
      throw new Error(errMessage || 'Failed to update product status in shared database.');
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === id || ensureValidUUID(p.id) === validId
          ? { ...p, status: nextStatus, updated_at: new Date().toISOString() }
          : p
      )
    );
    broadcastRealtimeSync('catalog');
  };

  // Category / Collection Operations
  const saveCategory = async (categoryData: Partial<Category>): Promise<Category> => {
    const spec =
      getCanonicalCategorySpec(categoryData.id) || getCanonicalCategorySpec(categoryData.slug);
    const id = spec ? spec.uuid : ensureValidUUID(categoryData.id, generateUUID);
    const slug =
      spec?.slug ||
      (categoryData.slug || categoryData.name || 'category')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const parentSpec = getCanonicalCategorySpec(categoryData.parent_id);
    const resolvedParentId = parentSpec
      ? parentSpec.uuid
      : isValidUUID(categoryData.parent_id)
      ? categoryData.parent_id
      : undefined;

    let savedCategory: Category = {
      id,
      name: (categoryData.name || 'New Collection').trim(),
      slug,
      description: categoryData.description || '',
      image_url: categoryData.image_url?.trim() || undefined,
      display_order: categoryData.display_order || categories.length + 1,
      parent_id: resolvedParentId,
    };

    let persisted = false;
    let apiErrMsg = '';

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers,
        body: JSON.stringify({ category: savedCategory }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        if (json.category) {
          savedCategory = {
            ...savedCategory,
            ...json.category,
            parent_id: json.category.parent_id || undefined,
            image_url: json.category.image_url || undefined,
          };
        }
        persisted = true;
      } else if (json?.error) {
        apiErrMsg = json.error;
      }
    } catch (err: any) {
      apiErrMsg = err?.message || '';
    }

    if (!persisted && isSupabaseConfigured()) {
      for (const c of CANONICAL_CATEGORIES.filter((item) => !item.parentUuid)) {
        await supabase.from('categories').upsert(
          {
            id: c.uuid,
            name: c.name,
            slug: c.slug,
            description: c.description,
            display_order: c.displayOrder,
            parent_id: null,
          },
          { onConflict: 'slug' }
        );
      }
      const { data: dbCat, error: dbErr } = await supabase
        .from('categories')
        .upsert(
          {
            id: savedCategory.id,
            name: savedCategory.name,
            slug: savedCategory.slug,
            description: savedCategory.description || '',
            image_url: savedCategory.image_url || null,
            display_order: savedCategory.display_order,
            parent_id: savedCategory.parent_id || null,
          },
          { onConflict: 'slug' }
        )
        .select('*')
        .maybeSingle();

      if (dbErr) {
        throw new Error(`Failed to save collection in database: ${dbErr.message}`);
      }
      if (dbCat) {
        savedCategory = {
          ...savedCategory,
          ...dbCat,
          parent_id: dbCat.parent_id || undefined,
          image_url: dbCat.image_url || undefined,
        };
      }
      persisted = true;
    }

    if (!persisted && isSupabaseConfigured()) {
      throw new Error(apiErrMsg || 'Failed to save collection in shared database.');
    }

    setCategories((prev) => {
      const exists = prev.some(
        (c) =>
          c.id === savedCategory.id ||
          c.id === categoryData.id ||
          c.slug === savedCategory.slug
      );
      const next = exists
        ? prev.map((c) =>
            c.id === savedCategory.id ||
            c.id === categoryData.id ||
            c.slug === savedCategory.slug
              ? savedCategory
              : c
          )
        : [...prev, savedCategory];
      return normalizeCategoriesList(next);
    });

    broadcastRealtimeSync('categories');
    return savedCategory;
  };

  const deleteCategory = async (id: string) => {
    let deleted = false;
    let apiErrMsg = '';

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch(`/api/categories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        deleted = true;
      } else if (json?.error) {
        apiErrMsg = json.error;
      }
    } catch (err: any) {
      apiErrMsg = err?.message || '';
    }

    if (!deleted && isSupabaseConfigured()) {
      const spec = getCanonicalCategorySpec(id);
      const { error } = spec
        ? await supabase.from('categories').delete().eq('slug', spec.slug)
        : await supabase.from('categories').delete().eq('id', ensureValidUUID(id));
      if (error) {
        throw new Error(`Failed to delete collection: ${error.message}`);
      }
      deleted = true;
    }

    if (!deleted && isSupabaseConfigured()) {
      throw new Error(apiErrMsg || 'Failed to delete collection from shared database.');
    }

    setCategories((prev) => prev.filter((c) => c.id !== id && ensureValidUUID(c.id) !== ensureValidUUID(id)));
    broadcastRealtimeSync('categories');
  };

  // Inventory adjustment
  const adjustVariantStock = async (variantId: string, quantityChange: number, reason: string) => {
    let targetProductName = 'Product';
    let targetVariantSku = 'SKU';

    setProducts((prev) =>
      prev.map((p) => {
        const updatedVariants = p.variants?.map((v) => {
          if (v.id === variantId) {
            targetProductName = p.name;
            targetVariantSku = v.sku;
            const newQty = Math.max(0, v.stock_quantity + quantityChange);
            return { ...v, stock_quantity: newQty };
          }
          return v;
        });
        return { ...p, variants: updatedVariants };
      })
    );

    const newLog: InventoryLog = {
      id: `inv_${Date.now()}`,
      productName: targetProductName,
      variantSku: targetVariantSku,
      quantityChange,
      reason,
      createdAt: new Date().toISOString(),
    };

    setInventoryLogs((prev) => [newLog, ...prev]);

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ variantId, quantityChange }),
      });
      if (!res.ok && isSupabaseConfigured()) {
        const { data } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', variantId)
          .maybeSingle();
        if (data) {
          const updatedQty = Math.max(0, data.stock_quantity + quantityChange);
          await supabase
            .from('product_variants')
            .update({ stock_quantity: updatedQty })
            .eq('id', variantId);
        }
      }
      broadcastRealtimeSync('catalog');
    } catch (err) {
      console.error('Inventory adjust exception:', err);
    }
  };

  // Cart Operations
  const addToCart = (
    product: Product,
    variant: ProductVariant,
    quantity = 1,
    customDesign?: CustomDesignData
  ) => {
    const resolvedImgUrl = resolvePublicImageUrl(
      variant.variant_image_url ||
        product.images?.find((i) => i.is_main)?.url ||
        product.images?.[0]?.url,
      product.name,
      product.category?.name
    );

    const safeVariant: ProductVariant = {
      ...variant,
      variant_image_url: resolvedImgUrl,
    };

    const safeProduct: Product = {
      ...product,
      images:
        product.images && product.images.length > 0 && product.images.some((i) => Boolean(i.url))
          ? product.images
          : [
              {
                id: generateUUID(),
                product_id: product.id,
                url: resolvedImgUrl,
                is_main: true,
                display_order: 0,
              },
            ],
    };

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.variant.id === safeVariant.id &&
          JSON.stringify(item.custom_design_data) === JSON.stringify(customDesign)
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          product: safeProduct,
          variant: safeVariant,
          quantity: Math.min(newQty, safeVariant.stock_quantity || 99),
        };
        return updated;
      }

      const newItem: CartItem = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        product: safeProduct,
        variant: safeVariant,
        quantity: Math.min(quantity, safeVariant.stock_quantity || 99),
        custom_design_data: customDesign,
      };

      return [...prev, newItem];
    });
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === cartItemId) {
          const maxStock = item.variant.stock_quantity || 99;
          return { ...item, quantity: Math.min(quantity, maxStock) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  // Coupon operations
  const applyCoupon = (code: string) => {
    const formatted = code.trim().toUpperCase();
    const found = coupons.find((c) => c.code === formatted && c.is_active);
    if (!found) {
      return { success: false, message: 'Invalid or expired promo code.' };
    }
    setAppliedCoupon(found);
    return { success: true, message: `Promo code ${found.code} applied successfully!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const saveCoupon = async (couponData: Partial<Coupon>): Promise<Coupon> => {
    const code = (couponData.code || '').trim().toUpperCase();
    if (!code) {
      throw new Error('Coupon code is required.');
    }
    const newCoupon: Coupon = {
      id: ensureValidUUID(couponData.id, generateUUID),
      code,
      discount_type: couponData.discount_type === 'fixed' ? 'fixed' : 'percentage',
      discount_value: Math.max(1, Number(couponData.discount_value) || 10),
      min_order_amount: Math.max(0, Number(couponData.min_order_amount) || 0),
      is_active: couponData.is_active !== false,
      times_used: Math.max(0, Number(couponData.times_used) || 0),
    };

    const headers = await getAdminRequestHeaders();
    const res = await fetch('/api/store?resource=coupons', {
      method: 'POST',
      headers,
      body: JSON.stringify({ coupon: newCoupon }),
    });
    const json = await res.json().catch(() => null);
    const saved = (res.ok && json?.coupon ? json.coupon : newCoupon) as Coupon;

    if (!res.ok && isSupabaseConfigured()) {
      const { error } = await supabase.from('coupons').upsert(newCoupon, { onConflict: 'code' });
      if (error) {
        throw new Error(json?.error || error.message);
      }
    }

    setCoupons((prev) => {
      const exists = prev.some((c) => c.id === saved.id || c.code === saved.code);
      return exists
        ? prev.map((c) => (c.id === saved.id || c.code === saved.code ? saved : c))
        : [saved, ...prev];
    });
    broadcastRealtimeSync('coupons');
    return saved;
  };

  const deleteCoupon = async (id: string) => {
    const headers = await getAdminRequestHeaders();
    const res = await fetch(`/api/store?resource=coupons&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && isSupabaseConfigured()) {
      await supabase.from('coupons').delete().eq('id', ensureValidUUID(id));
    }
    setCoupons((prev) => prev.filter((c) => c.id !== id && ensureValidUUID(c.id) !== ensureValidUUID(id)));
    broadcastRealtimeSync('coupons');
  };

  // Wishlist operations
  const toggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.some((w) => w.product_id === product.id);
      if (exists) {
        return prev.filter((w) => w.product_id !== product.id);
      } else {
        const newItem: WishlistItem = {
          id: `wish_${Date.now()}`,
          product_id: product.id,
          product,
          created_at: new Date().toISOString(),
        };
        return [...prev, newItem];
      }
    });
  };

  const isInWishlist = (productId: string) => {
    return wishlist.some((w) => w.product_id === productId);
  };

  // Order Operations
  const createOrder = async (orderData: {
    customerEmail: string;
    customerPhone: string;
    shippingAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    notes?: string;
  }): Promise<{ success: boolean; orderId?: string; orderNumber?: string; message?: string }> => {
    if (cart.length === 0) {
      return { success: false, message: 'Your shopping cart is empty.' };
    }

    const orderId = generateUUID();
    const orderNumber = `FF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    let subtotal = 0;
    const orderItemsList = cart.map((item) => {
      const price = item.custom_design_data?.total_price
        ? item.custom_design_data.total_price
        : item.variant.price_override || item.product.sale_price || item.product.regular_price;
      const totalItemPrice = price * item.quantity;
      subtotal += totalItemPrice;

      return {
        id: generateUUID(),
        order_id: orderId,
        variant_id: isValidUUID(item.variant.id) ? item.variant.id : undefined,
        product_name: item.product.name,
        sku: item.variant.sku,
        size: item.variant.size,
        color: item.variant.color,
        unit_price: price,
        quantity: item.quantity,
        total_price: totalItemPrice,
        image_url:
          item.variant.variant_image_url ||
          item.product.images?.find((i) => i.is_main)?.url ||
          item.product.images?.[0]?.url,
        custom_design_data: item.custom_design_data,
      };
    });

    let discountAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'percentage') {
        discountAmount = (subtotal * appliedCoupon.discount_value) / 100;
      } else {
        discountAmount = appliedCoupon.discount_value;
      }
    }

    const shippingFee =
      subtotal >= storeSettings.free_shipping_threshold ? 0 : storeSettings.shipping_fee_flat;
    const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);
    const now = new Date().toISOString();

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      user_id: user && isValidUUID(user.id) ? user.id : undefined,
      customer_email: orderData.customerEmail,
      customer_phone: orderData.customerPhone,
      shipping_address: orderData.shippingAddress,
      status: 'pending',
      payment_status: orderData.paymentMethod === 'cod' ? 'unpaid' : 'paid',
      payment_method: orderData.paymentMethod,
      subtotal,
      shipping_fee: shippingFee,
      discount_amount: discountAmount,
      total_amount: finalTotal,
      notes: orderData.notes,
      created_at: now,
      updated_at: now,
      items: orderItemsList,
    };

    // Optimistic local stock adjustment
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        variants: p.variants?.map((v) => {
          const bought = cart.find((ci) => ci.variant.id === v.id);
          return bought
            ? { ...v, stock_quantity: Math.max(0, v.stock_quantity - bought.quantity) }
            : v;
        }),
      }))
    );

    setOrders((prev) => [newOrder, ...prev]);

    let persistedViaApi = false;
    try {
      const headers = await getCustomerAuthHeaders();
      const apiRes = await fetch('/api/store?resource=orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order: newOrder,
          couponCode: appliedCoupon?.code,
        }),
      });
      if (apiRes.ok) {
        persistedViaApi = true;
      }
    } catch {
      // fall through to direct Supabase insert
    }

    if (!persistedViaApi && isSupabaseConfigured()) {
      try {
        await supabase.from('orders').insert({
          id: newOrder.id,
          order_number: newOrder.order_number,
          user_id: newOrder.user_id || null,
          customer_email: newOrder.customer_email,
          customer_phone: newOrder.customer_phone,
          shipping_address: newOrder.shipping_address,
          status: newOrder.status,
          payment_status: newOrder.payment_status,
          payment_method: newOrder.payment_method,
          subtotal: newOrder.subtotal,
          shipping_fee: newOrder.shipping_fee,
          discount_amount: newOrder.discount_amount,
          total_amount: newOrder.total_amount,
          notes: newOrder.notes,
        });

        for (const item of orderItemsList) {
          await supabase.from('order_items').insert({
            order_id: newOrder.id,
            variant_id: item.variant_id || null,
            product_name: item.product_name,
            sku: item.sku,
            size: item.size,
            color: item.color,
            unit_price: item.unit_price,
            quantity: item.quantity,
            total_price: item.total_price,
            custom_design_data: item.custom_design_data,
          });
        }
      } catch (err) {
        console.error('Supabase order creation exception:', err);
      }
    }

    broadcastRealtimeSync('orders');
    broadcastRealtimeSync('catalog');
    clearCart();
    return { success: true, orderId, orderNumber };
  };

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    trackingNumber?: string
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status,
              tracking_number: trackingNumber !== undefined ? trackingNumber : o.tracking_number,
              updated_at: new Date().toISOString(),
            }
          : o
      )
    );

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch('/api/store?resource=orders', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ orderId, status, tracking_number: trackingNumber }),
      });
      if (!res.ok && isSupabaseConfigured()) {
        await supabase
          .from('orders')
          .update({ status, tracking_number: trackingNumber })
          .eq('id', orderId);
      }
      broadcastRealtimeSync('orders');
    } catch (err) {
      console.error('Order status update error:', err);
    }
  };

  const updatePaymentStatus = async (orderId: string, paymentStatus: PaymentStatus) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, payment_status: paymentStatus, updated_at: new Date().toISOString() }
          : o
      )
    );

    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch('/api/store?resource=orders', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ orderId, payment_status: paymentStatus }),
      });
      if (!res.ok && isSupabaseConfigured()) {
        await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', orderId);
      }
      broadcastRealtimeSync('orders');
    } catch (err) {
      console.error('Order payment status update error:', err);
    }
  };

  const saveAddress = async (address: ShippingAddress) => {
    setAddresses((prev) => [address, ...prev]);
    try {
      const headers = await getCustomerAuthHeaders();
      if (headers.Authorization) {
        const res = await fetch('/api/store?resource=addresses', {
          method: 'POST',
          headers,
          body: JSON.stringify({ address }),
        });
        if (res.ok) return;
      }
    } catch {
      // fall through
    }
    if (isSupabaseConfigured() && user && isValidUUID(user.id)) {
      await supabase.from('addresses').insert({
        user_id: user.id,
        ...address,
      });
    }
  };

  // Review
  const addReview = async (
    productId: string,
    rating: number,
    comment: string,
    reviewerName: string
  ) => {
    const newReview: Review = {
      id: generateUUID(),
      product_id: productId,
      user_id: user && isValidUUID(user.id) ? user.id : undefined,
      reviewer_name: reviewerName,
      rating,
      comment,
      is_verified: true,
      created_at: new Date().toISOString(),
    };

    setReviews((prev) => [newReview, ...prev]);

    try {
      const res = await fetch('/api/store?resource=reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: newReview }),
      });
      if (res.ok) return;
    } catch {
      // fall through
    }

    if (isSupabaseConfigured() && isValidUUID(productId)) {
      await supabase.from('reviews').insert(newReview);
    }
  };

  // Settings
  const updateStoreSettings = async (settings: Partial<StoreSettings>) => {
    const mergedSettings = { ...storeSettings, ...settings };
    setStoreSettings(mergedSettings);

    let savedViaApi = false;
    try {
      const headers = await getAdminRequestHeaders();
      const res = await fetch('/api/store?resource=settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ settings: mergedSettings }),
      });
      if (res.ok) {
        savedViaApi = true;
      }
    } catch {
      // fall through
    }

    if (!savedViaApi && isSupabaseConfigured()) {
      await supabase.from('store_settings').upsert({ key: 'general', value: mergedSettings });
    }

    broadcastRealtimeSync('settings');
  };

  // Contact
  const sendContactMessage = async (msg: {
    name: string;
    email: string;
    subject?: string;
    message: string;
  }) => {
    const newMsg: ContactMessage = {
      id: generateUUID(),
      name: msg.name,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      status: 'unread',
      created_at: new Date().toISOString(),
    };

    setContactMessages((prev) => [newMsg, ...prev]);

    try {
      const res = await fetch('/api/store?resource=contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageData: newMsg }),
      });
      if (res.ok) return;
    } catch {
      // fall through
    }

    if (isSupabaseConfigured()) {
      await supabase.from('contact_messages').insert(newMsg);
    }
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        cart,
        wishlist,
        orders,
        coupons,
        reviews,
        addresses,
        storeSettings,
        contactMessages,
        inventoryLogs,
        appliedCoupon,
        loading,
        catalogError,
        unsyncedLocalProducts,
        refreshCatalog,
        syncLocalProductsToDatabase,
        saveProduct,
        deleteProduct,
        toggleProductStatus,
        saveCategory,
        deleteCategory,
        adjustVariantStock,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        applyCoupon,
        removeCoupon,
        saveCoupon,
        deleteCoupon,
        toggleWishlist,
        isInWishlist,
        createOrder,
        updateOrderStatus,
        updatePaymentStatus,
        saveAddress,
        addReview,
        updateStoreSettings,
        sendContactMessage,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
