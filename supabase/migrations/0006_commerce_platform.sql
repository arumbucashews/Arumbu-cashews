-- ============================================================
-- ARUMBU CASHEWS — COMMERCE PLATFORM
-- Migration: 0006_commerce_platform.sql
-- Run AFTER 0001-0005. Strictly additive: nothing is dropped, deleted
-- or renamed. Where an existing CHECK constraint is too narrow, a NEW
-- column carries the full set of values and a trigger keeps the old
-- column in sync with its original allowed values:
--   * orders.order_status        (full lifecycle)  -> syncs orders.status
--   * wholesale_enquiries.pipeline_status          -> syncs .status
--   * cart_lines (one line per pack size) replaces use of cart_items,
--     whose (cart_id, product_id) unique index is left untouched
-- Changes to existing objects are limited to:
--   * two insecure customer INSERT policies on orders/order_items
--     neutralised (ALTER POLICY ... WITH CHECK (false)) — orders are now
--     created only by place_order(), which re-prices from the database
--   * public INSERT policies on enquiries tightened to status = 'new'
--   * explicit GRANTs so the production "hardened" privileges allow
--     exactly what the website needs (see section 14)
-- ============================================================

-- ------------------------------------------------------------
-- 1. PRODUCTS — bilingual names/descriptions, SEO, unique slug
-- ------------------------------------------------------------
alter table public.products
  add column if not exists full_name            text,
  add column if not exists full_name_ta         text,
  add column if not exists short_description_ta text,
  add column if not exists full_description_ta  text,
  add column if not exists seo_title            text,
  add column if not exists seo_description      text;

create unique index if not exists uniq_products_slug
  on public.products (lower(slug)) where slug is not null;

alter table public.product_images
  add column if not exists alt_text_ta text;

-- ------------------------------------------------------------
-- 2. PRODUCT VARIANTS (pack sizes) — the ONE source of retail price
--    price null = not for sale yet ("price on request")
-- ------------------------------------------------------------
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  pack_label     text not null check (char_length(pack_label) between 1 and 20),
  weight_grams   integer not null check (weight_grams > 0),
  sku            text,
  price          numeric(10, 2) check (price is null or price >= 0),
  sale_price     numeric(10, 2) check (sale_price is null or sale_price >= 0),
  is_active      boolean not null default true,
  in_stock       boolean not null default false,   -- maintained from public.inventory (trigger)
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint product_variants_sale_below_price check (sale_price is null or price is null or sale_price < price),
  constraint product_variants_unique_weight unique (product_id, weight_grams)
);
create unique index if not exists uniq_product_variants_sku on public.product_variants (lower(sku)) where sku is not null;
create index if not exists idx_product_variants_product on public.product_variants (product_id);
create trigger trg_product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. INVENTORY (admin-only stock figures) + movement history
-- ------------------------------------------------------------
create table if not exists public.inventory (
  variant_id           uuid primary key references public.product_variants (id) on delete cascade,
  stock_qty            integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold  integer not null default 0 check (low_stock_threshold >= 0),
  track_stock          boolean not null default true,
  updated_at           timestamptz not null default now()
);
create trigger trg_inventory_updated_at before update on public.inventory
  for each row execute function public.set_updated_at();

create table if not exists public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references public.product_variants (id) on delete cascade,
  change      integer not null,
  stock_after integer not null,
  reason      text not null check (reason in ('initial', 'restock', 'adjustment', 'order', 'cancellation', 'return')),
  order_id    uuid,
  note        text check (note is null or char_length(note) <= 500),
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_inventory_movements_variant on public.inventory_movements (variant_id, created_at desc);

-- ------------------------------------------------------------
-- 4. CUSTOMERS — language preference + saved addresses
-- ------------------------------------------------------------
alter table public.customer_profiles
  add column if not exists preferred_language text not null default 'en' check (preferred_language in ('en', 'ta'));

create table if not exists public.customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customer_profiles (id) on delete cascade,
  label        text check (label is null or char_length(label) <= 40),
  full_name    text not null check (char_length(full_name) between 1 and 120),
  phone        text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1        text not null check (char_length(line1) between 1 and 200),
  line2        text check (line2 is null or char_length(line2) <= 200),
  landmark     text check (landmark is null or char_length(landmark) <= 120),
  city         text not null check (char_length(city) between 1 and 80),
  state        text not null check (char_length(state) between 1 and 80),
  pincode      text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_customer_addresses_customer on public.customer_addresses (customer_id);
create unique index if not exists uniq_default_address_per_customer on public.customer_addresses (customer_id) where is_default;
create trigger trg_customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. CART LINES — one line per pack size (cart_items is left as-is)
-- ------------------------------------------------------------
create table if not exists public.cart_lines (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.cart (id) on delete cascade,
  variant_id  uuid not null references public.product_variants (id) on delete cascade,
  quantity    integer not null default 1 check (quantity between 1 and 999),
  added_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cart_lines_unique_variant unique (cart_id, variant_id)
);
create index if not exists idx_cart_lines_cart on public.cart_lines (cart_id);
create trigger trg_cart_lines_updated_at before update on public.cart_lines
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. ORDERS — full lifecycle, totals, address, payment, fulfilment
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists order_status           text not null default 'pending'
                             check (order_status in ('pending', 'confirmed', 'processing', 'packed', 'shipped',
                                                     'out_for_delivery', 'delivered', 'cancelled', 'refunded')),
  add column if not exists customer_name          text,
  add column if not exists customer_email         text,
  add column if not exists address_line1          text,
  add column if not exists address_line2          text,
  add column if not exists landmark               text,
  add column if not exists city                   text,
  add column if not exists state                  text,
  add column if not exists pincode                text,
  add column if not exists delivery_instructions  text,
  add column if not exists payment_method         text not null default 'whatsapp'
                             check (payment_method in ('whatsapp', 'razorpay')),
  add column if not exists payment_status         text not null default 'unpaid'
                             check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  add column if not exists currency               text not null default 'INR',
  add column if not exists subtotal               numeric(12, 2) not null default 0,
  add column if not exists delivery_fee           numeric(12, 2) not null default 0,
  add column if not exists delivery_confirmed     boolean not null default true,
  add column if not exists discount               numeric(12, 2) not null default 0,
  add column if not exists tax                    numeric(12, 2) not null default 0,
  add column if not exists tax_rate               numeric(5, 2),
  add column if not exists tax_inclusive          boolean not null default true,
  add column if not exists total                  numeric(12, 2) not null default 0,
  add column if not exists coupon_code            text,
  add column if not exists razorpay_order_id      text,
  add column if not exists razorpay_payment_id    text,
  add column if not exists paid_at                timestamptz,
  add column if not exists invoice_number         text,
  add column if not exists courier_name           text,
  add column if not exists tracking_number        text,
  add column if not exists shipped_at             timestamptz,
  add column if not exists delivered_at           timestamptz,
  add column if not exists cancelled_at           timestamptz,
  add column if not exists cancellation_reason    text,
  add column if not exists stock_released         boolean not null default false;
