# Arumbu Cashews — Commerce platform: go-live checklist

This is the step-by-step list for moving the commerce platform (shop,
cart, checkout, accounts, admin orders/stock/CMS) from the **test**
Supabase project to **production**. Nothing here has been applied to
production yet.

Projects:

| Purpose | Supabase project | Used by |
|---|---|---|
| Production | `hnuvzzefwxizhvehwoxa` | `arumbucashews.com` (see `js/supabase-public.js`) |
| Test | `lganzdpqftozoaqfqlmo` | every other host — localhost, `*.pages.dev` previews |

The site picks the project by hostname, so a preview deployment always
talks to the test project and the live domain always talks to
production.

> Do not deploy this code to `arumbucashews.com` before step 1 is done.
> Without the new tables the live site falls back to its static content
> and WhatsApp ordering (it does not break), but cart, accounts and
> checkout will not work.

---

## 1. Database (production)

Take a backup first (Dashboard → Database → Backups). Then run, in
order, in the SQL editor:

| File | What it does |
|---|---|
| `supabase/migrations/0006_commerce_platform.sql` | Additive only. Pack sizes + prices, inventory + history, addresses, cart lines, order lifecycle/snapshots/payments, coupons, gifting enquiries, CMS tables (content blocks, hero slides, pages, FAQs), notification queue, RLS, functions, grants. No table is dropped or renamed; two existing order-insert policies are tightened so orders can only be created by `place_order()`. |
| `supabase/migrations/0007_seed_catalogue_and_content.sql` | Data only, idempotent. Adds 250 g / 500 g / 1 kg packs (no prices, stock 0), store settings keys (all blank/off), hero slides, homepage text blocks, policy page titles. |
| `supabase/migrations/0008_favourites_unique.sql` | One wishlist row per customer + product (skips itself if duplicates exist). |
| `supabase/migrations/0009_payment_confirm_guard.sql` | A Razorpay payment id can settle only one order (defence in depth). |
| `supabase/migrations/0010_founder_name_consistency.sql` | Data only. Corrects the founder name in the admin-editable About “people” text to “Sivakumar L” (only if the old “Shivakumar” spelling is still there). |
| `supabase/migrations/0011_hide_admin_notification_email.sql` | Security hardening. Keeps `notify_admin_email` available to admins and internal database functions but excludes that internal recipient from public `site_settings` reads. |
| `supabase/migrations/0012_tamil_cashew_terminology.sql` | Data only. Corrects the Tamil brand name in admin-editable text to “அரும்பு முந்திரி” (only rows that still use the old word). |

Afterwards run the Security Advisor (Dashboard → Advisors) and confirm
there are no new warnings.

## 2. Edge Functions (production)

Deploy from `supabase/functions/`:

| Function | JWT verification |
|---|---|
| `razorpay-create-order` | on |
| `razorpay-verify` | on |
| `razorpay-webhook` | **off** (Razorpay signs the request instead) |
| `notify` | on |

Set these secrets (Dashboard → Edge Functions → Secrets). Never put them
in the website files or in Admin → Store Settings:

| Secret | Where it comes from |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you type when creating the webhook |
| `RESEND_API_KEY` | resend.com (or skip — emails stay queued) |
| `NOTIFY_FROM_EMAIL` | a sender on a domain verified in Resend, e.g. `orders@arumbucashews.com` |
| `ALLOWED_ORIGINS` | `https://arumbucashews.com,https://www.arumbucashews.com` |

`RAZORPAY_API_BASE` and `RESEND_API_BASE` exist only for local testing
and must not be set in production.

## 3. Razorpay

1. Complete KYC / activate the account.
2. Webhooks → add `https://hnuvzzefwxizhvehwoxa.supabase.co/functions/v1/razorpay-webhook`,
   events `order.paid` and `payment.failed`, with the webhook secret above.
3. Test with test-mode keys first (Store Settings → Key ID `rzp_test_…`),
   then switch both the secret pair and the Key ID to live keys.

## 4. Supabase Auth

* Authentication → URL configuration: Site URL `https://arumbucashews.com`;
  redirect URLs `https://arumbucashews.com/account.html`,
  `https://arumbucashews.com/reset-password.html` (and the `www.` variants).
* Email templates: confirm-signup and reset-password (customise the
  wording/branding).
* Configure custom SMTP for auth emails (the built-in sender is
  rate-limited and not meant for production).

## 5. Admin → Store Settings (after deploy)

Enter real values — nothing is pre-filled:

* Pack prices and stock (Admin → Pricing & Stock). Packs without a price
  show “Price on request” and can only be ordered on WhatsApp.
* Delivery fee / free-delivery threshold.
* GST on/off, rate, inclusive/exclusive, GSTIN, invoice name/address.
* Razorpay Key ID + “Accept online payments”.
* Admin notification email; GA4 Measurement ID (optional).
* Policy pages and FAQ text (Admin → Website Text & Pages) — have the
  policies reviewed before publishing.

## 6. Cloudflare Pages

`_redirects` maps `/products/<slug>` to the product page and `_headers`
adds security headers; both are picked up automatically. Submit
`https://arumbucashews.com/sitemap.xml` in Google Search Console.

## 7. Smoke test on production

Place one real low-value order with test-mode Razorpay keys, walk it
through confirmed → shipped → delivered in Admin → Orders, print the
invoice, then cancel/refund it and check stock was returned.
