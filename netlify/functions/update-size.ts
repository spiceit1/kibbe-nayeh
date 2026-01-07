import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null

export const handler: Handler = async (event) => {
  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase service key missing' }),
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { id, updates } = body as { id?: string; updates?: Record<string, unknown> }

    if (!id || !updates || typeof updates !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payload' }) }
    }

    // Allowlist fields
    const allowed: Record<string, unknown> = {}
    const fields = ['name', 'price_cents', 'available_qty', 'is_active', 'unit_label', 'sort_order']
    for (const key of fields) {
      if (key in updates) allowed[key] = (updates as any)[key]
    }

    if (Object.keys(allowed).length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No valid fields to update' }) }
    }

    const { data, error } = await supabase
      .from('product_sizes')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      return { statusCode: 400, body: JSON.stringify({ error: error.message }) }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ size: data }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: (err as Error).message }) }
  }
}

