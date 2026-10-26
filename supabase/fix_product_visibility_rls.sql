-- ============================================================================
-- FORM & FIT — PRODUCTION PRODUCT VISIBILITY & RLS MIGRATION (IDEMPOTENT)
-- ============================================================================
-- Safe to run on an existing production Supabase database:
--   - Preserves ALL existing products, categories, customer profiles, and orders.
--   - Seeds canonical UUID categories (with ON CONFLICT DO UPDATE) so Admin
--     product inserts never fail UUID / foreign-key checks.
--   - Auto-provisions `public.profiles` rows for `auth.users` and elevates the
--     verified store owner account (`admin@formandfit.in`) to `role = 'owner'`.
--   - Allows unauthenticated (`anon`) public visitors to read ONLY `published`
--     products, their images, active variants, and public categories.
--   - Revokes `anon` access to `cost_price` at the PostgreSQL column level and
--     keeps all customer profiles, orders, addresses, and admin data private.
--   - Ensures `product-images` storage bucket is public for visitor image loads.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Seed Canonical UUID Categories (Non-destructive upsert by `slug`)
-- ----------------------------------------------------------------------------
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
  ('00000000-0000-4000-8000-000000000010', 'Accessories', 'accessories', 'Bags, caps, and lifestyle accents', 12, NULL),
  ('00000000-0000-4000-8000-000000000011', 'Custom Apparel', 'custom-apparel', 'Personalized t-shirts and custom prints', 13, NULL)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = COALESCE(NULLIF(public.categories.description, ''), EXCLUDED.description),
  display_order = EXCLUDED.display_order;

-- Seed Men's Footwear & Women's Footwear linked to the actual Footwear parent UUID
INSERT INTO public.categories (id, name, slug, description, display_order, parent_id)
SELECT
  v.id::uuid,
  v.name,
  v.slug,
  v.description,
  v.display_order,
  p.id
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000901', 'Men''s Footwear', 'mens-footwear', 'Minimalist court sneakers, suede loafers, and boots for men', 10),
    ('00000000-0000-4000-8000-000000000902', 'Women''s Footwear', 'womens-footwear', 'Sculpted leather sneakers, cognac loafers, and everyday flats for women', 11)
) AS v(id, name, slug, description, display_order)
CROSS JOIN (
  SELECT id FROM public.categories WHERE slug = 'footwear' LIMIT 1
) AS p
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = COALESCE(NULLIF(public.categories.description, ''), EXCLUDED.description),
  display_order = EXCLUDED.display_order,
  parent_id = EXCLUDED.parent_id;

-- ----------------------------------------------------------------------------
-- 2. Backfill Profiles & Auto-Provision Trigger on `auth.users`
-- ----------------------------------------------------------------------------
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
    WHEN lower(COALESCE(NEW.email, '')) = 'admin@formandfit.in' THEN 'owner'
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

-- Backfill any existing `auth.users` missing from `public.profiles`
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(COALESCE(u.email, 'User'), '@', 1)),
  CASE WHEN lower(COALESCE(u.email, '')) = 'admin@formandfit.in' THEN 'owner' ELSE 'customer' END
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET
  role = CASE
    WHEN lower(public.profiles.email) = 'admin@formandfit.in' THEN 'owner'
    ELSE public.profiles.role
  END;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'
FROM public.profiles
WHERE lower(email) = 'admin@formandfit.in'
ON CONFLICT (user_id, role) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Hardened `public.is_admin()` Helper
-- ----------------------------------------------------------------------------
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
      AND lower(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@formandfit.in'
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Indexes for Fast Public Storefront & Category Portal Queries
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_status_created_at
  ON public.products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON public.products (category_id, status);
CREATE INDEX IF NOT EXISTS idx_product_images_product_order
  ON public.product_images (product_id, is_main DESC, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
  ON public.product_variants (product_id, is_active);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security Policies (Public Catalog Read vs. Private Admin/User Data)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Profiles (Private: own row or admin; customers cannot self-assign admin/owner)
DROP POLICY IF EXISTS "Users access own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users access own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND (
      role = 'customer'
      OR lower(email) = 'admin@formandfit.in'
      OR public.is_admin()
    )
  );

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- User Roles (Private)
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin manage user roles" ON public.user_roles;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admin manage user roles" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Categories (Public read; Admin write)
DROP POLICY IF EXISTS "Public categories viewable" ON public.categories;
DROP POLICY IF EXISTS "Admin category management" ON public.categories;

CREATE POLICY "Public categories viewable" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Admin category management" ON public.categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Products (Public visitors can ONLY read `status = 'published'`; Admin full CRUD)
DROP POLICY IF EXISTS "Public products viewable" ON public.products;
DROP POLICY IF EXISTS "Admin product management" ON public.products;

CREATE POLICY "Public products viewable" ON public.products
  FOR SELECT USING (status = 'published' OR public.is_admin());

CREATE POLICY "Admin product management" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Product Images (Public visitors can ONLY read images of `published` products)
DROP POLICY IF EXISTS "Public product images viewable" ON public.product_images;
DROP POLICY IF EXISTS "Admin image management" ON public.product_images;

CREATE POLICY "Public product images viewable" ON public.product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.status = 'published'
    )
    OR public.is_admin()
  );

CREATE POLICY "Admin image management" ON public.product_images
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Product Variants (Public visitors can ONLY read active variants of `published` products)
DROP POLICY IF EXISTS "Public variants viewable" ON public.product_variants;
DROP POLICY IF EXISTS "Admin variant management" ON public.product_variants;

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

CREATE POLICY "Admin variant management" ON public.product_variants
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Coupons (Public read active coupons for cart checkout; Admin full CRUD)
DROP POLICY IF EXISTS "Public active coupons viewable" ON public.coupons;
DROP POLICY IF EXISTS "Admin manage coupons" ON public.coupons;

CREATE POLICY "Public active coupons viewable" ON public.coupons
  FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admin manage coupons" ON public.coupons
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Column-Level Privilege Hardening (Hide `cost_price` from `anon` Visitors)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
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
  updated_at
) ON public.products TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- Public-safe view excluding `cost_price`
CREATE OR REPLACE VIEW public.public_products AS
SELECT
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
  updated_at
FROM public.products
WHERE status = 'published';

GRANT SELECT ON public.public_products TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Public Storage Bucket & Policies for Product Photography (`product-images`)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read product images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload product images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin update product images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete product images bucket" ON storage.objects;

CREATE POLICY "Public read product images bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Admin upload product images bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admin update product images bucket" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admin delete product images bucket" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin());

COMMIT;
