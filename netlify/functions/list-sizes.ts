import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null

export const handler: Handler = async () => {
  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase service key missing' }),
    }
  }

  const { data, error } = await supabase.from('product_sizes').select('*').order('sort_order', { ascending: true })

  if (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sizes: data }),
  }
}

