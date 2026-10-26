# Form & Fit - Supabase Setup Guide

## Overview
Form & Fit uses **Supabase** for PostgreSQL Database, Auth, Storage (Product Images), and RLS security.

---

## Step 1: Create Supabase Project
1. Go to [Supabase Dashboard](https://database.new) and create a new project.
2. Note your **Project URL** and **anon (public) key** from `Settings` -> `API`.

---

## Step 2: Run Database Schema
1. Open the SQL Editor in your Supabase Dashboard.
2. Copy all content from `supabase/schema.sql`.
3. Run the SQL script to create all 19+ tables, foreign key constraints, indexes, and Row Level Security (RLS) policies.

---

## Step 3: Create Storage Bucket for Product Photography
1. Go to **Storage** in the Supabase Dashboard.
2. Click **New Bucket**.
3. Bucket name: `product-images`
4. Enable **Public Bucket**.
5. Save the bucket.

---

## Step 4: Configure Environment Variables (Local & Vercel)
In your local `.env` file and Vercel **Project Settings -> Environment Variables**, add:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-public-key"
# Recommended on Vercel server-side only (never prefix with VITE_):
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"
```

---

## Step 5: Existing Production Database Migration (Fix Public Product Visibility)
If your Supabase project was created with an earlier schema version, run **`supabase/fix_product_visibility_rls.sql`** in the Supabase SQL Editor. It is 100% idempotent and preserves all existing products, categories, customers, and orders while:
- Seeding canonical UUID categories (`Men's Fashion`, `Women's Fashion`, `Footwear`, `Men's Footwear`, `Women's Footwear`, `Accessories`, etc.)
- Auto-provisioning `public.profiles` rows and elevating `admin@formandfit.in` to `owner`
- Allowing unauthenticated (`anon`) public visitors to read `status = 'published'` products, images, and active variants while hiding `cost_price`, customer data, and orders
- Making the `product-images` bucket publicly readable for visitor browsers

---

## Step 6: Provision Custom Owner Account (Optional)
To elevate any additional Supabase Auth account to store owner:

```sql
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'your-owner-email@example.com';
```

Now log into `/owner/login` with your owner credentials to publish products directly to the shared database!
