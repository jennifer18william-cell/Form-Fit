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

## Step 4: Configure Environment Variables
In your local `.env` file or hosting environment variables, add:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
```

---

## Step 5: Provision Initial Owner Account
To create your store owner account:
1. Sign up on your Form & Fit app (or via Supabase Auth UI).
2. Go to Supabase SQL Editor and elevate your profile role:

```sql
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'your-owner-email@example.com';
```

Or insert directly into `public.user_roles`:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner' FROM public.profiles WHERE email = 'your-owner-email@example.com';
```

Now log into `/owner/login` with your owner credentials to access the complete Owner Admin Dashboard!
