
// Server-side in-memory cache for Pexels requests (TTL 1 hour)
const pexelsCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 3600 * 1000;

const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  'mens-fashion': 'menswear model contemporary fashion street style',
  'womens-fashion': 'womens contemporary clothing editorial female model',
  'kids-fashion': 'children clothing fashion editorial model',
  'unisex': 'unisex streetwear fashion model aesthetic',
  'tshirts': 'tshirt fashion model photography',
  'hoodies': 'hoodie sweatshirt fashion model photography',
  'bottom-wear': 'jeans cargo trousers pants fashion model photography',
  'custom-studio': 'custom printed tshirt graphic fashion photography',
  'hero-campaign': 'fashion model editorial portrait luxury streetwear',
  'lifestyle': 'street style fashion lifestyle photography model',
};

const CATEGORY_FALLBACK_PHOTOS: Record<string, Array<{ id: string; url: string; alt: string; photographer: string }>> = {
  'mens-fashion': [
    { id: 'm-1', url: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=800', alt: "Men's Contemporary Jacket Model", photographer: 'Pexels' },
    { id: 'm-2', url: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800', alt: "Men's Streetwear Model", photographer: 'Pexels' },
  ],
  'womens-fashion': [
    { id: 'w-1', url: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800', alt: "Women's Editorial Coat Model", photographer: 'Pexels' },
    { id: 'w-2', url: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=800', alt: "Women's Chic Top Model", photographer: 'Pexels' },
  ],
  'kids-fashion': [
    { id: 'k-1', url: 'https://images.pexels.com/photos/1620760/pexels-photo-1620760.jpeg?auto=compress&cs=tinysrgb&w=800', alt: "Kids' Streetwear Model", photographer: 'Pexels' },
  ],
  'unisex': [
    { id: 'u-1', url: 'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Unisex Oversized Streetwear Model', photographer: 'Pexels' },
  ],
  'tshirts': [
    { id: 't-1', url: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Combed Cotton T-Shirt Model', photographer: 'Pexels' },
  ],
  'hoodies': [
    { id: 'h-1', url: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Fleece Pullover Hoodie Model', photographer: 'Pexels' },
  ],
  'bottom-wear': [
    { id: 'b-1', url: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Tailored Trousers & Denim Jeans', photographer: 'Pexels' },
  ],
  'custom-studio': [
    { id: 'c-1', url: 'https://images.pexels.com/photos/2294342/pexels-photo-2294342.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Custom Print Graphic Tee Model', photographer: 'Pexels' },
  ],
  'hero-campaign': [
    { id: 'hero-1', url: 'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Hero Editorial Campaign Model', photographer: 'Pexels' },
    { id: 'hero-2', url: 'https://images.pexels.com/photos/157675/fashion-men-s-individuality-black-and-white-157675.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', alt: 'Monochrome Hero Model', photographer: 'Pexels' },
  ],
  'lifestyle': [
    { id: 'l-1', url: 'https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Lifestyle Contemporary Fashion', photographer: 'Pexels' },
  ],
};

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
  const category = (req.query?.category || url.searchParams.get('category')) || 'hero-campaign';
  const countParam = req.query?.count || url.searchParams.get('count') || '8';
  const count = parseInt(String(countParam), 10);
  const apiKey = process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY || '';

  const searchQuery = CATEGORY_SEARCH_QUERIES[category] || CATEGORY_SEARCH_QUERIES['hero-campaign'];
  const categoryFallback = CATEGORY_FALLBACK_PHOTOS[category] || CATEGORY_FALLBACK_PHOTOS['hero-campaign'];

  // Check cache
  const cacheKey = `${category}_${count}`;
  const cached = pexelsCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      source: 'cache',
      hasApiKey: Boolean(apiKey),
      photos: cached.data,
    });
  }

  if (!apiKey) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      source: 'fallback',
      hasApiKey: false,
      message: 'PEXELS_API_KEY environment variable not configured. Serving category-specific fallback imagery.',
      photos: categoryFallback,
    });
  }

  try {
    const pexelsRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=portrait`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!pexelsRes.ok) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: false,
        source: 'fallback',
        hasApiKey: true,
        error: `Pexels status ${pexelsRes.status}`,
        photos: categoryFallback,
      });
    }

    const pexelsData = await pexelsRes.json();
    const formattedPhotos = (pexelsData.photos || []).map((p: any) => ({
      id: String(p.id),
      url: p.src.large || p.src.medium,
      originalUrl: p.src.original,
      alt: p.alt || 'PatanaKart Category Fashion Photography',
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
    }));

    if (formattedPhotos.length > 0) {
      pexelsCache[cacheKey] = {
        data: formattedPhotos,
        timestamp: Date.now(),
      };
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        source: 'pexels-api',
        hasApiKey: true,
        photos: formattedPhotos,
      });
    } else {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        source: 'fallback',
        hasApiKey: true,
        photos: categoryFallback,
      });
    }
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: false,
      source: 'fallback',
      hasApiKey: true,
      error: err.message,
      photos: categoryFallback,
    });
  }
}
