import { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { Resend } from 'resend'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'
import { calculateOrderTotals } from '../../src/lib/pricing'

export const config = {
  bodyParser: false,
}

const stripeSecret = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const twilioSid = process.env.TWILIO_ACCOUNT_SID
const twilioAuth = process.env.TWILIO_AUTH_TOKEN
const twilioFrom = process.env.TWILIO_FROM_NUMBER

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-11-20' }) : null
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null
const resend = resendKey ? new Resend(resendKey) : null
const sms = twilioSid && twilioAuth ? twilio(twilioSid, twilioAuth) : null

export const handler: Handler = async (event) => {
  if (!stripe || !supabase || !webhookSecret) {
    return { statusCode: 500, body: 'Not configured' }
  }
  const signature = event.headers['stripe-signature'] || ''
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || ''

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    return { statusCode: 400, body: `Webhook error: ${(err as Error).message}` }
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const metadata = session.metadata || {}
    const { data: size } = await supabase.from('product_sizes').select('*').eq('id', metadata.size_id).maybeSingle()
    const { data: settings } = await supabase.from('settings').select('*').limit(1).maybeSingle()
    const totals = calculateOrderTotals(
      size || undefined,
      settings,
      (metadata.fulfillment_method as 'delivery' | 'pickup') || 'delivery',
      Number(metadata.quantity || 1),
    )

    const { data: customer } = await supabase
      .from('customers')
      .upsert(
        {
          name: metadata.customer_name,
          email: metadata.customer_email,
          phone: metadata.customer_phone,
        },
        { onConflict: 'email' },
      )
      .select()
      .maybeSingle()

    const { data: order } = await supabase
      .from('orders')
      .upsert(
        {
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          payment_status: 'paid',
          customer_id: customer?.id,
          fulfillment_method: (metadata.fulfillment_method as 'delivery' | 'pickup') || 'delivery',
          status: 'Outstanding',
          subtotal_cents: totals.base,
          pickup_discount_cents: totals.pickupDiscount,
          delivery_fee_cents: totals.deliveryFee,
          total_cents: totals.total,
          notes: metadata.notes,
          delivery_address:
            metadata.fulfillment_method === 'delivery'
              ? {
                  address: metadata.address,
                  city: metadata.city,
                  state: metadata.state,
                  postal_code: metadata.postal_code,
                }
              : null,
        },
        { onConflict: 'stripe_session_id' },
      )
      .select()
      .maybeSingle()

    await supabase.from('order_items').upsert({
      order_id: order?.id,
      size_id: metadata.size_id,
      size_name: metadata.size_name,
      unit_label: size?.unit_label,
      quantity: Number(metadata.quantity || 1),
      price_cents: size?.price_cents || 0,
    })

    if (size) {
      await supabase
        .from('product_sizes')
        .update({ available_qty: Math.max(0, size.available_qty - Number(metadata.quantity || 1)) })
        .eq('id', size.id)
    }

    if (order) {
      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'Outstanding',
        note: 'Payment confirmed via Stripe',
      })
    }

    // Notifications
    if (resend && metadata.customer_email) {
      console.log('Sending Stripe order confirmation email to:', metadata.customer_email)
      const emailResult = await resend.emails.send({
        from: 'Kibbeh Nayeh <orders@notifications.anemoneking.com>',
        to: metadata.customer_email,
        subject: 'Your Kibbeh Nayeh order is confirmed',
        html: `<p>Thank you, ${metadata.customer_name}.</p>
          <p>Order: ${metadata.size_name} x ${metadata.quantity} — ${metadata.fulfillment_method}</p>
          <p>Total: ${(totals.total / 100).toFixed(2)} ${settings?.currency || 'USD'}</p>`,
      })
      
      console.log('Stripe order confirmation email result:', emailResult)
      if (emailResult.error) {
        console.error('Resend API error for Stripe order confirmation:', emailResult.error)
      } else {
        console.log('Stripe order confirmation email sent successfully, ID:', emailResult.data?.id)
      }
    }
    if (sms && twilioFrom && metadata.customer_phone) {
      await sms.messages.create({
        from: twilioFrom,
        to: metadata.customer_phone,
        body: `Kibbeh Nayeh order confirmed. ${metadata.size_name} x${metadata.quantity}. Status: Outstanding.`,
      })
    }
  }

  return { statusCode: 200, body: 'ok' }
}

