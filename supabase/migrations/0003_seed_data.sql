-- ============================================================
-- ARUMBU CASHEWS — SEED DATA
-- Migration: 0003_seed_data.sql
-- Run AFTER 0001_init_schema.sql and 0002_rls_policies.sql.
--
-- This is meant to run once, against a fresh database. It uses
-- `on conflict do nothing` / fixed ids so re-running it is harmless.
-- ============================================================

-- ------------------------------------------------------------
-- PRODUCTS — the 13 grades, in the exact required order.
-- Fixed ids so this file, product_images seeding, and rate_cards
-- seeding can all reference the same rows reliably. grade_name is
-- enforced unique (see 0001_init_schema.sql) — the Admin CMS can add
-- new grades later, but never a duplicate of an existing one.
-- ------------------------------------------------------------
insert into public.products (id, grade_name, display_order, status, is_published)
values
  ('1f918df7-7508-418d-a95d-6fec2521b1f3', 'WW180', 1,  'active', true),
  ('bc174663-0ecf-4d3b-87c1-13ee0d0d7b6d', 'WW210', 2,  'active', true),
  ('8db60486-b93f-4925-8b7d-4c9431d2f692', 'WW240', 3,  'active', true),
  ('7eec30ad-e158-4319-afcb-20ffb706675e', 'WW320', 4,  'active', true),
  ('8e897eb8-ea1c-4430-a556-d8e36d0e4c50', 'WW400', 5,  'active', true),
  ('8e638f5c-738c-4c74-bbfe-0f44be23151b', 'SW',    6,  'active', true),
  ('19494733-a98d-4424-85d2-06d501dd8081', 'SSW',   7,  'active', true),
  ('946284b6-75d5-429c-a067-9aed29b2bd1d', 'LWP',   8,  'active', true),
  ('1bfb7067-4bba-4a65-aee6-47407f8990c7', 'CSP',   9,  'active', true),
  ('a10672a4-912c-4235-988d-a2e4457249e9', 'BB',    10, 'active', true),
  ('bbcbfd00-7294-4a90-a7fa-1f53b8944dfa', 'JH',    11, 'active', true),
  ('f2816969-550a-40f1-b981-5cf135f51b72', 'SJH',   12, 'active', true),
  ('1ac3b460-50d3-4933-af2f-cec088fa7cf3', 'JK',    13, 'active', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- RATE CARDS — one blank row per product. rate = null, so the
-- public product cards (which don't read this table anyway) can
-- never accidentally render a fake ₹0.
-- ------------------------------------------------------------
insert into public.rate_cards (product_id, rate, unit, availability, is_visible)
select id, null, 'Kg', 'available', false
from public.products
on conflict (product_id) do nothing;

-- ------------------------------------------------------------
-- SITE SETTINGS — single source of truth for contact/business info.
-- Update these values from Admin, not by editing HTML.
-- ------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('business_name',    'Arumbu Cashews'),
  ('primary_phone',    '+91 99760 55524'),
  ('secondary_phone',  '+91 90806 56477'),
  ('whatsapp_number',  '+91 99760 55524'),
  ('email',            'hello@arumbucashews.com'),
  ('address',          ''),
  ('google_maps_url',  ''),
  ('working_hours',    ''),
  ('footer_credit',    'Website created by ❤️ Sanjay Gandhi')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- SOCIAL LINKS — url left blank for Facebook/Instagram until the
-- real links are provided; a blank url means the public policy
-- hides that icon rather than rendering a dead link.
-- ------------------------------------------------------------
insert into public.social_links (platform, url, is_visible, display_order) values
  ('phone',     '+919976055524',              true, 1),
  ('whatsapp',  'https://wa.me/919976055524', true, 2),
  ('facebook',  null,                         true, 3),
  ('instagram', null,                         true, 4)
on conflict (platform) do nothing;

-- ------------------------------------------------------------
-- HERO SETTINGS — one active row, matches the current homepage copy.
-- Guarded with a NOT EXISTS check (rather than ON CONFLICT) since
-- there's no natural unique key to conflict on for a singleton row.
-- ------------------------------------------------------------
insert into public.hero_settings (heading, subheading, cta_text, cta_link, is_video_enabled, is_active)
select
  'Sourced with care. Processed with precision.',
  'From the orchard to the sorting floor, every batch under the Arumbu name is handled with the same attention to detail — sorted, roasted and sealed within days of harvest.',
  'Order on WhatsApp',
  'https://wa.me/919976055524?text=Hi%20Arumbu%20Cashews%2C%20I%27d%20like%20to%20order',
  true,
  true
where not exists (select 1 from public.hero_settings);

-- ------------------------------------------------------------
-- ABOUT CONTENT — the sections built on the About page, editable
-- from Admin without touching HTML. section_key matches what the
-- rebuilt About page will look up.
-- ------------------------------------------------------------
insert into public.about_content (section_key, heading, body, display_order, is_visible) values
(
  'hero',
  'From the Cashew Tree to Arumbu Cashews',
  'A family journey that began with cashew cultivation and raw cashews, and gradually grew into full-fledged cashew processing.',
  1, true
),
(
  'our_story',
  'Roots in cashew cultivation',
  'Arumbu Cashews did not begin as a brand entering the cashew business. It began at the cultivation level, with a family that grew cashews and harvested raw cashews directly from the trees. In the early years, the family sold the harvested cashews as raw produce, without processing them into finished kernels. Over time, the business gradually evolved — Arumbu Cashews was started as the family moved towards processing cashews themselves.',
  2, true
),
(
  'journey',
  'Cultivation to processing',
  'Roots in Cashew Cultivation -> Raw Cashew Trade -> A New Beginning (Arumbu Cashews established) -> Learning & Growing -> Processing Today.',
  3, true
),
(
  'people',
  'A family name',
  'Founder: Mr. Shivakumar. His father: Mr. Lakshmanaperumal, part of the family''s early journey with cashew cultivation and raw cashews. The name "Arumbu" comes from Shivakumar''s mother — the business is named Arumbu Cashews in her memory.',
  4, true
),
(
  'philosophy',
  'From the tree to the finished kernel',
  'We believe quality begins with understanding the raw cashew. Because the family has been connected with cashew cultivation and raw cashews, the business understands that good finished cashews begin with good raw material and careful processing.',
  5, true
),
(
  'commitment',
  'A good product should speak for itself',
  'Arumbu Cashews is being built with a simple intention: to provide properly processed, carefully handled and good-quality cashew products. The focus is not only on selling cashews, but on continuously improving the product and giving customers a quality product they can trust.',
  6, true
)
on conflict (section_key) do nothing;
