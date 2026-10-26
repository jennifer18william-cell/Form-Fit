-- ====================================================================
-- FORM & FIT - PRODUCTION-READY SUPABASE DATABASE SCHEMA
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Extends Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'owner')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER ROLES (Dedicated role access control table)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin', 'owner')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INT DEFAULT 0,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sku TEXT UNIQUE,
  short_desc TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  gender_collection TEXT DEFAULT 'Unisex' CHECK (gender_collection IN ('Men', 'Women', 'Unisex', 'Footwear', 'Accessories', 'Custom Apparel')),
  regular_price NUMERIC(10,2) NOT NULL CHECK (regular_price >= 0),
  sale_price NUMERIC(10,2) CHECK (sale_price IS NULL OR sale_price >= 0),
  cost_price NUMERIC(10,2) CHECK (cost_price IS NULL OR cost_price >= 0),
  fabric_material TEXT,
  fit TEXT,
  care_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured BOOLEAN DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT,
  url TEXT NOT NULL,
  is_main BOOLEAN DEFAULT false,
  alt_text TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCT VARIANTS
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL,
  size TEXT,
  color TEXT,
  color_hex TEXT,
  price_override NUMERIC(10,2),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  variant_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INVENTORY MOVEMENTS
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity_change INT NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CARTS & CART ITEMS
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  custom_design_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. WISHLISTS & WISHLIST ITEMS
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- 10. ADDRESSES
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ORDERS & ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'razorpay' CHECK (payment_method IN ('upi', 'razorpay', 'cod', 'card', 'netbanking')),
  subtotal NUMERIC(10,2) NOT NULL,
  shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  size TEXT,
  color TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  custom_design_data JSONB
);

-- 12. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_provider TEXT NOT NULL DEFAULT 'razorpay',
  transaction_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. COUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  usage_limit INT,
  times_used INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. STORE SETTINGS
CREATE TABLE IF NOT EXISTS public.store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. HOMEPAGE SECTIONS
CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  button_text TEXT,
  button_link TEXT,
  section_type TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 17. CONTACT MESSAGES
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. NEWSLETTER SUBSCRIBERS
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. CUSTOM DESIGNS
CREATE TABLE IF NOT EXISTS public.custom_designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tshirt_color TEXT NOT NULL,
  tshirt_size TEXT NOT NULL,
  front_design_json JSONB,
  back_design_json JSONB,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_designs ENABLE ROW LEVEL SECURITY;

-- Helper Function to check if user is Owner or Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
    OR (
      auth.role() = 'authenticated'
      AND lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('admin@formandfit.in', 'owner@formandfit.in')
    )
  );
END;
$$;

-- Automatically create a profile row on Supabase Auth signup & elevate store owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  assigned_role := CASE
    WHEN lower(COALESCE(NEW.email, '')) IN ('admin@formandfit.in', 'owner@formandfit.in') THEN 'owner'
    ELSE 'customer'
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = CASE
      WHEN public.profiles.role IN ('owner', 'admin') THEN public.profiles.role
      ELSE EXCLUDED.role
    END,
    updated_at = NOW();

  IF assigned_role = 'owner' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Canonical UUID Category Seed Data (Preserves existing slugs on conflict)
INSERT INTO public.categories (id, name, slug, description, display_order, parent_id)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Men''s Fashion', 'mens-fashion', 'Contemporary clothing for men', 1, NULL),
  ('00000000-0000-4000-8000-000000000002', 'Women''s Fashion', 'womens-fashion', 'Editorial styles & everyday chic for women', 2, NULL),
  ('00000000-0000-4000-8000-000000000003', 'Unisex', 'unisex', 'Versatile fashion for everyone', 3, NULL),
  ('00000000-0000-4000-8000-000000000004', 'T-Shirts & Tops', 'tshirts-tops', 'Premium cotton t-shirts and elevated tops', 4, NULL),
  ('00000000-0000-4000-8000-000000000005', 'Hoodies & Sweatshirts', 'hoodies-sweatshirts', 'Heavyweight fleece and streetwear hoodies', 5, NULL),
  ('00000000-0000-4000-8000-000000000006', 'Bottom Wear', 'bottom-wear', 'Tailored trousers, denim, and joggers', 6, NULL),
  ('00000000-0000-4000-8000-000000000007', 'Dresses & Co-ords', 'dresses-coords', 'Statement dresses and matching sets', 7, NULL),
  ('00000000-0000-4000-8000-000000000008', 'Ethnic Wear', 'ethnic-wear', 'Modern traditional fusion & festive wear', 8, NULL),
  ('00000000-0000-4000-8000-000000000009', 'Footwear', 'footwear', 'Dedicated footwear zone featuring sneakers, loafers, and leather silhouettes', 9, NULL),
  ('00000000-0000-4000-8000-000000000901', 'Men''s Footwear', 'mens-footwear', 'Minimalist court sneakers, suede loafers, and boots for men', 10, '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000902', 'Women''s Footwear', 'womens-footwear', 'Sculpted leather sneakers, cognac loafers, and everyday flats for women', 11, '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000010', 'Accessories', 'accessories', 'Bags, caps, and lifestyle accents', 12, NULL),
  ('00000000-0000-4000-8000-000000000011', 'Custom Apparel', 'custom-apparel', 'Personalized t-shirts and custom prints', 13, NULL)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = COALESCE(NULLIF(public.categories.description, ''), EXCLUDED.description),
  display_order = EXCLUDED.display_order;

