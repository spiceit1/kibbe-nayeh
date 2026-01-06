import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import type { CheckoutPayload } from '../../src/lib/types'
import { calculateOrderTotals } from '../../src/lib/pricing'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.SITE_URL || process.env.URL || 'http://localhost:8888'

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export const handler: Handler = async (event) => {
  if (!supabase) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured.' }) }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const payload = JSON.parse(event.body || '{}') as CheckoutPayload
    
    // Validate size availability
    const { data: size, error: sizeError } = await supabase
      .from('product_sizes')
      .select('*')
      .eq('id', payload.size_id)
      .eq('is_active', true)
      .maybeSingle()
    if (sizeError || !size) throw new Error('Size unavailable')
    if (size.available_qty < payload.quantity) throw new Error('Insufficient quantity available')

    // Get settings
    const { data: settings } = await supabase.from('settings').select('*').limit(1).maybeSingle()
    if (!settings?.venmo_address) throw new Error('Venmo address not configured')
    
    const totals = calculateOrderTotals(size, settings, payload.fulfillment_method, payload.quantity)

    // Find or create customer
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', payload.customer.email)
      .eq('phone', payload.customer.phone)
      .maybeSingle()

    let customerId: string | null = null
    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone,
        })
        .select('id')
        .single()
      if (customerError) throw new Error('Failed to create customer')
      customerId = newCustomer.id
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        fulfillment_method: payload.fulfillment_method,
        status: 'Outstanding',
        subtotal_cents: totals.base,
        pickup_discount_cents: totals.pickupDiscount,
        delivery_fee_cents: totals.deliveryFee,
        total_cents: totals.total,
        payment_status: 'pending',
        notes: payload.notes || null,
        delivery_address:
          payload.fulfillment_method === 'delivery'
            ? {
                address: payload.customer.address,
                city: payload.customer.city,
                state: payload.customer.state,
                postal_code: payload.customer.postal_code,
              }
            : null,
      })
      .select('id')
      .single()

    if (orderError || !order) throw new Error('Failed to create order')

    // Create order items
    const { error: itemsError } = await supabase.from('order_items').insert({
      order_id: order.id,
      size_id: size.id,
      size_name: size.name,
      unit_label: size.unit_label,
      quantity: payload.quantity,
      price_cents: size.price_cents,
    })

    if (itemsError) throw new Error('Failed to create order items')

    // Create status history
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'Outstanding',
      note: 'Order created, awaiting Venmo payment',
    })

    // Decrement available quantity
    await supabase
      .from('product_sizes')
      .update({ available_qty: Math.max(0, size.available_qty - payload.quantity) })
      .eq('id', size.id)

    // Return order details with Venmo info
    return {
      statusCode: 200,
      body: JSON.stringify({
        order_id: order.id,
        total_cents: totals.total,
        currency: settings.currency || 'USD',
        venmo_address: settings.venmo_address,
        order_number: order.id.slice(0, 8).toUpperCase(),
      }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    }
  }
}

