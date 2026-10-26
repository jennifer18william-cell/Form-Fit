import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleProductsApi,
  handleCategoriesApi,
  handleUploadImageApi,
  handleAuthApi,
  handleStoreApi,
} from './api/_lib/catalogBackend';
import { handleStylistApi } from './api/_lib/stylistBackend';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY || '';

// Server-side in-memory cache for Pexels requests (TTL 1 hour)
const pexelsCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 3600 * 1000;

// Curated search terms for Pexels Fashion Categories
const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  'mens-fashion': 'menswear model fashion street style studio',
  'womens-fashion': 'editorial womens fashion model portrait studio',
  'kids-fashion': 'kids streetwear fashion clothing model',
  'unisex': 'unisex streetwear fashion model aesthetic',
  'tshirts': 'aesthetic tshirt fashion model clothing',
  'hoodies': 'hoodie model streetwear fashion editorial',
  'bottom-wear': 'denim jeans streetwear pants fashion model',
  'custom-studio': 'graphic tshirt fashion model studio portrait',
  'hero-campaign': 'fashion model editorial portrait luxury streetwear',
  'lifestyle': 'street style fashion lifestyle photography model',
};

// High quality curated fallback photography if Pexels API key is not configured
const FALLBACK_FASHION_PHOTOS: Record<string, Array<{ id: string; url: string; alt: string; photographer: string }>> = {
  'hero-campaign': [
    {
      id: 'hero-1',
      url: 'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      alt: 'Editorial Fashion Campaign Model',
      photographer: 'Pexels Fashion',
    },
    {
      id: 'hero-2',
      url: 'https://images.pexels.com/photos/157675/fashion-men-s-individuality-black-and-white-157675.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      alt: 'Monochrome Fashion Model',
      photographer: 'Pexels Editorial',
    },
  ],
  'mens-fashion': [
    { id: 'm-1', url: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Mens Tailored Jacket', photographer: 'Pexels' },
    { id: 'm-2', url: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Mens Streetwear Hoodie', photographer: 'Pexels' },
  ],
  'womens-fashion': [
    { id: 'w-1', url: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Womens Editorial Outfit', photographer: 'Pexels' },
    { id: 'w-2', url: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Womens Fashion Portrait', photographer: 'Pexels' },
  ],
  'kids-fashion': [
    { id: 'k-1', url: 'https://images.pexels.com/photos/1620760/pexels-photo-1620760.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Kids Fashion Outfit', photographer: 'Pexels' },
  ],
  'unisex': [
    { id: 'u-1', url: 'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Unisex Streetwear Model', photographer: 'Pexels' },
  ],
  'tshirts': [
    { id: 't-1', url: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Minimalist Cotton T-Shirt', photographer: 'Pexels' },
  ],
  'hoodies': [
    { id: 'h-1', url: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Heavyweight Fleece Hoodie', photographer: 'Pexels' },
  ],
  'bottom-wear': [
    { id: 'b-1', url: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Structured Trousers Denim', photographer: 'Pexels' },
  ],
  'custom-studio': [
    { id: 'c-1', url: 'https://images.pexels.com/photos/2294342/pexels-photo-2294342.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Custom Print T-Shirt Model', photographer: 'Pexels' },
  ],
  'lifestyle': [
    { id: 'l-1', url: 'https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg?auto=compress&cs=tinysrgb&w=800', alt: 'Contemporary Lifestyle Fashion', photographer: 'Pexels' },
  ],
};

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // Shared Catalog, Auth, Store & Product Photography API Routes (Parity with Vercel /api/*)
  app.all('/api/products', (req, res) => handleProductsApi(req, res));
  app.all('/api/categories', (req, res) => handleCategoriesApi(req, res));
  app.post('/api/upload-image', (req, res) => handleUploadImageApi(req, res));
  app.post('/api/auth', (req, res) => handleAuthApi(req, res));
  app.all('/api/store', (req, res) => handleStoreApi(req, res));
  app.all('/api/stylist', (req, res) => handleStylistApi(req, res));

  // API Endpoint: Pexels Fashion Photography Proxy
  app.get('/api/pexels-fashion', async (req, res) => {
    const category = (req.query.category as string) || 'hero-campaign';
    const count = parseInt((req.query.count as string) || '8', 10);
    const searchQuery = CATEGORY_SEARCH_QUERIES[category] || CATEGORY_SEARCH_QUERIES['hero-campaign'];

    // Check in-memory cache
    const cacheKey = `${category}_${count}`;
    const cached = pexelsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        source: 'cache',
        hasApiKey: Boolean(PEXELS_API_KEY),
        photos: cached.data,
      });
    }

    if (!PEXELS_API_KEY) {
      const fallbackData = FALLBACK_FASHION_PHOTOS[category] || FALLBACK_FASHION_PHOTOS['hero-campaign'];
      return res.json({
        success: true,
        source: 'fallback',
        hasApiKey: false,
        message: 'PEXELS_API_KEY is not set in server .env. Showing high-quality curated fashion fallbacks.',
        photos: fallbackData,
      });
    }

    try {
      const pexelsRes = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=portrait`,
        {
          headers: {
            Authorization: PEXELS_API_KEY,
          },
        }
      );

      if (!pexelsRes.ok) {
        console.error('Pexels API error status:', pexelsRes.status);
        const fallbackData = FALLBACK_FASHION_PHOTOS[category] || FALLBACK_FASHION_PHOTOS['hero-campaign'];
        return res.json({
          success: false,
          source: 'fallback',
          hasApiKey: true,
          error: `Pexels API returned status ${pexelsRes.status}`,
          photos: fallbackData,
        });
      }

      const pexelsData = await pexelsRes.json();
      const formattedPhotos = (pexelsData.photos || []).map((p: any) => ({
        id: String(p.id),
        url: p.src.large || p.src.medium,
        originalUrl: p.src.original,
        alt: p.alt || 'Form & Fit Fashion Photography',
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
      }));

      // Store in cache
      pexelsCache[cacheKey] = {
        data: formattedPhotos,
        timestamp: Date.now(),
      };

      return res.json({
        success: true,
        source: 'pexels-api',
        hasApiKey: true,
        photos: formattedPhotos,
      });
    } catch (err: any) {
      console.error('Pexels API fetch error:', err);
      const fallbackData = FALLBACK_FASHION_PHOTOS[category] || FALLBACK_FASHION_PHOTOS['hero-campaign'];
      return res.json({
        success: false,
        source: 'fallback',
        hasApiKey: true,
        error: err.message,
        photos: fallbackData,
      });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distIndex)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    // Create Vite server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Form & Fit full-stack server running at http://localhost:${PORT}`);
  });
}

startServer();
