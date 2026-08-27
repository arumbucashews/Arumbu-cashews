# Arumbu Cashews — Supabase Setup Guide

This document covers everything needed to stand up the real backend for
the Arumbu Cashews Admin CMS: creating the Supabase project, running the
schema, configuring Storage, creating the first admin login, and how the
public website and Admin panel are meant to connect to it.

**What this guide does NOT cover:** actually building the Admin CMS
application (the React/Next.js/etc. app that calls this backend) or
rewriting the public HTML pages to fetch from Supabase instead of being
static. Those are application-code phases (Phases 3–12 from the project
plan) and need a real dev environment with network access — this repo's
`/supabase/migrations` folder is the foundation those phases build on.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an
   account).
2. Click **New Project**.
3. Choose your organization, give it a name (e.g. `arumbu-cashews`),
   set a strong database password, and pick a region close to your
   users (e.g. `ap-south-1` / Mumbai for an India-based audience).
4. Wait for the project to finish provisioning (a couple of minutes).

---

## 2. Run the SQL migrations

Run the five files in `/supabase/migrations/` **in order** — each one
depends on the previous:

| Order | File | What it does |
|---|---|---|
| 1 | `0001_init_schema.sql` | Creates every table, index, and `updated_at` trigger. |
| 2 | `0002_rls_policies.sql` | Enables Row Level Security and adds every read/write policy, plus the `is_admin()` helper. Admin `profiles` rows are provisioned manually (see Section 4) — there is no auto-admin trigger. |
| 3 | `0003_seed_data.sql` | Seeds the 13 product/grade rows, blank rate cards, default site settings, social link rows, hero settings, and About page content. |
| 4 | `0004_storage_buckets.sql` | Creates the `product-images` and `media` storage buckets and their access policies. |
| 5 | `0005_customer_commerce.sql` | Adds the customer-facing schema: `customer_profiles` (auto-created on signup), `favourites`, `cart` + `cart_items`, `orders` + `order_items`, and full-text search on `products`. |

### Option A — Supabase Dashboard (simplest)

1. Open your project → **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `0001_init_schema.sql` from this repo, copy its full contents,
   paste into the editor, and click **Run**.
4. Repeat for `0002_rls_policies.sql`, `0003_seed_data.sql`,
   `0004_storage_buckets.sql`, and `0005_customer_commerce.sql`, in
   that order, each as its own query.
5. Check **Table Editor** afterwards — you should see 18 tables
   (`profiles`, `products`, `product_images`, `rate_cards`,
   `rate_card_history`, `wholesale_enquiries`, `contact_messages`,
   `site_settings`, `social_links`, `media`, `hero_settings`,
   `about_content`, `customer_profiles`, `favourites`, `cart`,
   `cart_items`, `orders`, `order_items`), with `products`
   containing exactly **13 rows**, in order, one per grade —
   `grade_name` is enforced unique, so the Admin CMS can add new
   grades later but can never create a duplicate of an existing one
   (JK included — it appears once, at position 13).

### Option B — Supabase CLI

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed and linked to this project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies every file in `/supabase/migrations/` in filename order.

---

## 3. Verify Storage buckets

`0004_storage_buckets.sql` creates these automatically, but to confirm:

1. Go to **Storage** in the left sidebar.
2. You should see two buckets:
   - **product-images** — public, 10 MB file limit, images only
     (jpeg/png/webp).
   - **media** — public, 200 MB file limit (covers the hero video),
     images + `video/mp4` + `image/x-icon` (favicon) +
     `image/svg+xml`.
3. Both are marked **Public** for reads — anyone can view a file at
   its URL, same as any static image on a website. Only an
   authenticated admin can upload, replace, or delete files (enforced
   by the storage policies in that same migration).

You do not need to create folders manually — the Admin app will write
to paths like `product-images/<product_id>/<filename>` and
`media/hero_video/<filename>` when you build the upload flow.

---

## 4. Create your first admin user

Admin access is **not** automatic. Row Level Security grants admin
rights only to rows in `public.profiles` where `role = 'admin'`, and
nothing in this schema auto-creates that row — that's deliberate. Once
`0005_customer_commerce.sql` is applied, real customers can also sign
up through the same Supabase Auth system (see Section 6), so an
auto-admin trigger would have quietly made every customer an admin.
Instead, an admin `profiles` row is only ever created by another
admin, by hand:

1. Go to **Authentication → Users** in the dashboard.
2. Click **Add user → Create new user**.
3. Enter your email and a password. Leave "Auto Confirm User" checked
   so you can log in immediately without an email confirmation step.
