# Kibbeh Nayeh

<!-- Trigger redeploy --> — Single-product ecommerce

Production-ready storefront + admin portal for a single product, built with Vite + React + TypeScript, TailwindCSS (with shadcn-style primitives), Supabase, Netlify Functions, Resend, and Twilio.

## Quick start
1) Install deps: `npm install`
2) Copy environment template: `cp .env.example .env` and fill values.
3) Set up Supabase: run `supabase db reset --file supabase/schema.sql --seed supabase/seed.sql` (or apply SQL manually in the Supabase SQL editor).
4) Start dev server: `npm run dev` (Netlify dev recommended for functions: `netlify dev`).
5) Admin login uses Supabase Auth magic links. Seed admin email: `admin@example.com` (edit in `supabase/seed.sql`).

## Architecture
- **Frontend**: Vite + React + TS, TailwindCSS, shadcn-inspired UI components in `src/components/ui`.
- **Data**: Supabase Postgres with RLS. Anonymous clients read active product data; writes occur via service-role in Netlify functions or authenticated admins.
- **Checkout**: Netlify function `create-venmo-order` validates pricing/stock against Supabase and creates orders for Venmo payment.
- **Order confirmation**: Orders are created immediately and customers receive payment instructions via email.
- **Order status**: `order-status` returns order details by order id for the confirmation page.
- **Admin portal**: Password-based authentication; RLS allows writes only for whitelisted admins in `admin_users`.

## Netlify
- Build command: `npm run build`
- Publish: `dist`
- Functions dir: `netlify/functions`
- Recommended: `netlify dev` for local functions + Vite.

## Required environment
See `.env.example`.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Netlify functions only)
- `SITE_URL`
- `RESEND_API_KEY` (for email notifications)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (optional, for SMS)

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

## Payment
- Orders are created via `create-venmo-order` function and customers pay via Venmo.
- Venmo address is configured in admin settings.
- Customers receive payment instructions via email after placing an order.

## Notifications
- Email: Resend sends order confirmation emails via `create-venmo-order` after order creation.
- SMS: Optional Twilio message via email-to-SMS gateways (carrier-dependent).
- Admin password reset emails are sent via `send-temp-password-email` function.

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
- Set up Resend account and add `RESEND_API_KEY` to Netlify environment variables.
- Configure custom domain in Resend for better email deliverability.

## Testing checklist
- Create order with pickup + delivery to verify discount and fee logic.
- Confirm orders are created and `product_sizes.available_qty` is decremented.
- Verify Resend email is sent after order creation.
- Test admin password reset flow.
- Ensure admin login restricted to `admin_users`.
- Validate RLS by trying public writes (should be blocked).
