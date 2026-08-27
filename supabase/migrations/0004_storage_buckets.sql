-- ============================================================
-- ARUMBU CASHEWS — STORAGE BUCKETS
-- Migration: 0004_storage_buckets.sql
-- Run AFTER 0001-0003.
--
-- Creates two buckets:
--   product-images  — public read (product photos need to load on
--                      the live site without auth), admin-only write.
--   media           — hero videos/posters, logo, favicon, about
--                      images, gallery. Also public read, admin write,
--                      since these render on the public site too.
--
-- Nothing here is ever base64-in-the-database — every image/video
-- is a real file in one of these buckets, referenced by its
-- storage_path from products / product_images / hero_settings /
-- about_content / media rows.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 10485760,  -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp']),
  ('media', 'media', true, 209715200,                     -- 200 MB (covers hero video)
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'image/x-icon', 'image/svg+xml'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Public read on both buckets — anyone can GET a file by its path,
-- same as any other static asset on the live site.
-- ------------------------------------------------------------
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "media_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

-- ------------------------------------------------------------
-- Admin-only write (upload / replace / delete). Reuses the same
-- public.is_admin() helper defined in 0002_rls_policies.sql.
-- ------------------------------------------------------------
create policy "product_images_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "media_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and public.is_admin());

create policy "media_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

create policy "media_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_admin());
