import { Category, StoreSettings, Coupon, Product } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: "Men's Fashion", slug: 'mens-fashion', description: 'Contemporary clothing for men', display_order: 1 },
  { id: 'cat-2', name: "Women's Fashion", slug: 'womens-fashion', description: 'Editorial styles & everyday chic for women', display_order: 2 },
  { id: 'cat-3', name: 'Unisex', slug: 'unisex', description: 'Versatile fashion for everyone', display_order: 3 },
  { id: 'cat-4', name: 'T-Shirts & Tops', slug: 'tshirts-tops', description: 'Premium cotton t-shirts and elevated tops', display_order: 4 },
  { id: 'cat-5', name: 'Hoodies & Sweatshirts', slug: 'hoodies-sweatshirts', description: 'Heavyweight fleece and streetwear hoodies', display_order: 5 },
  { id: 'cat-6', name: 'Bottom Wear', slug: 'bottom-wear', description: 'Tailored trousers, denim, and joggers', display_order: 6 },
  { id: 'cat-7', name: 'Dresses & Co-ords', slug: 'dresses-coords', description: 'Statement dresses and matching sets', display_order: 7 },
  { id: 'cat-8', name: 'Ethnic Wear', slug: 'ethnic-wear', description: 'Modern traditional fusion & festive wear', display_order: 8 },
  { id: 'cat-9', name: 'Footwear', slug: 'footwear', description: 'Dedicated footwear zone featuring sneakers, loafers, and leather silhouettes', display_order: 9 },
  { id: 'cat-9-men', name: "Men's Footwear", slug: 'mens-footwear', description: 'Minimalist court sneakers, suede loafers, and boots for men', display_order: 10, parent_id: 'cat-9' },
  { id: 'cat-9-women', name: "Women's Footwear", slug: 'womens-footwear', description: 'Sculpted leather sneakers, cognac loafers, and everyday flats for women', display_order: 11, parent_id: 'cat-9' },
  { id: 'cat-10', name: 'Accessories', slug: 'accessories', description: 'Bags, caps, and lifestyle accents', display_order: 12 },
  { id: 'cat-11', name: 'Custom Apparel', slug: 'custom-apparel', description: 'Personalized t-shirts and custom prints', display_order: 13 },
];

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: 'PatanaKart',
  logo_url: '/assets/patanakart-logo.jpg',
  announcement_text: '⚡ Free Shipping on All Orders Over ₹1,999 across India | Use Code: FORM10 for 10% Off',
  announcement_enabled: true,
  hero_headline: 'FASHION FOR EVERY YOU.',
  hero_subtitle: 'Everyday essentials, statement pieces, and custom creations designed around your style.',
  hero_image_url: '',
  contact_email: 'support@patanakart.in',
  contact_phone: '+91 98765 43210',
  currency: 'INR',
  currency_symbol: '₹',
  shipping_fee_flat: 99,
  free_shipping_threshold: 1999,
  tax_percentage: 12,
  low_stock_threshold: 5,
  razorpay_enabled: true,
  razorpay_key_id: 'rzp_test_PatanaKartKey',
  cod_enabled: true,
};

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'coup-1',
    code: 'FORM10',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 999,
    is_active: true,
    times_used: 12,
  },
  {
    id: 'coup-2',
    code: 'WELCOME500',
    discount_type: 'fixed',
    discount_value: 500,
    min_order_amount: 2499,
    is_active: true,
    times_used: 45,
  },
];

// Empty products array as required by specification
export const INITIAL_PRODUCTS: Product[] = [];
