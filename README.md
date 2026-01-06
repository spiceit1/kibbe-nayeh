# Kibbeh Nayeh — Single-product ecommerce

Production-ready storefront + admin portal for a single product, built with Vite + React + TypeScript, TailwindCSS (with shadcn-style primitives), Supabase, Netlify Functions, Stripe, Resend, and Twilio.

## Quick start
1) Install deps: `npm install`
2) Copy environment template: `cp .env.example .env` and fill values.
3) Set up Supabase: run `supabase db reset --file supabase/schema.sql --seed supabase/seed.sql` (or apply SQL manually in the Supabase SQL editor).
4) Start dev server: `npm run dev` (Netlify dev recommended for functions: `netlify dev`).
5) Admin login uses Supabase Auth magic links. Seed admin email: `admin@example.com` (edit in `supabase/seed.sql`).

## Architecture
- **Frontend**: Vite + React + TS, TailwindCSS, shadcn-inspired UI components in `src/components/ui`.
- **Data**: Supabase Postgres with RLS. Anonymous clients read active product data; writes occur via service-role in Netlify functions or authenticated admins.
- **Checkout**: Netlify function `create-checkout` validates pricing/stock against Supabase and creates a Stripe Checkout Session (card + Venmo when enabled in Stripe).
- **Webhook**: `stripe-webhook` records paid orders, decrements inventory, logs status history, and triggers Resend email + Twilio SMS.
- **Order status**: `order-status` returns order details by Stripe session id for the confirmation page.
- **Admin portal**: Supabase Auth (email magic link) gated; RLS allows writes only for whitelisted admins in `admin_users`.

## Netlify
- Build command: `npm run build`
- Publish: `dist`
- Functions dir: `netlify/functions`
- Recommended: `netlify dev` for local functions + Vite.

## Required environment
See `.env.example`.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Netlify functions only)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

## Supabase schema (key tables)
- `product_sizes`: name, unit_label, price_cents, available_qty, is_active.
- `settings`: pickup_discount_enabled/type/value, delivery_fee_cents, currency.
- `customers`, `orders`, `order_items`.
- `ingredients`, `size_ingredient_requirements`, `ingredient_stock`.
- `order_status_history`, `admin_users`.
- View `dedup_customers` for admin UI.

RLS highlights:
- Public read-only on active `product_sizes` and `settings`.
- Admin-only writes (checked via `is_admin()` helper referencing `admin_users`).
- Inserts for orders/customers via `service_role` only (Netlify functions).

## Stripe + Venmo
- Venmo is available in Stripe Checkout when enabled in your Stripe dashboard and domain allowlist. Payment method types are set to `card`, which surfaces Venmo automatically for eligible customers.
- Configure webhook endpoint in Stripe to your Netlify deploy URL: `https://<site>.netlify.app/.netlify/functions/stripe-webhook`.

## Notifications
- Email: Resend via `stripe-webhook` after successful payment.
- SMS: Twilio message on payment confirmation (optional; set env vars).
- Admin can add their email to `admin_users` to receive auth access; add an optional separate notification email in functions if desired.

## Seed data
- Sizes: 8oz, 16oz, 32oz with example pricing.
- Settings: 10% pickup discount, $8 delivery.
- Admin user: `admin@example.com`.
- Ingredients + example requirements for production planning.

## Running locally with Netlify
```bash
netlify dev --env-file .env
```
This proxies functions at `/.netlify/functions/*` and Vite at port 5173.

## Deployment
- Push to the `main` branch on GitHub. Netlify auto-builds with the config above.
- Add all environment variables in Netlify dashboard (Site settings → Environment variables).
- Add Stripe webhook signing secret after creating the webhook endpoint in Stripe.

## Testing checklist
- Create checkout with pickup + delivery to verify discount and fee logic.
- Confirm Stripe webhook inserts orders and decrements `product_sizes.available_qty`.
- Verify Resend email + Twilio SMS fire on payment success.
- Ensure admin login restricted to `admin_users`.
- Validate RLS by trying public writes (should be blocked).
