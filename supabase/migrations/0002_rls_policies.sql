-- ============================================================
-- ARUMBU CASHEWS — ROW LEVEL SECURITY
-- Migration: 0002_rls_policies.sql
-- Run AFTER 0001_init_schema.sql.
--
-- Model:
--   - "public" (anon key)   -> read-only, and only the rows/tables
--                              that the live website actually needs.
--   - "authenticated" admin -> full read/write, gated by is_admin().
--   - service_role key is never used from the frontend — it bypasses
--     RLS entirely and must stay server-side only if you ever need it.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: is the current session an admin?
-- SECURITY DEFINER so it can read `profiles` without recursing
-- into the RLS policy defined ON `profiles` itself.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'editor')
  );
$$;

-- Enable RLS everywhere. A table with RLS enabled and no matching
-- policy denies all access by default — that's the safe starting point.
alter table public.profiles              enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.rate_cards            enable row level security;
alter table public.rate_card_history     enable row level security;
alter table public.wholesale_enquiries   enable row level security;
alter table public.contact_messages      enable row level security;
alter table public.site_settings         enable row level security;
alter table public.social_links          enable row level security;
alter table public.media                 enable row level security;
alter table public.hero_settings         enable row level security;
alter table public.about_content         enable row level security;

-- ============================================================
-- PROFILES  (admin/staff only)
-- Own row readable/updatable by the user themself; admins see all.
-- No public access, and no public INSERT policy at all — a profiles
-- row is only ever created manually by an existing admin (see the
-- provisioning note below), never by a self-signup flow.
-- ============================================================
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- IMPORTANT — admin provisioning is DELIBERATE, not automatic.
--
-- There is no trigger here that auto-creates a `profiles` (admin)
-- row for every new auth.users signup. That's intentional: once real
-- customer self-signup exists (see 0005_customer_commerce.sql,
-- `customer_profiles`), the SAME auth.users table holds both admin
-- and customer accounts. An auto-admin trigger would silently grant
-- admin rights to every customer who signs up on the public site —
-- exactly the hole this schema must not have.
--
-- Instead: create the admin's auth user via the Supabase Dashboard
-- (Authentication -> Users -> Add user), then manually insert their
-- `profiles` row once, from the SQL editor:
--
--   insert into public.profiles (id, email, full_name, role)
--   values ('<their-auth-user-uuid>', 'admin@example.com', 'Admin Name', 'admin');
--
-- Full walkthrough is in SUPABASE_SETUP.md.
-- ------------------------------------------------------------

-- ============================================================
-- PRODUCTS
-- Public: only published, non-hidden/draft grades.
-- Admin: everything.
-- ============================================================
create policy "products_public_select"
  on public.products for select
  to anon, authenticated
  using (is_published = true and status in ('active', 'out_of_stock'));

create policy "products_admin_all"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- PRODUCT IMAGES
-- Public: only images belonging to a publicly-visible product.
-- Admin: everything.
-- ============================================================
create policy "product_images_public_select"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.is_published = true
        and p.status in ('active', 'out_of_stock')
    )
  );

create policy "product_images_admin_all"
  on public.product_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- RATE CARDS + RATE CARD HISTORY
-- Admin-only, full stop — no public policy at all (per spec: prices
-- are never rendered on public product cards).
-- ============================================================
create policy "rate_cards_admin_all"
  on public.rate_cards for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "rate_card_history_admin_all"
  on public.rate_card_history for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- WHOLESALE ENQUIRIES
-- Public: can INSERT (submit the form) but never read/update/delete
-- anyone's enquiries, including their own, back through the anon key.
-- Admin: full access.
-- ============================================================
create policy "wholesale_public_insert"
  on public.wholesale_enquiries for insert
  to anon, authenticated
  with check (true);

create policy "wholesale_admin_select"
  on public.wholesale_enquiries for select
  to authenticated
  using (public.is_admin());

create policy "wholesale_admin_update"
  on public.wholesale_enquiries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "wholesale_admin_delete"
  on public.wholesale_enquiries for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- CONTACT MESSAGES
-- Same pattern as wholesale enquiries.
-- ============================================================
create policy "contact_public_insert"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

create policy "contact_admin_select"
  on public.contact_messages for select
  to authenticated
  using (public.is_admin());

create policy "contact_admin_update"
  on public.contact_messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "contact_admin_delete"
  on public.contact_messages for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- SITE SETTINGS
-- Public: read everything (the live site needs phone/email/address
-- etc. to render). Admin: full write.
-- ============================================================
create policy "site_settings_public_select"
  on public.site_settings for select
  to anon, authenticated
  using (true);

create policy "site_settings_admin_write"
  on public.site_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- SOCIAL LINKS
-- Public: only rows marked visible (so an empty/unset link never
-- renders as a dead icon). Admin: full write.
-- ============================================================
create policy "social_links_public_select"
  on public.social_links for select
  to anon, authenticated
  using (is_visible = true and url is not null and url <> '');

create policy "social_links_admin_write"
  on public.social_links for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- MEDIA LIBRARY
-- Admin-only table. The public site never queries `media` directly —
-- it reads storage paths that are already attached to products,
-- hero_settings, about_content, etc.
-- ============================================================
create policy "media_admin_all"
  on public.media for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- HERO SETTINGS
-- Public: the single active row. Admin: full write.
-- ============================================================
create policy "hero_settings_public_select"
  on public.hero_settings for select
  to anon, authenticated
  using (is_active = true);

create policy "hero_settings_admin_write"
  on public.hero_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- ABOUT CONTENT
-- Public: only visible sections, in order. Admin: full write.
-- ============================================================
create policy "about_content_public_select"
  on public.about_content for select
  to anon, authenticated
  using (is_visible = true);

create policy "about_content_admin_write"
  on public.about_content for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
