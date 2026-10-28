const footwearStudioImg = '/assets/presets/footwear-studio.jpg';
const mensFootwearStudioImg = '/assets/presets/mens-footwear-studio.jpg';
const womensFootwearStudioImg = '/assets/presets/womens-footwear-studio.jpg';
const accessoriesStudioImg = '/assets/presets/accessories-studio.jpg';

export interface FashionPhoto {
  id: string;
  url: string;
  originalUrl?: string;
  alt: string;
  photographer: string;
  photographerUrl?: string;
}

export interface FashionApiResponse {
  success: boolean;
  source: 'pexels-api' | 'cache' | 'fallback';
  hasApiKey: boolean;
  photos: FashionPhoto[];
  message?: string;
}

// Category-Specific Fallback Mapping (Used when API is unavailable or on static hosting)
const CATEGORY_FALLBACK_PHOTOS: Record<string, FashionPhoto[]> = {
  footwear: [
    {
      id: 'fw-1',
      url: footwearStudioImg,
      alt: 'Minimalist Leather Court Sneakers Studio Poster',
      photographer: 'PatanaKart Studio',
    },
  ],
  'mens-footwear': [
    {
      id: 'fw-men-1',
      url: mensFootwearStudioImg,
      alt: "Men's Suede Loafers & Leather Sneakers Studio Poster",
      photographer: 'PatanaKart Studio',
    },
  ],
  'womens-footwear': [
    {
      id: 'fw-women-1',
      url: womensFootwearStudioImg,
      alt: "Women's Sculpted Leather Sneakers & Cognac Loafers Studio Poster",
      photographer: 'PatanaKart Studio',
    },
  ],
  accessories: [
    {
      id: 'acc-1',
      url: accessoriesStudioImg,
      alt: 'Structured Leather Tote & Lifestyle Accessories Studio Poster',
      photographer: 'PatanaKart Studio',
    },
  ],
  'mens-fashion': [
    {
      id: 'm-1',
      url: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: "Men's Contemporary Jacket Fashion Model",
      photographer: 'Pexels Menswear',
    },
    {
      id: 'm-2',
      url: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: "Men's Streetwear Model",
      photographer: 'Pexels Menswear',
    },
  ],
  'womens-fashion': [
    {
      id: 'w-1',
      url: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: "Women's Editorial Coat Fashion Model",
      photographer: 'Pexels Womenswear',
    },
    {
      id: 'w-2',
      url: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: "Women's Chic Top Model",
      photographer: 'Pexels Womenswear',
    },
  ],
  'kids-fashion': [
    {
      id: 'k-1',
      url: 'https://images.pexels.com/photos/1620760/pexels-photo-1620760.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: "Kids' Streetwear Fashion Model",
      photographer: 'Pexels Kids',
    },
  ],
  'unisex': [
    {
      id: 'u-1',
      url: 'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: 'Unisex Oversized Streetwear Model',
      photographer: 'Pexels Streetwear',
    },
  ],
  'tshirts': [
    {
      id: 't-1',
      url: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: 'Combed Cotton T-Shirt Fashion Model',
      photographer: 'Pexels Tops',
    },
  ],
  'hoodies': [
    {
      id: 'h-1',
      url: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: 'Fleece Pullover Hoodie Model',
      photographer: 'Pexels Outerwear',
    },
  ],
  'bottom-wear': [
    {
      id: 'b-1',
      url: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: 'Tailored Trousers & Denim Jeans Model',
      photographer: 'Pexels Denim',
    },
  ],
  'custom-studio': [
    {
      id: 'c-1',
      url: 'https://images.pexels.com/photos/2294342/pexels-photo-2294342.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: 'Custom Print Graphic Tee Model',
      photographer: 'Pexels Custom',
    },
  ],
  'hero-campaign': [
    {
      id: 'hero-1',
      url: 'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      alt: 'Hero Editorial Campaign Model',
      photographer: 'Pexels Editorial',
    },
    {
      id: 'hero-2',
      url: 'https://images.pexels.com/photos/157675/fashion-men-s-individuality-black-and-white-157675.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      alt: 'Monochrome Hero Model',
      photographer: 'Pexels Monochrome',
    },
  ],
  'lifestyle': [
    {
      id: 'l-1',
      url: 'https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg?auto=compress&cs=tinysrgb&w=800',
      alt: 'Lifestyle Contemporary Fashion Model',
      photographer: 'Pexels Lifestyle',
    },
  ],
};

// In-memory frontend cache keyed by category
const clientCache: Record<string, FashionPhoto[]> = {};

/**
 * Fetch curated fashion photography for a specific category
 * Ensures strict category-to-image association
 */
export async function fetchFashionImages(
  category: string = 'hero-campaign',
  count: number = 8
): Promise<FashionApiResponse> {
  const cacheKey = `${category}_${count}`;
  if (clientCache[cacheKey]) {
    return {
      success: true,
      source: 'cache',
      hasApiKey: true,
      photos: clientCache[cacheKey],
    };
  }

  const categoryFallback = CATEGORY_FALLBACK_PHOTOS[category] || CATEGORY_FALLBACK_PHOTOS['hero-campaign'];

  try {
    const res = await fetch(`/api/pexels-fashion?category=${encodeURIComponent(category)}&count=${count}`);
    const contentType = res.headers.get('content-type') || '';

    // If endpoint returns HTML (static rewrite) or fails
    if (!res.ok || !contentType.includes('application/json')) {
      clientCache[cacheKey] = categoryFallback;
      return {
        success: true,
        source: 'fallback',
        hasApiKey: false,
        photos: categoryFallback,
      };
    }

    const data: FashionApiResponse = await res.json();
    if (data.photos && data.photos.length > 0) {
      clientCache[cacheKey] = data.photos;
      return data;
    } else {
      clientCache[cacheKey] = categoryFallback;
      return {
        success: true,
        source: 'fallback',
        hasApiKey: false,
        photos: categoryFallback,
      };
    }
  } catch (err) {
    console.warn(`Fallback triggered for category "${category}":`, err);
    clientCache[cacheKey] = categoryFallback;
    return {
      success: true,
      source: 'fallback',
      hasApiKey: false,
      photos: categoryFallback,
    };
  }
}

/**
 * Diagnostic helper to inspect category image mapping without exposing secrets
 */
export function getCategoryDiagnostics(category: string) {
  const fallback = CATEGORY_FALLBACK_PHOTOS[category];
  const cached = clientCache[`${category}_1`]?.[0]?.url;
  return {
    categoryKey: category,
    hasCategoryFallback: Boolean(fallback),
    fallbackPhotoCount: fallback?.length || 0,
    primaryImageUrl: cached || fallback?.[0]?.url || null,
    imageAltText: fallback?.[0]?.alt || null,
  };
}