-- Backfill order_status for any existing rows (production has none today).
update public.orders set order_status = case status when 'completed' then 'delivered' else status end
 where order_status is distinct from case status when 'completed' then 'delivered' else status end;

create unique index if not exists uniq_orders_invoice_number on public.orders (invoice_number) where invoice_number is not null;
create unique index if not exists uniq_orders_razorpay_order on public.orders (razorpay_order_id) where razorpay_order_id is not null;
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_orders_order_status on public.orders (order_status);

alter table public.order_items
  add column if not exists variant_id             uuid references public.product_variants (id) on delete set null,
  add column if not exists product_name_snapshot  text,
  add column if not exists pack_label_snapshot    text,
  add column if not exists weight_grams_snapshot  integer,
  add column if not exists sku_snapshot           text,
  add column if not exists unit_price             numeric(10, 2),
  add column if not exists line_total             numeric(12, 2);

create table if not exists public.order_status_history (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  field        text not null default 'status' check (field in ('status', 'payment_status')),
  note         text,
  changed_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_order_status_history_order on public.order_status_history (order_id, created_at);

-- Internal admin notes live in their own admin-only table, because
-- customers can read their own order rows.
create table if not exists public.order_notes (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  note        text not null check (char_length(note) between 1 and 2000),
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_order_notes_order on public.order_notes (order_id, created_at);

create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  provider             text not null default 'razorpay',
  provider_order_id    text,
  provider_payment_id  text,
  amount               numeric(12, 2) not null,
  currency             text not null default 'INR',
  status               text not null check (status in ('created', 'paid', 'failed', 'refunded')),
  raw                  jsonb,
  created_at           timestamptz not null default now()
);
create unique index if not exists uniq_payments_provider_payment on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create index if not exists idx_payments_order on public.payments (order_id);

-- Order / invoice numbering
create sequence if not exists public.order_number_seq;
create sequence if not exists public.invoice_number_seq;

-- ------------------------------------------------------------
-- 7. COUPONS (architecture — no coupons are created by this file)
-- ------------------------------------------------------------
create table if not exists public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description       text,
  discount_type     text not null check (discount_type in ('percent', 'fixed')),
  value             numeric(10, 2) not null check (value > 0),
  min_order_amount  numeric(10, 2) not null default 0,
  max_discount      numeric(10, 2),
  starts_at         timestamptz,
  ends_at           timestamptz,
  usage_limit       integer check (usage_limit is null or usage_limit > 0),
  used_count        integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint coupons_percent_max check (discount_type <> 'percent' or value <= 100)
);
create unique index if not exists uniq_coupons_code on public.coupons (code);
create trigger trg_coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 8. ENQUIRIES — wholesale statuses, notes; gifting enquiries
-- ------------------------------------------------------------
alter table public.wholesale_enquiries
  add column if not exists pipeline_status text not null default 'new'
    check (pipeline_status in ('new', 'contacted', 'quotation_sent', 'negotiation', 'converted', 'closed')),
  add column if not exists admin_notes text;
update public.wholesale_enquiries set pipeline_status = case status when 'in_progress' then 'contacted' else status end
 where pipeline_status is distinct from case status when 'in_progress' then 'contacted' else status end;

alter table public.contact_messages add column if not exists subject text;
alter table public.contact_messages add column if not exists admin_notes text;

create table if not exists public.gifting_enquiries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  company       text check (company is null or char_length(company) <= 160),
  phone         text not null check (char_length(phone) between 6 and 20),
  email         text check (email is null or char_length(email) <= 160),
  occasion      text not null default 'other' check (occasion in ('corporate', 'wedding', 'festival', 'bulk', 'other')),
  quantity      text check (quantity is null or char_length(quantity) <= 120),
  required_by   date,
  location      text check (location is null or char_length(location) <= 160),
  message       text check (message is null or char_length(message) <= 2000),
  status        text not null default 'new' check (status in ('new', 'contacted', 'quotation_sent', 'negotiation', 'converted', 'closed')),
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_gifting_created on public.gifting_enquiries (created_at desc);
create trigger trg_gifting_updated_at before update on public.gifting_enquiries
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 9. SOCIAL LINKS — social_links keeps phone/whatsapp/facebook/
--    instagram; YouTube / LinkedIn / X live in site_settings
--    (social_youtube_url, social_linkedin_url, social_x_url).
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 10. CMS — bilingual text blocks, hero slides, hero Tamil fields,
--     legal/info pages, FAQs
-- ------------------------------------------------------------
create table if not exists public.content_blocks (
  key         text primary key check (key ~ '^[a-z0-9_.-]{3,80}$'),
  value_en    text,
  value_ta    text,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);
create trigger trg_content_blocks_updated_at before update on public.content_blocks
  for each row execute function public.set_updated_at();

alter table public.hero_settings
  add column if not exists heading_ta     text,
  add column if not exists subheading_ta  text,
  add column if not exists cta_text_ta    text;

create table if not exists public.hero_slides (
  id             uuid primary key default gen_random_uuid(),
  image_url      text not null,            -- site path (images/hero/..) or public storage URL
  storage_path   text,                     -- set when uploaded through Admin (media bucket)
  alt_en         text,
  alt_ta         text,
  display_order  integer not null default 0,
  is_active      boolean not null default true,
  updated_at     timestamptz not null default now()
);
create trigger trg_hero_slides_updated_at before update on public.hero_slides
  for each row execute function public.set_updated_at();

create table if not exists public.pages (
  slug             text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
  title_en         text not null,
  title_ta         text,
  body_en          text,
  body_ta          text,
  seo_title        text,
  seo_description  text,
  is_published     boolean not null default true,
  updated_at       timestamptz not null default now()
);
create trigger trg_pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

