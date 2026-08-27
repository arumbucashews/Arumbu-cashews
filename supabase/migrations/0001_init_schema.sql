-- ============================================================
-- ARUMBU CASHEWS — CORE SCHEMA
-- Migration: 0001_init_schema.sql
-- Run this first, in order, in the Supabase SQL editor
-- (or via `supabase db push` if using the CLI).
-- ============================================================

-- gen_random_uuid() ships enabled by default on Supabase (pgcrypto),
-- this is just a safety net if you're running against a bare Postgres.
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Shared helper: auto-maintain updated_at on every row update
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. PROFILES  (one row per admin/staff user, keyed to auth.users)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  email        text,
  avatar_path  text,                         -- storage path in the "media" bucket
  role         text not null default 'admin' check (role in ('admin', 'editor')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. PRODUCTS  (cashew grades)
-- ============================================================
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  grade_name         text not null,                 -- e.g. "WW180"
  slug               text,                           -- optional, e.g. "ww180" — used for pretty URLs if needed later
  short_description  text,
  full_description   text,
  status             text not null default 'active'
                       check (status in ('active', 'hidden', 'out_of_stock', 'draft')),
  is_featured        boolean not null default false,
  is_published       boolean not null default true,
  display_order      integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One row per grade — the Admin CMS can still add brand-new grades
-- later, it just can't create two rows with the same name.
create unique index if not exists uniq_products_grade_name
  on public.products (lower(grade_name));

create index if not exists idx_products_display_order on public.products (display_order);
create index if not exists idx_products_status on public.products (status);
create index if not exists idx_products_published on public.products (is_published);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. PRODUCT IMAGES  (a product can have a primary image + gallery)
-- ============================================================
create table if not exists public.product_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  storage_path   text not null,               -- path inside the "product-images" bucket
  alt_text       text,
  is_primary     boolean not null default false,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_product_images_product_id on public.product_images (product_id);
create unique index if not exists uniq_product_primary_image
  on public.product_images (product_id)
  where is_primary = true;                     -- at most one primary image per product

-- ============================================================
-- 4. RATE CARDS  (admin-only pricing, one row per product)
-- ============================================================
create table if not exists public.rate_cards (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  rate            numeric(10, 2),               -- null = blank, never render as 0
  unit            text not null default 'Kg',
  availability    text not null default 'available'
                    check (availability in ('available', 'out_of_stock', 'seasonal')),
  is_visible      boolean not null default false, -- admin-only by default; flip to expose a public rate card later
  effective_date  date not null default current_date,
  updated_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists uniq_rate_cards_product on public.rate_cards (product_id);

create trigger trg_rate_cards_updated_at
  before update on public.rate_cards
  for each row execute function public.set_updated_at();

-- Optional lightweight history log — one row appended per rate change,
-- so "maintain rate history if practical" doesn't require re-deriving
-- history from updated_at alone.
create table if not exists public.rate_card_history (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  rate         numeric(10, 2),
  unit         text,
  changed_by   uuid references public.profiles (id),
  changed_at   timestamptz not null default now()
);

create index if not exists idx_rate_history_product on public.rate_card_history (product_id);

-- ============================================================
-- 5. WHOLESALE ENQUIRIES
-- ============================================================
create table if not exists public.wholesale_enquiries (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  company          text,
  phone            text not null,
  whatsapp         text,
  email            text,
  location         text,
  grade_requested  text,                        -- free text: supports "Other / multiple grades"
  quantity         text,
  message          text,
  status           text not null default 'new'
                     check (status in ('new', 'contacted', 'in_progress', 'converted', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_wholesale_status on public.wholesale_enquiries (status);
create index if not exists idx_wholesale_created on public.wholesale_enquiries (created_at desc);

create trigger trg_wholesale_updated_at
  before update on public.wholesale_enquiries
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6. CONTACT MESSAGES
-- ============================================================
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  message     text not null,
  status      text not null default 'new'
                check (status in ('new', 'contacted', 'closed')),
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_contact_status on public.contact_messages (status);
create index if not exists idx_contact_read on public.contact_messages (is_read);
create index if not exists idx_contact_created on public.contact_messages (created_at desc);

create trigger trg_contact_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7. SITE SETTINGS  (single source of truth — key/value)
-- ============================================================
create table if not exists public.site_settings (
  key         text primary key,                 -- e.g. 'business_name', 'primary_phone'
  value       text,
  updated_at  timestamptz not null default now()
);

create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- 8. SOCIAL LINKS
-- ============================================================
create table if not exists public.social_links (
  id             uuid primary key default gen_random_uuid(),
  platform       text not null unique
                   check (platform in ('phone', 'whatsapp', 'facebook', 'instagram')),
  url            text,                           -- null/blank => hide the icon, never a broken link
  is_visible     boolean not null default true,
  display_order  integer not null default 0,
  updated_at     timestamptz not null default now()
);

create trigger trg_social_links_updated_at
  before update on public.social_links
  for each row execute function public.set_updated_at();

-- ============================================================
-- 9. MEDIA LIBRARY
-- ============================================================
create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  file_name     text not null,
  file_type     text not null,                   -- mime type, e.g. image/jpeg, video/mp4
  storage_path  text not null,                    -- path inside its bucket
  bucket        text not null default 'media',
  category      text not null default 'other'
                  check (category in (
                    'product_image', 'product_gallery', 'hero_image', 'hero_video',
                    'about_image', 'website_gallery', 'logo', 'favicon', 'other'
                  )),
  uploaded_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_media_category on public.media (category);

-- ============================================================
-- 10. HERO SETTINGS  (singleton — one active row)
-- ============================================================
create table if not exists public.hero_settings (
  id                    uuid primary key default gen_random_uuid(),
  heading               text not null default 'Sourced with care. Processed with precision.',
  subheading            text,
  cta_text              text default 'Order on WhatsApp',
  cta_link              text default 'https://wa.me/919976055524',
  video_storage_path    text,                     -- path inside "media" bucket, hero_video category
  poster_storage_path   text,                     -- fallback poster image
  is_video_enabled      boolean not null default true,
  is_active             boolean not null default true,
  updated_at            timestamptz not null default now()
);

create trigger trg_hero_settings_updated_at
  before update on public.hero_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- 11. ABOUT CONTENT  (ordered, editable sections)
-- ============================================================
create table if not exists public.about_content (
  id             uuid primary key default gen_random_uuid(),
  section_key    text not null unique,            -- e.g. 'hero', 'our_story', 'journey', 'people', 'philosophy', 'commitment'
  heading        text,
  body           text,
  image_path     text,                            -- path inside "media" bucket, about_image category
  display_order  integer not null default 0,
  is_visible     boolean not null default true,
  updated_at     timestamptz not null default now()
);

create index if not exists idx_about_display_order on public.about_content (display_order);

create trigger trg_about_content_updated_at
  before update on public.about_content
  for each row execute function public.set_updated_at();