-- Indexes for fast New Arrivals & Category Portal queries
CREATE INDEX IF NOT EXISTS idx_products_status_created_at
  ON public.products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON public.products (category_id, status);
CREATE INDEX IF NOT EXISTS idx_product_images_product_order
  ON public.product_images (product_id, is_main DESC, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
  ON public.product_variants (product_id, is_active);

-- Public read access to published products & active categories ONLY
DROP POLICY IF EXISTS "Public products viewable" ON public.products;
CREATE POLICY "Public products viewable" ON public.products
  FOR SELECT USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "Admin product management" ON public.products;
CREATE POLICY "Admin product management" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public categories viewable" ON public.categories;
CREATE POLICY "Public categories viewable" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin category management" ON public.categories;
CREATE POLICY "Admin category management" ON public.categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public product images viewable" ON public.product_images;
CREATE POLICY "Public product images viewable" ON public.product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.status = 'published'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admin image management" ON public.product_images;
CREATE POLICY "Admin image management" ON public.product_images
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public variants viewable" ON public.product_variants;
CREATE POLICY "Public variants viewable" ON public.product_variants
  FOR SELECT USING (
    (
      is_active = true
      AND EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_variants.product_id
          AND p.status = 'published'
      )
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admin variant management" ON public.product_variants;
CREATE POLICY "Admin variant management" ON public.product_variants
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Customer & Profile Policies (Private)
DROP POLICY IF EXISTS "Users access own profile" ON public.profiles;
CREATE POLICY "Users access own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND (
      role = 'customer'
      OR lower(email) IN ('admin@formandfit.in', 'owner@formandfit.in')
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage user roles" ON public.user_roles;
CREATE POLICY "Admin manage user roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users access own orders" ON public.orders;
CREATE POLICY "Users access own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users create orders" ON public.orders;
CREATE POLICY "Users create orders" ON public.orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin manage orders" ON public.orders;
CREATE POLICY "Admin manage orders" ON public.orders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users access own order items" ON public.order_items;
CREATE POLICY "Users access own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Users create order items" ON public.order_items;
CREATE POLICY "Users create order items" ON public.order_items
  FOR INSERT WITH CHECK (true);

-- Coupons Policies
DROP POLICY IF EXISTS "Public active coupons viewable" ON public.coupons;
CREATE POLICY "Public active coupons viewable" ON public.coupons
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage coupons" ON public.coupons;
CREATE POLICY "Admin manage coupons" ON public.coupons
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Wishlist Policies
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlists;
CREATE POLICY "Users manage own wishlist" ON public.wishlists
  FOR ALL USING (auth.uid() = user_id);

-- Addresses Policies
DROP POLICY IF EXISTS "Users manage own addresses" ON public.addresses;
CREATE POLICY "Users manage own addresses" ON public.addresses
  FOR ALL USING (auth.uid() = user_id);

-- Reviews Policies
DROP POLICY IF EXISTS "Public view reviews" ON public.reviews;
CREATE POLICY "Public view reviews" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated create review" ON public.reviews;
CREATE POLICY "Authenticated create review" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Store Settings & Homepage Sections Policies
DROP POLICY IF EXISTS "Public view store settings" ON public.store_settings;
CREATE POLICY "Public view store settings" ON public.store_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage store settings" ON public.store_settings;
CREATE POLICY "Admin manage store settings" ON public.store_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public view homepage sections" ON public.homepage_sections;
CREATE POLICY "Public view homepage sections" ON public.homepage_sections
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admin manage homepage sections" ON public.homepage_sections;
CREATE POLICY "Admin manage homepage sections" ON public.homepage_sections
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Contact Messages
DROP POLICY IF EXISTS "Anyone can send message" ON public.contact_messages;
CREATE POLICY "Anyone can send message" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin manage messages" ON public.contact_messages;
CREATE POLICY "Admin manage messages" ON public.contact_messages
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Newsletter
DROP POLICY IF EXISTS "Anyone subscribe newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone subscribe newsletter" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin view newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Admin view newsletter" ON public.newsletter_subscribers
  FOR SELECT USING (public.is_admin());

-- Column-level restriction: hide private `cost_price` from `anon` public visitors
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, name, slug, sku, short_desc, description, category_id,
  gender_collection, regular_price, sale_price, fabric_material,
  fit, care_instructions, status, featured, seo_title,
  seo_description, created_at, updated_at
) ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- Public Storage bucket & RLS policies for product photography
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read product images bucket" ON storage.objects;
CREATE POLICY "Public read product images bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin upload product images bucket" ON storage.objects;
CREATE POLICY "Admin upload product images bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admin update product images bucket" ON storage.objects;
CREATE POLICY "Admin update product images bucket" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admin delete product images bucket" ON storage.objects;
CREATE POLICY "Admin delete product images bucket" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin());

-- Enable Supabase Realtime WebSockets on shared storefront tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products',
    'product_images',
    'product_variants',
    'categories',
    'store_settings',
    'coupons',
    'orders',
    'reviews'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;


