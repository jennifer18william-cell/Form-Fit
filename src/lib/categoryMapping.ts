import { Category, Product } from '../types';
import { DEFAULT_CATEGORIES } from '../data/initialData';

export interface CanonicalCategorySpec {
  aliasId: string;
  uuid: string;
  slug: string;
  name: string;
  parentAliasId?: string;
  parentUuid?: string;
  displayOrder: number;
  description: string;
}

/**
 * Deterministic UUIDs for Form & Fit canonical categories so:
 * 1. PostgreSQL UUID foreign keys (`public.categories.id`, `public.products.category_id`) always succeed.
 * 2. Storefront URL filters (`/shop?category=cat-4`, `/shop?category=cat-9-men`, UUIDs, or slugs) all match seamlessly.
 */
export const CANONICAL_CATEGORIES: CanonicalCategorySpec[] = [
  {
    aliasId: 'cat-1',
    uuid: '00000000-0000-4000-8000-000000000001',
    slug: 'mens-fashion',
    name: "Men's Fashion",
    displayOrder: 1,
    description: 'Contemporary clothing for men',
  },
  {
    aliasId: 'cat-2',
    uuid: '00000000-0000-4000-8000-000000000002',
    slug: 'womens-fashion',
    name: "Women's Fashion",
    displayOrder: 2,
    description: 'Editorial styles & everyday chic for women',
  },
  {
    aliasId: 'cat-3',
    uuid: '00000000-0000-4000-8000-000000000003',
    slug: 'unisex',
    name: 'Unisex',
    displayOrder: 3,
    description: 'Versatile fashion for everyone',
  },
  {
    aliasId: 'cat-4',
    uuid: '00000000-0000-4000-8000-000000000004',
    slug: 'tshirts-tops',
    name: 'T-Shirts & Tops',
    displayOrder: 4,
    description: 'Premium cotton t-shirts and elevated tops',
  },
  {
    aliasId: 'cat-5',
    uuid: '00000000-0000-4000-8000-000000000005',
    slug: 'hoodies-sweatshirts',
    name: 'Hoodies & Sweatshirts',
    displayOrder: 5,
    description: 'Heavyweight fleece and streetwear hoodies',
  },
  {
    aliasId: 'cat-6',
    uuid: '00000000-0000-4000-8000-000000000006',
    slug: 'bottom-wear',
    name: 'Bottom Wear',
    displayOrder: 6,
    description: 'Tailored trousers, denim, and joggers',
  },
  {
    aliasId: 'cat-7',
    uuid: '00000000-0000-4000-8000-000000000007',
    slug: 'dresses-coords',
    name: 'Dresses & Co-ords',
    displayOrder: 7,
    description: 'Statement dresses and matching sets',
  },
  {
    aliasId: 'cat-8',
    uuid: '00000000-0000-4000-8000-000000000008',
    slug: 'ethnic-wear',
    name: 'Ethnic Wear',
    displayOrder: 8,
    description: 'Modern traditional fusion & festive wear',
  },
  {
    aliasId: 'cat-9',
    uuid: '00000000-0000-4000-8000-000000000009',
    slug: 'footwear',
    name: 'Footwear',
    displayOrder: 9,
    description: 'Dedicated footwear zone featuring sneakers, loafers, and leather silhouettes',
  },
  {
    aliasId: 'cat-9-men',
    uuid: '00000000-0000-4000-8000-000000000901',
    slug: 'mens-footwear',
    name: "Men's Footwear",
    parentAliasId: 'cat-9',
    parentUuid: '00000000-0000-4000-8000-000000000009',
    displayOrder: 10,
    description: 'Minimalist court sneakers, suede loafers, and boots for men',
  },
  {
    aliasId: 'cat-9-women',
    uuid: '00000000-0000-4000-8000-000000000902',
    slug: 'womens-footwear',
    name: "Women's Footwear",
    parentAliasId: 'cat-9',
    parentUuid: '00000000-0000-4000-8000-000000000009',
    displayOrder: 11,
    description: 'Sculpted leather sneakers, cognac loafers, and everyday flats for women',
  },
  {
    aliasId: 'cat-10',
    uuid: '00000000-0000-4000-8000-000000000010',
    slug: 'accessories',
    name: 'Accessories',
    displayOrder: 12,
    description: 'Bags, caps, and lifestyle accents',
  },
  {
    aliasId: 'cat-11',
    uuid: '00000000-0000-4000-8000-000000000011',
    slug: 'custom-apparel',
    name: 'Custom Apparel',
    displayOrder: 13,
    description: 'Personalized t-shirts and custom prints',
  },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Deterministically converts any legacy string ID (e.g. "prod_123" or "cat_123")
 * into a valid RFC-4122 v4-shaped UUID so PostgreSQL UUID columns never reject it.
 */
export function ensureValidUUID(id?: string | null, fallbackRandom?: () => string): string {
  if (id && isValidUUID(id)) {
    return id.trim().toLowerCase();
  }
  const canonical = getCanonicalCategorySpec(id);
  if (canonical) {
    return canonical.uuid;
  }
  if (!id || !id.trim()) {
    if (fallbackRandom) return fallbackRandom();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Deterministic hash -> UUID for legacy non-UUID IDs
  const str = id.trim();
  const hashes = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    for (let h = 0; h < 4; h++) {
      hashes[h] = Math.imul(hashes[h] ^ ch, 16777619 + h * 31) >>> 0;
    }
  }
  const hex = hashes.map((n) => n.toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function getCanonicalCategorySpec(idOrSlug?: string | null): CanonicalCategorySpec | undefined {
  if (!idOrSlug) return undefined;
  const normalized = idOrSlug.trim().toLowerCase();
  return CANONICAL_CATEGORIES.find(
    (c) =>
      c.aliasId.toLowerCase() === normalized ||
      c.uuid.toLowerCase() === normalized ||
      c.slug.toLowerCase() === normalized
  );
}

/**
 * Resolves a category object for a product across alias IDs (`cat-4`), slugs (`tshirts-tops`), or DB UUIDs.
 */
export function resolveCategoryForProduct(
  categoryId?: string | null,
  joinedCategory?: Category | null,
  categories: Category[] = DEFAULT_CATEGORIES
): Category | undefined {
  if (joinedCategory && joinedCategory.name && joinedCategory.slug) {
    return joinedCategory;
  }
  if (!categoryId) return undefined;

  const direct = categories.find((c) => c.id === categoryId || c.slug === categoryId);
  if (direct) return direct;

  const spec = getCanonicalCategorySpec(categoryId);
  if (spec) {
    const bySlugOrAlias = categories.find(
      (c) => c.slug === spec.slug || c.id === spec.aliasId || c.id === spec.uuid
    );
    if (bySlugOrAlias) return bySlugOrAlias;
    return {
      id: spec.uuid,
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      display_order: spec.displayOrder,
      parent_id: spec.parentUuid,
    };
  }

  return undefined;
}

/**
 * Returns a normalized canonical key (the `slug` when known, otherwise lowercase ID)
 * so `/shop?category=cat-4` matches a DB product whose `category_id` is UUID `00000000-0000-4000-8000-000000000004`
 * OR any random UUID whose `category.slug` is `tshirts-tops`.
 */
export function getCategoryCanonicalKey(
  idOrSlug?: string | null,
  categories: Category[] = DEFAULT_CATEGORIES,
  joinedCategory?: Category | null
): string {
  if (joinedCategory?.slug) {
    const fromJoined = getCanonicalCategorySpec(joinedCategory.slug);
    return fromJoined ? fromJoined.slug : joinedCategory.slug.toLowerCase();
  }
  if (!idOrSlug) return '';

  const spec = getCanonicalCategorySpec(idOrSlug);
  if (spec) return spec.slug;

  const found = categories.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
  if (found) {
    const fromFound = getCanonicalCategorySpec(found.slug) || getCanonicalCategorySpec(found.id);
    return fromFound ? fromFound.slug : found.slug.toLowerCase();
  }

  return idOrSlug.trim().toLowerCase();
}

export function isMensFootwearCategoryKey(
  idOrSlug?: string | null,
  categories: Category[] = DEFAULT_CATEGORIES,
  joinedCategory?: Category | null
): boolean {
  const key = getCategoryCanonicalKey(idOrSlug, categories, joinedCategory);
  return key === 'mens-footwear';
}

export function isWomensFootwearCategoryKey(
  idOrSlug?: string | null,
  categories: Category[] = DEFAULT_CATEGORIES,
  joinedCategory?: Category | null
): boolean {
  const key = getCategoryCanonicalKey(idOrSlug, categories, joinedCategory);
  return key === 'womens-footwear';
}

export function isFootwearCategoryKey(
  idOrSlug?: string | null,
  categories: Category[] = DEFAULT_CATEGORIES,
  joinedCategory?: Category | null
): boolean {
  const key = getCategoryCanonicalKey(idOrSlug, categories, joinedCategory);
  if (key === 'footwear' || key === 'mens-footwear' || key === 'womens-footwear') {
    return true;
  }
  if (!idOrSlug) return false;
  const found =
    joinedCategory || categories.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
  if (!found) return false;
  if (found.slug?.toLowerCase().includes('footwear')) return true;
  if (found.parent_id) {
    return getCategoryCanonicalKey(found.parent_id, categories) === 'footwear';
  }
  return false;
}

export function isAccessoriesCategoryKey(
  idOrSlug?: string | null,
  categories: Category[] = DEFAULT_CATEGORIES,
  joinedCategory?: Category | null
): boolean {
  const key = getCategoryCanonicalKey(idOrSlug, categories, joinedCategory);
  return key === 'accessories';
}

export function isProductFootwearItem(
  product: Product,
  categories: Category[] = DEFAULT_CATEGORIES
): boolean {
  return (
    isFootwearCategoryKey(product.category_id, categories, product.category) ||
    product.gender_collection === 'Footwear'
  );
}

export function isProductMensFootwearItem(
  product: Product,
  categories: Category[] = DEFAULT_CATEGORIES
): boolean {
  if (isMensFootwearCategoryKey(product.category_id, categories, product.category)) {
    return true;
  }
  return (
    isProductFootwearItem(product, categories) &&
    !isWomensFootwearCategoryKey(product.category_id, categories, product.category) &&
    product.gender_collection === 'Men'
  );
}

export function isProductWomensFootwearItem(
  product: Product,
  categories: Category[] = DEFAULT_CATEGORIES
): boolean {
  if (isWomensFootwearCategoryKey(product.category_id, categories, product.category)) {
    return true;
  }
  return (
    isProductFootwearItem(product, categories) &&
    !isMensFootwearCategoryKey(product.category_id, categories, product.category) &&
    product.gender_collection === 'Women'
  );
}

/**
 * Matches a product against a category query parameter (`cat-4`, `cat-9`, `cat-9-men`, UUID, or slug).
 */
export function matchesProductCategoryFilter(
  product: Product,
  selectedCategoryParam: string,
  categories: Category[] = DEFAULT_CATEGORIES
): boolean {
  if (!selectedCategoryParam) return true;

  const filterKey = getCategoryCanonicalKey(selectedCategoryParam, categories);
  if (filterKey === 'footwear') {
    return isProductFootwearItem(product, categories);
  }
  if (filterKey === 'mens-footwear') {
    return isProductMensFootwearItem(product, categories);
  }
  if (filterKey === 'womens-footwear') {
    return isProductWomensFootwearItem(product, categories);
  }
  if (filterKey === 'accessories') {
    return (
      isAccessoriesCategoryKey(product.category_id, categories, product.category) ||
      product.gender_collection === 'Accessories'
    );
  }

  const productKey = getCategoryCanonicalKey(
    product.category_id,
    categories,
    product.category
  );

  if (filterKey && productKey && filterKey === productKey) {
    return true;
  }

  // Also check if selectedCategoryParam is a parent category of the product's subcategory
  const productCat =
    product.category ||
    categories.find((c) => c.id === product.category_id || c.slug === product.category_id);
  if (productCat?.parent_id) {
    const parentKey = getCategoryCanonicalKey(productCat.parent_id, categories);
    if (parentKey && parentKey === filterKey) return true;
  }

  return product.category_id === selectedCategoryParam;
}

/**
 * Converts a UI Category list (from Supabase or defaults) so Footwear subcategories
 * are always present and linked to the Footwear parent ID actually in that list.
 */
export function normalizeCategoriesList(rawCategories: Category[]): Category[] {
  if (!rawCategories || rawCategories.length === 0) {
    return DEFAULT_CATEGORIES;
  }

  const result = rawCategories.map((c) => ({ ...c }));

  const hasFootwearParent = result.some(
    (c) => getCategoryCanonicalKey(c.id, result, c) === 'footwear'
  );
  if (!hasFootwearParent) {
    const spec = CANONICAL_CATEGORIES.find((c) => c.slug === 'footwear')!;
    result.push({
      id: spec.uuid,
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      display_order: spec.displayOrder,
    });
  }

  const parentCat = result.find(
    (c) => getCategoryCanonicalKey(c.id, result, c) === 'footwear'
  );
  const parentId = parentCat?.id || '00000000-0000-4000-8000-000000000009';
  const useUuidIds = isValidUUID(parentId);

  const subSpecs = CANONICAL_CATEGORIES.filter(
    (s) => s.slug === 'mens-footwear' || s.slug === 'womens-footwear'
  );

  const parentIndex = result.findIndex((c) => c.id === parentId);
  let insertOffset = 1;

  for (const spec of subSpecs) {
    const existingIdx = result.findIndex(
      (c) =>
        c.slug === spec.slug ||
        c.id === spec.aliasId ||
        c.id === spec.uuid
    );
    if (existingIdx === -1) {
      const subCat: Category = {
        id: useUuidIds ? spec.uuid : spec.aliasId,
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        display_order: spec.displayOrder,
        parent_id: parentId,
      };
      if (parentIndex !== -1) {
        result.splice(parentIndex + insertOffset, 0, subCat);
        insertOffset++;
      } else {
        result.push(subCat);
      }
    } else if (!result[existingIdx].parent_id) {
      result[existingIdx] = { ...result[existingIdx], parent_id: parentId };
    }
  }

  return result;
}
