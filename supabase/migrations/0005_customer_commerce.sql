-- ============================================================
-- ARUMBU CASHEWS — CUSTOMER ACCOUNTS, FAVOURITES, CART, ORDERS
-- Migration: 0005_customer_commerce.sql
-- Run AFTER 0001-0004.
--
-- This adds the customer-facing half of the schema on top of the
-- existing 13-grade product catalogue and admin-side tables. It does
-- not touch `products` seed data — no grades are added, renamed, or
-- duplicated here. JK remains a single row (see 0001/0003).
-- ============================================================

-- ============================================================
-- 1. CUSTOMER PROFILES
-- One row per shopper, auto-created the moment they sign up through
-- Supabase Auth (public self-signup is fine for this table — it
-- grants no admin rights; admin rights only ever come from a row in
-- `public.profiles`, which nothing here writes to).
-- ============================================================
create table if not exists public.customer_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  email        text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_customer_profiles_updated_at
on public.customer_profiles;
create trigger trg_customer_profiles_updated_at
  before update on public.customer_profiles
  for each row execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;
drop policy if exists "customer_profiles_select_own"
on public.customer_profiles;
create policy "customer_profiles_select_own"
  on public.customer_profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "customer_profiles_update_own"
  on public.customer_profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Auto-create a customer_profiles row for every new Supabase Auth
-- user. Safe by design: this table carries zero authority — it never
-- grants admin access, it only lets a signed-in shopper have
-- favourites/cart/orders attached to their account.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer on auth.users;
create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function public.handle_new_customer();

-- ============================================================
-- 2. FAVOURITES / WISHLIST
-- ============================================================
create table if not exists public.favourites (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customer_profiles (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create unique index if not exists uniq_favourite_customer_product
  on public.favourites (customer_id, product_id);
create index if not exists idx_favourites_customer on public.favourites (customer_id);

alter table public.favourites enable row level security;

create policy "favourites_owner_all"
  on public.favourites for all
  to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- ============================================================
-- 3. CART + CART ITEMS
-- One active cart per customer. cart_items holds the line items;
-- adding the same product again updates its quantity rather than
-- creating a duplicate row (enforced by the unique index below —
-- application code should UPSERT on (cart_id, product_id)).
-- ============================================================
create table if not exists public.cart (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customer_profiles (id) on delete cascade,
  status       text not null default 'active'
                 check (status in ('active', 'converted', 'abandoned')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One ACTIVE cart per customer (a converted/abandoned cart doesn't
-- block a new active one from being created for their next visit).
create unique index if not exists uniq_active_cart_per_customer
  on public.cart (customer_id)
  where status = 'active';

create trigger trg_cart_updated_at
  before update on public.cart
  for each row execute function public.set_updated_at();

create table if not exists public.cart_items (
  id           uuid primary key default gen_random_uuid(),
  cart_id      uuid not null references public.cart (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  quantity     integer not null default 1 check (quantity > 0),
  unit         text not null default 'Kg',
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists uniq_cart_item_product
  on public.cart_items (cart_id, product_id);
create index if not exists idx_cart_items_cart on public.cart_items (cart_id);

create trigger trg_cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

alter table public.cart       enable row level security;
alter table public.cart_items enable row level security;

create policy "cart_owner_all"
  on public.cart for all
  to authenticated
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- cart_items has no customer_id column of its own — ownership is
-- checked by joining back to the parent cart.
create policy "cart_items_owner_all"
  on public.cart_items for all
  to authenticated
  using (
    exists (
      select 1 from public.cart c
      where c.id = cart_items.cart_id
        and (c.customer_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.cart c
      where c.id = cart_items.cart_id
        and (c.customer_id = auth.uid() or public.is_admin())
    )
  );

-- ============================================================
-- 4. ORDERS + ORDER ITEMS
-- Arumbu Cashews currently sells via WhatsApp/phone enquiry rather
-- than online payment — no payment/checkout fields exist here
-- because none were specified. An "order" is the record of a
-- customer submitting their cart as a request; the admin's Orders
-- module tracks and updates its status from there. rate_snapshot is
-- nullable and only ever populated by an admin action — a customer
-- placing an order never sees or sets a price.
-- ============================================================
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customer_profiles (id) on delete restrict,
  order_number      text not null unique,          -- e.g. generated as 'AC-2026-000123' by application code
  status            text not null default 'pending'
                      check (status in ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
  contact_phone     text,
  contact_whatsapp  text,
  delivery_address  text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_orders_customer on public.orders (customer_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created on public.orders (created_at desc);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  grade_name_snapshot text not null,                -- preserved even if the product is later renamed/deleted
  quantity            integer not null check (quantity > 0),
  unit                text not null default 'Kg',
  rate_snapshot       numeric(10, 2),                -- null unless an admin has priced this line item
  created_at          timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Customers can create their own orders and read their own order
-- history, but never edit/delete an order once placed — status
-- changes are an admin-only action from here on.
create policy "orders_customer_select"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid() or public.is_admin());

create policy "orders_customer_insert"
  on public.orders for insert
  to authenticated
  with check (customer_id = auth.uid());

create policy "orders_admin_update"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "orders_admin_delete"
  on public.orders for delete
  to authenticated
  using (public.is_admin());

create policy "order_items_select"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy "order_items_customer_insert"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = auth.uid()
    )
  );

create policy "order_items_admin_write"
  on public.order_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 5. PRODUCT SEARCH
-- Full-text search across grade name + descriptions, backing the
-- header search box against the real `products` table (no separate
-- search index/service).
-- ============================================================
alter table public.products
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(grade_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(full_description, '')), 'C')
  ) stored;

create index if not exists idx_products_search on public.products using gin (search_vector);
