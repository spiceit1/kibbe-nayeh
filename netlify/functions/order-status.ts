import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export const handler: Handler = async (event) => {
  if (!supabase) return { statusCode: 500, body: JSON.stringify({ error: 'Not configured' }) }
  const sessionId = event.queryStringParameters?.session_id
  if (!sessionId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id,status,fulfillment_method,total_cents,pickup_discount_cents,delivery_fee_cents')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  if (error || !order) return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) }

  const { data: settings } = await supabase.from('settings').select('currency').limit(1).maybeSingle()
  const { data: items } = await supabase
    .from('order_items')
    .select('size_name,quantity,price_cents')
    .eq('order_id', order.id)

  const response = {
    id: order.id,
    status: order.status,
    fulfillment_method: order.fulfillment_method,
    total_cents: order.total_cents,
    pickup_discount_cents: order.pickup_discount_cents,
    delivery_fee_cents: order.delivery_fee_cents,
    currency: settings?.currency || 'USD',
    items: (items || []).map((item: any) => ({
      name: item.size_name,
      quantity: item.quantity,
      price_cents: item.price_cents,
    })),
  }

  return { statusCode: 200, body: JSON.stringify({ order: response }) }
}