create table if not exists public.faqs (
  id             uuid primary key default gen_random_uuid(),
  question_en    text not null,
  question_ta    text,
  answer_en      text not null,
  answer_ta      text,
  display_order  integer not null default 0,
  is_published   boolean not null default true,
  updated_at     timestamptz not null default now()
);
create trigger trg_faqs_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 11. NOTIFICATION OUTBOX — queued events; the "notify" Edge Function
--     sends them only when a provider credential is configured.
-- ------------------------------------------------------------
create table if not exists public.notification_outbox (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,
  audience    text not null check (audience in ('customer', 'admin')),
  channel     text not null default 'email' check (channel in ('email', 'whatsapp', 'sms')),
  recipient   text,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts    integer not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists idx_outbox_status on public.notification_outbox (status, created_at);

-- ============================================================
-- 12. FUNCTIONS
-- ============================================================

-- Read one site setting (text), '' when missing.
create or replace function public.get_setting(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_settings where key = p_key), '');
$$;

-- Queue a notification (internal).
create or replace function public.enqueue_notification(p_event text, p_audience text, p_recipient text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_outbox (event, audience, channel, recipient, payload, status, last_error)
  values (p_event, p_audience, 'email', nullif(trim(coalesce(p_recipient, '')), ''), coalesce(p_payload, '{}'::jsonb),
          case when nullif(trim(coalesce(p_recipient, '')), '') is null then 'skipped' else 'queued' end,
          case when nullif(trim(coalesce(p_recipient, '')), '') is null then 'no recipient configured' else null end);
end;
$$;

-- Price quote for a list of {variant_id, quantity}. Single pricing
-- logic used by guest carts, the signed-in cart and place_order().
create or replace function public.quote_items(p_items jsonb, p_coupon_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_sub numeric(12, 2) := 0;
  v_ok boolean := true;
  r record;
  v_fee_txt text := public.get_setting('delivery_fee');
  v_free_txt text := public.get_setting('free_delivery_threshold');
  v_fee numeric(12, 2) := 0;
  v_delivery_configured boolean := v_fee_txt ~ '^[0-9]+(\.[0-9]{1,2})?$';
  v_discount numeric(12, 2) := 0;
  v_coupon_msg text := null;
  c public.coupons%rowtype;
  v_gst_enabled boolean := public.get_setting('gst_enabled') = 'true';
  v_gst_rate numeric(5, 2) := 0;
  v_inclusive boolean := public.get_setting('gst_prices_inclusive') <> 'false';
  v_tax numeric(12, 2) := 0;
  v_total numeric(12, 2);
begin
  for r in
    select (it ->> 'variant_id')::uuid as variant_id,
           greatest(1, least(999, coalesce((it ->> 'quantity')::int, 1))) as quantity,
           v.pack_label, v.weight_grams, v.sku, v.price, v.sale_price, v.is_active, v.in_stock,
           p.id as product_id, p.grade_name, p.full_name, p.full_name_ta, p.slug,
           (p.is_published and p.status = 'active') as product_ok,
           (select i.storage_path from public.product_images i where i.product_id = p.id and i.is_primary limit 1) as image_path
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
    join public.product_variants v on v.id = (it ->> 'variant_id')::uuid
    join public.products p on p.id = v.product_id
  loop
    declare
      v_unit numeric(10, 2) := coalesce(r.sale_price, r.price);
      v_status text := case
        when not r.product_ok or not r.is_active then 'unavailable'
        when v_unit is null then 'price_on_request'
        when not r.in_stock then 'out_of_stock'
        else 'available' end;
    begin
      if v_status <> 'available' then v_ok := false; end if;
      v_lines := v_lines || jsonb_build_object(
        'variant_id', r.variant_id, 'product_id', r.product_id, 'grade_name', r.grade_name,
        'full_name', r.full_name, 'full_name_ta', r.full_name_ta, 'slug', r.slug,
        'pack_label', r.pack_label, 'weight_grams', r.weight_grams, 'sku', r.sku,
        'quantity', r.quantity, 'price', r.price, 'sale_price', r.sale_price,
        'unit_price', v_unit, 'line_total', case when v_unit is null then null else round(v_unit * r.quantity, 2) end,
        'status', v_status, 'image_path', r.image_path);
      if v_status = 'available' then v_sub := v_sub + round(v_unit * r.quantity, 2); end if;
    end;
  end loop;

  if v_delivery_configured then
    v_fee := v_fee_txt::numeric;
    if v_free_txt ~ '^[0-9]+(\.[0-9]{1,2})?$' and v_sub >= v_free_txt::numeric then v_fee := 0; end if;
  end if;
  if v_sub = 0 then v_fee := 0; end if;

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into c from public.coupons where code = upper(trim(p_coupon_code));
    if not found or not c.is_active
       or (c.starts_at is not null and now() < c.starts_at)
       or (c.ends_at is not null and now() > c.ends_at)
       or (c.usage_limit is not null and c.used_count >= c.usage_limit) then
      v_coupon_msg := 'invalid';
    elsif v_sub < c.min_order_amount then
      v_coupon_msg := 'min_order';
    else
      v_discount := case when c.discount_type = 'percent' then round(v_sub * c.value / 100, 2) else c.value end;
      if c.max_discount is not null then v_discount := least(v_discount, c.max_discount); end if;
      v_discount := least(v_discount, v_sub);
      v_coupon_msg := 'applied';
    end if;
  end if;

  if v_gst_enabled and public.get_setting('gst_rate') ~ '^[0-9]+(\.[0-9]{1,2})?$' then
    v_gst_rate := public.get_setting('gst_rate')::numeric;
    if v_inclusive then
      v_tax := round((v_sub - v_discount) * v_gst_rate / (100 + v_gst_rate), 2);
    else
      v_tax := round((v_sub - v_discount) * v_gst_rate / 100, 2);
    end if;
  end if;

  v_total := v_sub - v_discount + v_fee + case when v_gst_enabled and not v_inclusive then v_tax else 0 end;

  return jsonb_build_object(
    'items', v_lines, 'all_available', v_ok and jsonb_array_length(v_lines) > 0,
    'subtotal', v_sub, 'delivery_fee', v_fee, 'delivery_configured', v_delivery_configured,
    'free_delivery_threshold', nullif(v_free_txt, ''),
    'discount', v_discount, 'coupon_status', v_coupon_msg,
    'tax', v_tax, 'tax_rate', case when v_gst_enabled then v_gst_rate else null end, 'tax_inclusive', v_inclusive,
    'total', v_total, 'currency', 'INR');
end;
$$;

-- Active cart id for the current user (creates one if needed).
create or replace function public.my_active_cart()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cart uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into public.customer_profiles (id, email)
    select v_uid, u.email from auth.users u where u.id = v_uid
    on conflict (id) do nothing;
  select id into v_cart from public.cart where customer_id = v_uid and status = 'active';
  if v_cart is null then
    insert into public.cart (customer_id, status) values (v_uid, 'active') returning id into v_cart;
  end if;
  return v_cart;
end;
$$;

create or replace function public.cart_get(p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cart uuid := public.my_active_cart(); v_items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity) order by added_at), '[]'::jsonb)
    into v_items from public.cart_lines where cart_id = v_cart;
  return public.quote_items(v_items, p_coupon_code);
