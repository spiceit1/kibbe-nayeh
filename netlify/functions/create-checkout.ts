import { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { CheckoutPayload } from '../../src/lib/types'
import { calculateOrderTotals } from '../../src/lib/pricing'

const stripeSecret = process.env.STRIPE_SECRET_KEY
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.SITE_URL || process.env.URL || 'http://localhost:8888'

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-11-20' }) : null
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export const handler: Handler = async (event) => {
  if (!stripe || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured.' }) }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const payload = JSON.parse(event.body || '{}') as CheckoutPayload
    const { data: size, error: sizeError } = await supabase
      .from('product_sizes')
      .select('*')
      .eq('id', payload.size_id)
      .eq('is_active', true)
      .maybeSingle()
    if (sizeError || !size) throw new Error('Size unavailable')

    const { data: settings } = await supabase.from('settings').select('*').limit(1).maybeSingle()
    const totals = calculateOrderTotals(size, settings, payload.fulfillment_method, payload.quantity)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      success_url: `${siteUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
      metadata: {
        size_id: size.id,
        size_name: size.name,
        quantity: String(payload.quantity),
        fulfillment_method: payload.fulfillment_method,
        pickup_discount_cents: String(totals.pickupDiscount),
        delivery_fee_cents: String(totals.deliveryFee),
        total_cents: String(totals.total),
        currency: settings?.currency ?? 'USD',
        customer_name: payload.customer.name,
        customer_email: payload.customer.email,
        customer_phone: payload.customer.phone,
        address: payload.customer.address || '',
        city: payload.customer.city || '',
        state: payload.customer.state || '',
        postal_code: payload.customer.postal_code || '',
        notes: payload.notes || '',
      },
      line_items: [
        {
          quantity: payload.quantity,
          price_data: {
            currency: settings?.currency ?? 'USD',
            product_data: {
              name: `${size.name} — Kibbeh Nayeh`,
              description: `${size.unit_label} • ${payload.fulfillment_method}`,
            },
            unit_amount: size.price_cents,
          },
        },
      ],
      shipping_options:
        payload.fulfillment_method === 'delivery'
          ? [
              {
                shipping_rate_data: {
                  display_name: 'Flat delivery',
                  type: 'fixed_amount',
                  fixed_amount: { amount: totals.deliveryFee, currency: settings?.currency ?? 'USD' },
                },
              },
            ]
          : [],
      discounts:
        payload.fulfillment_method === 'pickup' && totals.pickupDiscount > 0
          ? [
              {
                coupon: await ensurePickupCoupon(totals.pickupDiscount, settings?.currency ?? 'USD'),
              },
            ]
          : [],
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    }
  }
}

async function ensurePickupCoupon(amountOff: number, currency: string) {
  if (!stripe) throw new Error('Stripe missing')
  if (amountOff <= 0) throw new Error('Invalid discount')
  const coupons = await stripe.coupons.list({ limit: 100 })
  const existing = coupons.data.find((c) => c.amount_off === amountOff && c.currency === currency)
  if (existing) return existing.id
  const coupon = await stripe.coupons.create({ amount_off: amountOff, currency, name: 'Pickup discount' })
  return coupon.id
}

