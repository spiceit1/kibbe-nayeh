import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null

export const handler: Handler = async (event) => {
  if (!supabase) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase service key missing' }) }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { orderIds, adminEmail } = body as { orderIds?: string[]; adminEmail?: string }

    if (!adminEmail || !Array.isArray(orderIds) || orderIds.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'adminEmail and orderIds are required' }) }
    }

    // Verify admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .ilike('email', adminEmail)
      .maybeSingle()

    if (adminError) {
      return { statusCode: 400, body: JSON.stringify({ error: adminError.message }) }
    }
    if (!adminUser) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized: admin required' }) }
    }

    // Delete orders (cascade removes items/status history)
    const { data, error } = await supabase.from('orders').delete().in('id', orderIds).select('id')

    if (error) {
      return { statusCode: 400, body: JSON.stringify({ error: error.message }) }
    }

    return { statusCode: 200, body: JSON.stringify({ deleted: data?.map((d) => d.id) || [] }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) }
  }
}