end;
$$;

-- Set the quantity of one pack size (0 removes it).
create or replace function public.cart_set_item(p_variant_id uuid, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cart uuid := public.my_active_cart();
begin
  if p_quantity is null or p_quantity < 0 or p_quantity > 999 then raise exception 'invalid_quantity'; end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id) then raise exception 'unknown_variant'; end if;
  if p_quantity = 0 then
    delete from public.cart_lines where cart_id = v_cart and variant_id = p_variant_id;
  else
    insert into public.cart_lines (cart_id, variant_id, quantity)
    values (v_cart, p_variant_id, p_quantity)
    on conflict (cart_id, variant_id) do update set quantity = excluded.quantity;
  end if;
  return public.cart_get(null);
end;
$$;

-- Add to the existing quantity.
create or replace function public.cart_add_item(p_variant_id uuid, p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cart uuid := public.my_active_cart(); v_current int;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then raise exception 'invalid_quantity'; end if;
  select quantity into v_current from public.cart_lines where cart_id = v_cart and variant_id = p_variant_id;
  return public.cart_set_item(p_variant_id, least(999, coalesce(v_current, 0) + p_quantity));
end;
$$;

create or replace function public.cart_clear()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cart uuid := public.my_active_cart();
begin
  delete from public.cart_lines where cart_id = v_cart;
  return public.cart_get(null);
end;
$$;

-- Merge a guest (localStorage) cart after login: quantities are added.
create or replace function public.cart_merge(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  perform public.my_active_cart();
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      perform public.cart_add_item((it ->> 'variant_id')::uuid, greatest(1, least(999, coalesce((it ->> 'quantity')::int, 1))));
    exception when others then
      null; -- skip variants that no longer exist
    end;
  end loop;
  return public.cart_get(null);
end;
$$;

-- Create an order from the signed-in customer's cart. Prices, stock,
-- delivery, coupon and tax are all computed here from the database —
-- nothing price-related is accepted from the browser.
create or replace function public.place_order(
  p_contact jsonb,
  p_address jsonb,
  p_payment_method text,
  p_coupon_code text default null,
  p_delivery_instructions text default null,
  p_save_address boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cart uuid;
  v_items jsonb;
  v_quote jsonb;
  v_line jsonb;
  v_order uuid;
  v_number text;
  v_name text := trim(coalesce(p_contact ->> 'name', ''));
  v_email text := lower(trim(coalesce(p_contact ->> 'email', '')));
  v_phone text := regexp_replace(coalesce(p_contact ->> 'phone', ''), '[^0-9]', '', 'g');
  v_line1 text := trim(coalesce(p_address ->> 'line1', ''));
  v_line2 text := nullif(trim(coalesce(p_address ->> 'line2', '')), '');
  v_landmark text := nullif(trim(coalesce(p_address ->> 'landmark', '')), '');
  v_city text := trim(coalesce(p_address ->> 'city', ''));
  v_state text := trim(coalesce(p_address ->> 'state', ''));
  v_pin text := regexp_replace(coalesce(p_address ->> 'pincode', ''), '[^0-9]', '', 'g');
  v_stock int;
  v_track boolean;
  v_coupon text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_address_text text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := right(v_phone, 10); end if;
  if v_name = '' or char_length(v_name) > 120 then raise exception 'invalid_name'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'invalid_phone'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then raise exception 'invalid_email'; end if;
  if v_line1 = '' or char_length(v_line1) > 200 then raise exception 'invalid_address'; end if;
  if v_city = '' or v_state = '' then raise exception 'invalid_address'; end if;
  if v_pin !~ '^[1-9][0-9]{5}$' then raise exception 'invalid_pincode'; end if;
  if coalesce(char_length(p_delivery_instructions), 0) > 500 then raise exception 'instructions_too_long'; end if;
  if p_payment_method not in ('whatsapp', 'razorpay') then raise exception 'invalid_payment_method'; end if;
  if p_payment_method = 'razorpay' and public.get_setting('payments_razorpay_enabled') <> 'true' then
    raise exception 'online_payment_unavailable';
  end if;
  if p_payment_method = 'whatsapp' and public.get_setting('whatsapp_orders_enabled') = 'false' then
    raise exception 'whatsapp_orders_unavailable';
  end if;

  v_cart := public.my_active_cart();
  perform 1 from public.cart where id = v_cart for update;

  select coalesce(jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity)), '[]'::jsonb)
    into v_items from public.cart_lines where cart_id = v_cart;
  if jsonb_array_length(v_items) = 0 then raise exception 'cart_empty'; end if;

  -- lock inventory rows in a stable order, then re-check stock
  perform 1 from public.inventory
    where variant_id in (select (x ->> 'variant_id')::uuid from jsonb_array_elements(v_items) x)
    order by variant_id for update;

  v_quote := public.quote_items(v_items, v_coupon);
  if not (v_quote ->> 'all_available')::boolean then raise exception 'cart_has_unavailable_items'; end if;
  if v_coupon is not null and coalesce(v_quote ->> 'coupon_status', '') <> 'applied' then raise exception 'invalid_coupon'; end if;
  if p_payment_method = 'razorpay' and not (v_quote ->> 'delivery_configured')::boolean then
    raise exception 'online_payment_unavailable';
  end if;

  for v_line in select * from jsonb_array_elements(v_quote -> 'items') loop
    select stock_qty, track_stock into v_stock, v_track from public.inventory where variant_id = (v_line ->> 'variant_id')::uuid;
    if coalesce(v_track, true) and coalesce(v_stock, 0) < (v_line ->> 'quantity')::int then
      raise exception 'insufficient_stock:%', v_line ->> 'grade_name';
    end if;
  end loop;

  v_number := 'AC-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  v_address_text := concat_ws(', ', v_line1, v_line2, v_landmark, v_city, v_state, v_pin);

  insert into public.orders (
    customer_id, order_number, order_status, contact_phone, contact_whatsapp, delivery_address, notes,
    customer_name, customer_email, address_line1, address_line2, landmark, city, state, pincode,
    delivery_instructions, payment_method, payment_status, subtotal, delivery_fee, delivery_confirmed,
    discount, tax, tax_rate, tax_inclusive, total, coupon_code)
  values (
    v_uid, v_number, 'pending', v_phone, v_phone, v_address_text, nullif(trim(coalesce(p_delivery_instructions, '')), ''),
    v_name, v_email, v_line1, v_line2, v_landmark, v_city, v_state, v_pin,
    nullif(trim(coalesce(p_delivery_instructions, '')), ''), p_payment_method,
    case when p_payment_method = 'razorpay' then 'pending' else 'unpaid' end,
    (v_quote ->> 'subtotal')::numeric, (v_quote ->> 'delivery_fee')::numeric, (v_quote ->> 'delivery_configured')::boolean,
    (v_quote ->> 'discount')::numeric, (v_quote ->> 'tax')::numeric, nullif(v_quote ->> 'tax_rate', '')::numeric,
    (v_quote ->> 'tax_inclusive')::boolean, (v_quote ->> 'total')::numeric, case when v_coupon is not null then v_coupon end)
  returning id into v_order;

  for v_line in select * from jsonb_array_elements(v_quote -> 'items') loop
    insert into public.order_items (
      order_id, product_id, variant_id, grade_name_snapshot, product_name_snapshot, pack_label_snapshot,
      weight_grams_snapshot, sku_snapshot, quantity, unit, unit_price, rate_snapshot, line_total)
    values (
      v_order, (v_line ->> 'product_id')::uuid, (v_line ->> 'variant_id')::uuid, v_line ->> 'grade_name',
      coalesce(v_line ->> 'full_name', v_line ->> 'grade_name'), v_line ->> 'pack_label',
      (v_line ->> 'weight_grams')::int, v_line ->> 'sku', (v_line ->> 'quantity')::int, 'pack',
      (v_line ->> 'unit_price')::numeric, (v_line ->> 'unit_price')::numeric, (v_line ->> 'line_total')::numeric);

    perform set_config('arumbu.stock_reason', 'order', true);
    perform set_config('arumbu.stock_order', v_order::text, true);
    update public.inventory set stock_qty = stock_qty - (v_line ->> 'quantity')::int
      where variant_id = (v_line ->> 'variant_id')::uuid and track_stock;
  end loop;
  perform set_config('arumbu.stock_reason', '', true);
  perform set_config('arumbu.stock_order', '', true);

  if v_coupon is not null then
    update public.coupons set used_count = used_count + 1 where code = v_coupon;
  end if;

  update public.cart set status = 'converted' where id = v_cart;

  update public.customer_profiles
     set full_name = coalesce(full_name, v_name), phone = coalesce(phone, v_phone)
   where id = v_uid;

  if p_save_address then
    insert into public.customer_addresses (customer_id, full_name, phone, line1, line2, landmark, city, state, pincode, is_default)
    values (v_uid, v_name, v_phone, v_line1, v_line2, v_landmark, v_city, v_state, v_pin,
            not exists (select 1 from public.customer_addresses where customer_id = v_uid and is_default));
  end if;

  perform public.enqueue_notification('order_placed', 'customer', v_email,
    jsonb_build_object('order_id', v_order, 'order_number', v_number, 'total', v_quote -> 'total', 'payment_method', p_payment_method));
  perform public.enqueue_notification('order_placed', 'admin', public.get_setting('notify_admin_email'),
    jsonb_build_object('order_id', v_order, 'order_number', v_number, 'total', v_quote -> 'total', 'payment_method', p_payment_method));

  return jsonb_build_object('order_id', v_order, 'order_number', v_number, 'total', v_quote -> 'total',
                            'payment_method', p_payment_method, 'delivery_confirmed', v_quote -> 'delivery_configured');
end;
$$;

-- Customer cancels their own order while it is still pending & unpaid.
create or replace function public.cancel_my_order(p_order_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.order_status <> 'pending' or o.payment_status = 'paid' then raise exception 'order_not_cancellable'; end if;
  perform set_config('arumbu.actor_note', 'Cancelled by customer', true);
  update public.orders set order_status = 'cancelled', cancellation_reason = left(nullif(trim(coalesce(p_reason, '')), ''), 500)
   where id = p_order_id;
  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
end;
$$;

-- Admin: set absolute stock with a reason (writes movement history).
create or replace function public.admin_set_stock(p_variant_id uuid, p_stock_qty integer, p_reason text default 'adjustment',
                                                  p_note text default null, p_low_stock_threshold integer default null,
                                                  p_track_stock boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_stock_qty is null or p_stock_qty < 0 then raise exception 'invalid_stock'; end if;
  if p_reason not in ('initial', 'restock', 'adjustment', 'return') then raise exception 'invalid_reason'; end if;
  perform set_config('arumbu.stock_reason', p_reason, true);
  perform set_config('arumbu.stock_note', coalesce(p_note, ''), true);
  insert into public.inventory (variant_id, stock_qty, low_stock_threshold, track_stock)
  values (p_variant_id, p_stock_qty, coalesce(p_low_stock_threshold, 0), coalesce(p_track_stock, true))
  on conflict (variant_id) do update set
    stock_qty = excluded.stock_qty,
    low_stock_threshold = coalesce(p_low_stock_threshold, public.inventory.low_stock_threshold),
    track_stock = coalesce(p_track_stock, public.inventory.track_stock);
  perform set_config('arumbu.stock_reason', '', true);
  perform set_config('arumbu.stock_note', '', true);
  return (select to_jsonb(i) from public.inventory i where variant_id = p_variant_id);
end;
$$;

-- Admin: change order status / payment status / shipping details in
-- one call, with an optional note recorded in the status history.
create or replace function public.admin_update_order(p_order_id uuid, p_status text default null,
                                                     p_payment_status text default null,
                                                     p_courier_name text default null, p_tracking_number text default null,
                                                     p_note text default null, p_cancellation_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform set_config('arumbu.actor_note', left(coalesce(p_note, ''), 500), true);
  update public.orders set
    order_status        = coalesce(p_status, order_status),
    payment_status      = coalesce(p_payment_status, payment_status),
    courier_name        = coalesce(nullif(trim(p_courier_name), ''), courier_name),
    tracking_number     = coalesce(nullif(trim(p_tracking_number), ''), tracking_number),
    cancellation_reason = coalesce(nullif(trim(p_cancellation_reason), ''), cancellation_reason),
    paid_at             = case when p_payment_status = 'paid' and paid_at is null then now() else paid_at end
  where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is not null then
    insert into public.order_notes (order_id, note, created_by) values (p_order_id, trim(p_note), auth.uid());
  end if;
  perform set_config('arumbu.actor_note', '', true);
  return (select to_jsonb(o) from public.orders o where o.id = p_order_id);
end;
$$;

-- Server-side (Edge Function, service_role) payment helpers.
create or replace function public.payment_attach_gateway_order(p_order_id uuid, p_gateway_order_id text, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set razorpay_order_id = p_gateway_order_id
   where id = p_order_id and payment_method = 'razorpay' and payment_status in ('pending', 'failed', 'unpaid');
  if not found then raise exception 'order_not_payable'; end if;
  insert into public.payments (order_id, provider, provider_order_id, amount, status)
  values (p_order_id, 'razorpay', p_gateway_order_id, p_amount, 'created');
end;
$$;

create or replace function public.payment_confirm(p_order_id uuid, p_gateway_order_id text, p_payment_id text,
                                                  p_amount_paise bigint, p_raw jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.razorpay_order_id is distinct from p_gateway_order_id then raise exception 'gateway_order_mismatch'; end if;
  if o.payment_status = 'paid' then
    return jsonb_build_object('order_id', o.id, 'payment_status', 'paid', 'already', true);
  end if;
  if p_amount_paise <> round(o.total * 100) then raise exception 'amount_mismatch'; end if;
  if o.order_status in ('cancelled', 'refunded') then raise exception 'order_cancelled'; end if;

  insert into public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw)
  values (o.id, 'razorpay', p_gateway_order_id, p_payment_id, o.total, 'paid', p_raw)
  on conflict do nothing;

  perform set_config('arumbu.actor_note', 'Payment verified (Razorpay ' || p_payment_id || ')', true);
  update public.orders set payment_status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now(),
         order_status = case when order_status = 'pending' then 'confirmed' else order_status end
   where id = o.id;

  perform public.enqueue_notification('payment_confirmed', 'customer', o.customer_email,
    jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total));
  return jsonb_build_object('order_id', o.id, 'payment_status', 'paid');
end;
$$;

create or replace function public.payment_mark_failed(p_order_id uuid, p_gateway_order_id text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set payment_status = 'failed'
   where id = p_order_id and razorpay_order_id = p_gateway_order_id and payment_status in ('pending', 'unpaid');
  insert into public.payments (order_id, provider, provider_order_id, amount, status, raw)
  select id, 'razorpay', p_gateway_order_id, total, 'failed', jsonb_build_object('reason', left(coalesce(p_reason, ''), 500))
    from public.orders where id = p_order_id;
end;
$$;

-- Notification worker helpers (service_role only).
create or replace function public.notifications_claim(p_limit integer default 20)
returns setof public.notification_outbox language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.notification_outbox n set status = 'sending', attempts = attempts + 1
   where n.id in (select id from public.notification_outbox where status = 'queued' and attempts < 5
                  order by created_at limit greatest(1, least(p_limit, 100)) for update skip locked)
  returning n.*;
end;
$$;

create or replace function public.notifications_complete(p_id uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('sent', 'failed', 'queued', 'skipped') then raise exception 'invalid_status'; end if;
  update public.notification_outbox
     set status = p_status, last_error = left(p_error, 1000), sent_at = case when p_status = 'sent' then now() end
   where id = p_id;
end;
$$;

-- ============================================================
-- 13. TRIGGERS
-- ============================================================

-- New variant -> inventory row (0 stock, tracked).
create or replace function public.trg_variant_inventory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory (variant_id) values (new.id) on conflict (variant_id) do nothing;
  return new;
end;
$$;
create trigger trg_product_variants_inventory after insert on public.product_variants
  for each row execute function public.trg_variant_inventory();

-- Inventory change -> variant.in_stock, movement history, low-stock alert.
create or replace function public.trg_inventory_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old int := case when tg_op = 'INSERT' then 0 else old.stock_qty end;
  v_reason text := coalesce(nullif(current_setting('arumbu.stock_reason', true), ''), case when tg_op = 'INSERT' then 'initial' else 'adjustment' end);
  v_order text := nullif(current_setting('arumbu.stock_order', true), '');
  v_grade text;
begin
  update public.product_variants set in_stock = (not new.track_stock or new.stock_qty > 0)
   where id = new.variant_id and in_stock is distinct from (not new.track_stock or new.stock_qty > 0);

  if new.stock_qty <> v_old then
    insert into public.inventory_movements (variant_id, change, stock_after, reason, order_id, note, created_by)
    values (new.variant_id, new.stock_qty - v_old, new.stock_qty, v_reason, v_order::uuid,
            nullif(current_setting('arumbu.stock_note', true), ''), auth.uid());
  end if;

  if tg_op = 'UPDATE' and new.track_stock and new.low_stock_threshold > 0
     and new.stock_qty <= new.low_stock_threshold and old.stock_qty > new.low_stock_threshold then
    select p.grade_name || ' ' || v.pack_label into v_grade
      from public.product_variants v join public.products p on p.id = v.product_id where v.id = new.variant_id;
    perform public.enqueue_notification('low_stock', 'admin', public.get_setting('notify_admin_email'),
      jsonb_build_object('variant_id', new.variant_id, 'item', v_grade, 'stock_qty', new.stock_qty));
  end if;
  return new;
end;
$$;
create trigger trg_inventory_after_change after insert or update on public.inventory
  for each row execute function public.trg_inventory_sync();

-- Legacy orders.status is derived from order_status (keeps the
-- original CHECK constraint satisfied without altering it).
create or replace function public.order_status_to_legacy(p_status text)
returns text language sql immutable as $$
  select case p_status
    when 'pending' then 'pending'
    when 'confirmed' then 'confirmed'
    when 'delivered' then 'completed'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'cancelled'
    else 'processing' end;
$$;

-- Order lifecycle rules: timestamps, invoice number, restock on cancel.
create or replace function public.trg_orders_lifecycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if tg_op = 'INSERT' then
    new.status := public.order_status_to_legacy(new.order_status);
    return new;
  end if;
  if new.order_status is distinct from old.order_status then
    if old.order_status in ('cancelled', 'refunded') and not (old.order_status = 'cancelled' and new.order_status = 'refunded') then
      raise exception 'order_closed';
    end if;
    if old.order_status = 'delivered' and new.order_status not in ('refunded', 'delivered') then
      raise exception 'order_already_delivered';
    end if;
    if new.order_status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
    if new.order_status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
    if new.order_status in ('cancelled', 'refunded') and new.cancelled_at is null then new.cancelled_at := now(); end if;
    if new.order_status in ('confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered') and new.invoice_number is null then
      new.invoice_number := 'INV-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
    end if;
    if new.order_status in ('cancelled', 'refunded') and not new.stock_released then
      perform set_config('arumbu.stock_reason', 'cancellation', true);
      perform set_config('arumbu.stock_order', new.id::text, true);
      for it in select variant_id, quantity from public.order_items where order_id = new.id and variant_id is not null loop
        update public.inventory set stock_qty = stock_qty + it.quantity where variant_id = it.variant_id and track_stock;
      end loop;
      perform set_config('arumbu.stock_reason', '', true);
      perform set_config('arumbu.stock_order', '', true);
      new.stock_released := true;
    end if;
  end if;
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' and new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  end if;
  new.status := public.order_status_to_legacy(new.order_status);
  return new;
end;
$$;
create trigger trg_orders_lifecycle before insert or update on public.orders
  for each row execute function public.trg_orders_lifecycle();

-- History + customer notifications after a status change.
create or replace function public.trg_orders_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_note text := nullif(current_setting('arumbu.actor_note', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
    values (new.id, null, new.order_status, 'Order placed', auth.uid());
    return new;
  end if;
  if new.order_status is distinct from old.order_status then
    insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
    values (new.id, old.order_status, new.order_status, v_note, auth.uid());
    if new.order_status in ('confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded') then
      perform public.enqueue_notification('order_' || new.order_status, 'customer', new.customer_email,
        jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.order_status,
                           'courier_name', new.courier_name, 'tracking_number', new.tracking_number));
    end if;
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.order_status_history (order_id, from_status, to_status, field, note, changed_by)
    values (new.id, old.payment_status, new.payment_status, 'payment_status', v_note, auth.uid());
  end if;
  perform set_config('arumbu.actor_note', '', true);
  return new;
end;
$$;
create trigger trg_orders_history after insert or update on public.orders
  for each row execute function public.trg_orders_history();

-- wholesale_enquiries.status is derived from pipeline_status.
create or replace function public.trg_wholesale_pipeline_sync()
returns trigger language plpgsql as $$
begin
  new.status := case new.pipeline_status
    when 'quotation_sent' then 'in_progress'
    when 'negotiation' then 'in_progress'
    else new.pipeline_status end;
  return new;
end;
$$;
create trigger trg_wholesale_pipeline_sync before insert or update on public.wholesale_enquiries
  for each row execute function public.trg_wholesale_pipeline_sync();

-- Admin alerts for new enquiries/messages.
create or replace function public.trg_notify_admin_enquiry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_notification(
    case tg_table_name when 'wholesale_enquiries' then 'wholesale_enquiry'
                       when 'contact_messages' then 'contact_message'
                       else 'gifting_enquiry' end,
    'admin', public.get_setting('notify_admin_email'),
    jsonb_build_object('id', new.id, 'name', new.name, 'table', tg_table_name));
  return new;
end;
$$;
create trigger trg_wholesale_notify after insert on public.wholesale_enquiries
  for each row execute function public.trg_notify_admin_enquiry();
create trigger trg_contact_notify after insert on public.contact_messages
  for each row execute function public.trg_notify_admin_enquiry();
create trigger trg_gifting_notify after insert on public.gifting_enquiries
  for each row execute function public.trg_notify_admin_enquiry();

-- Keep a single default address per customer.
create or replace function public.trg_address_single_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update public.customer_addresses set is_default = false
     where customer_id = new.customer_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;
create trigger trg_customer_addresses_default before insert or update of is_default on public.customer_addresses
  for each row when (new.is_default) execute function public.trg_address_single_default();

-- ============================================================
-- 14. VIEW — public catalogue (respects the caller's RLS)
-- ============================================================
create or replace view public.product_catalog with (security_invoker = true) as
select p.id, p.grade_name, p.slug, p.full_name, p.full_name_ta, p.short_description, p.short_description_ta,
       p.is_featured, p.display_order, p.status, p.created_at, p.seo_title, p.seo_description,
       (select i.storage_path from public.product_images i where i.product_id = p.id and i.is_primary limit 1) as primary_image_path,
       min(coalesce(v.sale_price, v.price)) filter (where v.is_active and v.price is not null) as min_price,
       max(coalesce(v.sale_price, v.price)) filter (where v.is_active and v.price is not null) as max_price,
       coalesce(bool_or(v.is_active and v.price is not null and v.in_stock), false) as is_purchasable,
       coalesce(bool_or(v.is_active and v.price is not null), false) as has_price,
       count(v.id) filter (where v.is_active) as variant_count
from public.products p
left join public.product_variants v on v.product_id = p.id
group by p.id;

-- ============================================================
-- 15. ROW LEVEL SECURITY
-- ============================================================
alter table public.product_variants     enable row level security;
alter table public.inventory            enable row level security;
alter table public.inventory_movements  enable row level security;
alter table public.customer_addresses   enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments             enable row level security;
alter table public.order_notes          enable row level security;
alter table public.cart_lines           enable row level security;
alter table public.coupons              enable row level security;
alter table public.gifting_enquiries    enable row level security;
alter table public.content_blocks       enable row level security;
alter table public.hero_slides          enable row level security;
alter table public.pages                enable row level security;
alter table public.faqs                 enable row level security;
alter table public.notification_outbox  enable row level security;

create policy "variants_public_select" on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_variants.product_id
                               and p.is_published and p.status in ('active', 'out_of_stock')));
create policy "variants_admin_all" on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "inventory_admin_all" on public.inventory for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "inventory_movements_admin_select" on public.inventory_movements for select to authenticated
  using (public.is_admin());

create policy "addresses_owner_all" on public.customer_addresses for all to authenticated
  using (customer_id = auth.uid() or public.is_admin()) with check (customer_id = auth.uid());

create policy "order_history_select" on public.order_status_history for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_status_history.order_id and o.customer_id = auth.uid()));

create policy "payments_select" on public.payments for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = payments.order_id and o.customer_id = auth.uid()));

create policy "cart_lines_owner_all" on public.cart_lines for all to authenticated
  using (exists (select 1 from public.cart c where c.id = cart_lines.cart_id and (c.customer_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.cart c where c.id = cart_lines.cart_id and c.customer_id = auth.uid()));

create policy "order_notes_admin_all" on public.order_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "coupons_admin_all" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "gifting_public_insert" on public.gifting_enquiries for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null);
create policy "gifting_admin_select" on public.gifting_enquiries for select to authenticated using (public.is_admin());
create policy "gifting_admin_update" on public.gifting_enquiries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "gifting_admin_delete" on public.gifting_enquiries for delete to authenticated using (public.is_admin());

create policy "content_blocks_public_select" on public.content_blocks for select to anon, authenticated using (true);
create policy "content_blocks_admin_write" on public.content_blocks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "hero_slides_public_select" on public.hero_slides for select to anon, authenticated using (is_active);
create policy "hero_slides_admin_write" on public.hero_slides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "pages_public_select" on public.pages for select to anon, authenticated using (is_published);
create policy "pages_admin_write" on public.pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "faqs_public_select" on public.faqs for select to anon, authenticated using (is_published);
create policy "faqs_admin_write" on public.faqs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "outbox_admin_select" on public.notification_outbox for select to authenticated using (public.is_admin());
create policy "outbox_admin_update" on public.notification_outbox for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Security fix: customers may no longer insert orders / order lines
-- directly (they could set their own prices). place_order() is the
-- only way in. ALTER POLICY so nothing is removed.
alter policy "orders_customer_insert" on public.orders with check (false);
alter policy "order_items_customer_insert" on public.order_items with check (false);

-- Public forms may only create 'new' rows (no status / notes injection).
alter policy "wholesale_public_insert" on public.wholesale_enquiries with check (pipeline_status = 'new' and admin_notes is null);
alter policy "contact_public_insert" on public.contact_messages with check (status = 'new' and is_read = false and admin_notes is null);

-- ============================================================
-- 16. GRANTS (production uses hardened default privileges:
--     anon = SELECT only, service_role = no table DML, functions not
--     executable unless granted). Grant exactly what is needed.
-- ============================================================
grant insert on public.wholesale_enquiries, public.contact_messages, public.gifting_enquiries to anon;
grant select on public.product_catalog to anon, authenticated;

grant execute on function public.quote_items(jsonb, text) to anon, authenticated;
grant execute on function public.cart_get(text) to authenticated;
grant execute on function public.cart_set_item(uuid, integer) to authenticated;
grant execute on function public.cart_add_item(uuid, integer) to authenticated;
grant execute on function public.cart_clear() to authenticated;
grant execute on function public.cart_merge(jsonb) to authenticated;
grant execute on function public.place_order(jsonb, jsonb, text, text, text, boolean) to authenticated;
grant execute on function public.cancel_my_order(uuid, text) to authenticated;
grant execute on function public.admin_set_stock(uuid, integer, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_update_order(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.payment_attach_gateway_order(uuid, text, numeric) to service_role;
grant execute on function public.payment_confirm(uuid, text, text, bigint, jsonb) to service_role;
grant execute on function public.payment_mark_failed(uuid, text, text) to service_role;
grant execute on function public.notifications_claim(integer) to service_role;
grant execute on function public.notifications_complete(uuid, text, text) to service_role;
-- Edge functions read orders/settings with the caller's own JWT, so no
-- table-level service_role grants are required.

-- Internal helpers are never callable from the API.
revoke execute on function public.get_setting(text) from public, anon, authenticated;
revoke execute on function public.enqueue_notification(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.my_active_cart() from public, anon;
grant execute on function public.my_active_cart() to authenticated;

-- ------------------------------------------------------------
-- 17. Remove the implicit PUBLIC execute right from every function
--     added here (Postgres grants it by default), then re-grant only
--     to the intended roles above. is_admin() keeps its existing
--     PUBLIC right because RLS policies call it for every role.
-- ------------------------------------------------------------
revoke execute on function
  public.get_setting(text),
  public.enqueue_notification(text, text, text, jsonb),
  public.quote_items(jsonb, text),
  public.my_active_cart(),
  public.cart_get(text),
  public.cart_set_item(uuid, integer),
  public.cart_add_item(uuid, integer),
  public.cart_clear(),
  public.cart_merge(jsonb),
  public.place_order(jsonb, jsonb, text, text, text, boolean),
  public.cancel_my_order(uuid, text),
  public.admin_set_stock(uuid, integer, text, text, integer, boolean),
  public.admin_update_order(uuid, text, text, text, text, text, text),
  public.payment_attach_gateway_order(uuid, text, numeric),
  public.payment_confirm(uuid, text, text, bigint, jsonb),
  public.payment_mark_failed(uuid, text, text),
  public.notifications_claim(integer),
  public.notifications_complete(uuid, text, text),
  public.trg_variant_inventory(),
  public.trg_inventory_sync(),
  public.order_status_to_legacy(text),
  public.trg_orders_lifecycle(),
  public.trg_orders_history(),
  public.trg_wholesale_pipeline_sync(),
  public.trg_notify_admin_enquiry(),
  public.trg_address_single_default()
from public, anon, authenticated, service_role;

grant execute on function public.quote_items(jsonb, text) to anon, authenticated;
grant execute on function public.my_active_cart() to authenticated;
grant execute on function public.cart_get(text) to authenticated;
grant execute on function public.cart_set_item(uuid, integer) to authenticated;
grant execute on function public.cart_add_item(uuid, integer) to authenticated;
grant execute on function public.cart_clear() to authenticated;
grant execute on function public.cart_merge(jsonb) to authenticated;
grant execute on function public.place_order(jsonb, jsonb, text, text, text, boolean) to authenticated;
grant execute on function public.cancel_my_order(uuid, text) to authenticated;
grant execute on function public.admin_set_stock(uuid, integer, text, text, integer, boolean) to authenticated;
grant execute on function public.admin_update_order(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.payment_attach_gateway_order(uuid, text, numeric) to service_role;
grant execute on function public.payment_confirm(uuid, text, text, bigint, jsonb) to service_role;
grant execute on function public.payment_mark_failed(uuid, text, text) to service_role;
grant execute on function public.notifications_claim(integer) to service_role;
grant execute on function public.notifications_complete(uuid, text, text) to service_role;

-- Production's hardened default for new tables gives anon SELECT only;
-- make that explicit for the new tables too (no anon writes except the
-- three public forms granted above).
revoke insert, update, delete on
  public.product_variants, public.inventory, public.inventory_movements, public.customer_addresses,
  public.cart_lines, public.order_status_history, public.order_notes, public.payments, public.coupons,
  public.content_blocks, public.hero_slides, public.pages, public.faqs, public.notification_outbox
from anon;