4. Click **Create user** — copy the new user's UUID from the users
   list (click into the user if it's not shown directly).
5. Go to **SQL Editor** and run:
   ```sql
   insert into public.profiles (id, email, full_name, role)
   values ('<paste-the-uuid-here>', 'you@example.com', 'Your Name', 'admin');
   ```
6. Go to **Table Editor → profiles** and confirm the row exists with
   `role = 'admin'`.

If you want a second admin/editor later, repeat steps 1–5 and use
`'editor'` instead of `'admin'` in the insert if they should have
lighter access (the schema treats both roles as `is_admin() = true`
today — split their permissions further in the Admin app's RLS if you
need `'editor'` to mean something more limited later).

**Public sign-up should stay ENABLED** — customers need it to create
their own accounts (Section 6). This is safe specifically because the
signup trigger only ever writes to `customer_profiles`, a table with
no admin authority at all. Just make sure the Admin app's login screen
only ever calls `supabase.auth.signInWithPassword()`, never `signUp()`
— so there's no path from the Admin UI itself that creates new
accounts of any kind.

---

## 5. Environment variables

The Admin app and the (eventually dynamic) public site both need:

```bash
# .env.example — copy to .env.local (or your framework's equivalent)
# and fill in real values. NEVER commit the filled-in .env file.

SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-public-key>
```

Both values are on your project's **Settings → API** page.

- `SUPABASE_ANON_KEY` is safe to ship in frontend code — it's the key
  RLS is designed to be used with. It can only do what the policies in
  `0002_rls_policies.sql` / `0004_storage_buckets.sql` allow.
- **Never** put the `service_role` key in any frontend code, `.env`
  file that ships to the browser, or this repo. It bypasses RLS
  entirely. If a serverless function ever needs it (e.g. a scheduled
  job), keep it in that platform's server-side secret store only.

---

## 6. How the Admin CMS connects to the public website

Both the public site and the Admin app talk to the **same** Supabase
project, using the **same** `SUPABASE_URL`, but they behave differently
because of RLS and which key/session they use:

```
                     ┌─────────────────────┐
                     │   Supabase Project    │
                     │  (Postgres + Auth +   │
                     │      Storage)         │
                     └──────────┬───────────┘
                                │
                RLS policies decide what each caller can do
                                │
            ┌───────────────────┴───────────────────┐
            │                                        │
   anon key, no login                     anon key + logged-in session
            │                                        │
┌───────────▼───────────┐              ┌─────────────▼─────────────┐
│   PUBLIC WEBSITE        │              │        ADMIN APP           │
│  reads: products,       │              │  reads/writes: everything  │
│  product_images,        │              │  is_admin() = true unlocks │
│  site_settings,         │              │  full CRUD on every table  │
│  social_links,          │              │  + Storage uploads         │
│  hero_settings,         │              │                             │
│  about_content          │              │  Auth: supabase.auth       │
│  writes: INSERT-only    │              │  .signInWithPassword()     │
│  on wholesale_enquiries │              │                             │
│  and contact_messages   │              │                             │
│  (the enquiry forms)    │              │                             │
└─────────────────────────┘              └─────────────────────────────┘
```

Practically:

- The Admin app calls `supabase.auth.signInWithPassword({ email, password })`
  on its login screen. Once signed in, every subsequent request from
  that browser session carries the user's JWT, which `is_admin()`
  checks against `profiles.role`.
- The public site's Supabase client is initialized with just the
  `anon` key and never signs in — it only ever hits the "public"
  policies (published products, visible social links, the active hero
  row, visible About sections, and settings).
- When an admin edits a product's image, price, or the hero video in
  the Admin app, that write lands directly in Postgres/Storage. The
  next time the public site loads that data (on page load, or via a
  realtime subscription if you add one later), it reads the updated
  row — no manual export, no ZIP, no redeploying the site's content.
- The **rate card** is the one table with no public policy at all
  (see `0002_rls_policies.sql`) — only signed-in admins can read it,
  matching the requirement that prices never appear on public product
  cards by default.

---

---

## 7. Customer accounts, favourites, cart & orders

`0005_customer_commerce.sql` adds the shopper-facing half of the
schema — this is what the Sign Up / Log In, favourites, cart, and
order history features in the brief are built on:

- **`customer_profiles`** — one row per shopper, created automatically
  the moment someone signs up via `supabase.auth.signUp()`. Unlike
  admin `profiles`, this happens with no manual step and grants no
  special access — it just lets a signed-in customer have their own
  favourites/cart/orders.
- **`favourites`** — a customer/product pair. RLS lets a customer only
  ever see or modify their own rows.
- **`cart` + `cart_items`** — one active cart per customer (enforced
  by a partial unique index on `cart(customer_id) where status =
  'active'`), with quantity per line item. Adding a product that's
  already in the cart should be an upsert on `(cart_id, product_id)`
  from the application, not a new row.
- **`orders` + `order_items`** — Arumbu Cashews currently works via
  WhatsApp/phone enquiry, not online payment, so there's no
  payment/checkout data here by design. Placing an order records what
  was requested; `order_items.rate_snapshot` stays `null` unless an
  admin later prices that line — a customer never sets or sees a
  price when ordering. Customers can insert and read their own
  orders; only an admin can change `status` (`pending` → `confirmed` →
  `processing` → `completed`/`cancelled`).
- **Product search** — `products.search_vector` is a generated,
  indexed `tsvector` over grade name and both description fields, so
  the header search box can query Postgres full-text search directly
  (`... where search_vector @@ websearch_to_tsquery('english', $1)`)
  instead of a separate search index.

None of this alters the 13-row product seed from `0003_seed_data.sql`
— it only adds new tables that reference `products.id`.

---

## What's next

This migration set gives you a real, production-shaped Postgres schema
with RLS already enforced — you can literally run it today and start
inserting/editing data through the Supabase dashboard's Table Editor
before a single line of the Admin app exists.

The next phases (building the actual Admin CMS UI and switching the
public HTML pages to fetch from these tables instead of being static)
need a real application build — that's a job for **Claude Code**, where
the project can actually install dependencies, run against this live
Supabase project, and be tested end-to-end as it's built.
