import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import { formatCurrency } from '../lib/pricing'
import type { OrderStatus, ProductSize, Settings } from '../lib/types'
import { CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type OrderRow = {
  id: string
  status: OrderStatus
  total_cents: number
  fulfillment_method: 'delivery' | 'pickup'
  created_at: string
  payment_status: string
  delivery_fee_cents: number
  pickup_discount_cents: number
}

type CustomerRow = {
  id: string
  name: string
  email: string
  phone: string | null
  total_spend?: number
  last_order_date?: string
}

type IngredientRow = {
  id: string
  name: string
  unit: string
  on_hand?: number
  requirements?: number
}

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sizes, setSizes] = useState<ProductSize[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return
    const init = async () => {
      const { data } = await client.auth.getSession()
      if (data.session) {
        setSessionReady(true)
        fetchDashboard()
      }
      client.auth.onAuthStateChange((event, currentSession) => {
        if (currentSession) {
          setSessionReady(true)
          fetchDashboard()
        } else if (event === 'SIGNED_OUT') {
          setSessionReady(false)
        }
      })
    }
    init()
  }, [])

  const fetchDashboard = async () => {
    const client = supabase
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const [sizeRes, settingsRes, orderRes, customerRes, ingredientRes] = await Promise.all([
        client.from('product_sizes').select('*').order('sort_order'),
        client.from('settings').select('*').limit(1).maybeSingle(),
        client
          .from('orders')
          .select('id,status,total_cents,fulfillment_method,created_at,payment_status,delivery_fee_cents,pickup_discount_cents')
          .order('created_at', { ascending: false })
          .limit(50),
        client.rpc('dedup_customers'),
        client.from('ingredients').select('*').order('name'),
      ])
      if (sizeRes.error) throw sizeRes.error
      if (settingsRes.error) throw settingsRes.error
      if (orderRes.error) throw orderRes.error
      if (customerRes.error) throw customerRes.error
      if (ingredientRes.error) throw ingredientRes.error
      setSizes(sizeRes.data || [])
      setSettings(settingsRes.data as Settings)
      setOrders(orderRes.data as OrderRow[])
      setCustomers(customerRes.data as CustomerRow[])
      setIngredients(ingredientRes.data as IngredientRow[])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const client = supabase
    if (!client) {
      setError('Supabase is not configured.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error: signInError } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      })
      if (signInError) throw signInError
      setStatusMsg('Magic link sent. Check your inbox to finish login (admin emails only).')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const updateSize = async (id: string, updates: Partial<ProductSize>) => {
    const client = supabase
    if (!client) return
    const { error: updateError } = await client.from('product_sizes').update(updates).eq('id', id)
    if (updateError) {
      setError(updateError.message)
    } else {
      setStatusMsg('Size updated')
      fetchDashboard()
    }
  }

  const updateSettings = async (updates: Partial<Settings>) => {
    const client = supabase
    if (!client || !settings) return
    const { error: updateError } = await client.from('settings').update(updates).eq('id', settings.id)
    if (updateError) setError(updateError.message)
    else {
      setStatusMsg('Settings saved')
      fetchDashboard()
    }
  }

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const client = supabase
    if (!client) return
    const { error: updateError } = await client.from('orders').update({ status }).eq('id', orderId)
    if (updateError) setError(updateError.message)
    else fetchDashboard()
  }

  const outstandingOrders = orders.filter((o) => o.status === 'Outstanding')
  const metrics = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + o.total_cents, 0)
    const avg = orders.length ? revenue / orders.length : 0
    const pickupCount = orders.filter((o) => o.fulfillment_method === 'pickup').length
    const deliveryCount = orders.filter((o) => o.fulfillment_method === 'delivery').length
    return { revenue, avg, pickupCount, deliveryCount }
  }, [orders])

  const chartData = useMemo(() => {
    const byDay: Record<string, { date: string; revenue: number; orders: number }> = {}
    orders.forEach((o) => {
      const day = o.created_at?.slice(0, 10)
      if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0 }
      byDay[day].revenue += o.total_cents / 100
      byDay[day].orders += 1
    })
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
  }, [orders])

  const sizeBreakdown = sizes.map((s) => ({
    name: s.name,
    value: orders.filter((o) => o.status !== 'Canceled').length ? s.available_qty : s.available_qty,
  }))

  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-3xl text-midnight">Admin</h1>
        <p className="text-midnight/80">Add Supabase environment variables to enable the admin portal.</p>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <h1 className="font-display text-3xl text-midnight">Admin login</h1>
          <p className="text-midnight/80">Only whitelisted admin emails can sign in.</p>
        </div>
        <div className="space-y-3">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kibbehnayeh.com" />
          <Button onClick={handleLogin} disabled={loading || !email}>
            {loading ? 'Sending link...' : 'Send magic link'}
          </Button>
          {statusMsg && <p className="text-sm text-olive">{statusMsg}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-pomegranate">Admin portal</p>
          <h1 className="font-display text-3xl text-midnight">Dashboard</h1>
        </div>
        <Button variant="outline" onClick={() => supabase?.auth.signOut()}>Sign out</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {statusMsg && <div className="rounded-lg border border-olive/30 bg-olive/10 px-3 py-2 text-sm text-olive">{statusMsg}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-midnight/60">Revenue (all time)</p>
            <p className="text-2xl font-semibold">{formatCurrency(metrics.revenue, settings?.currency || 'USD')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-midnight/60">Avg order value</p>
            <p className="text-2xl font-semibold">{formatCurrency(metrics.avg, settings?.currency || 'USD')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-midnight/60">Pickup</p>
            <p className="text-2xl font-semibold">{metrics.pickupCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-midnight/60">Delivery</p>
            <p className="text-2xl font-semibold">{metrics.deliveryCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Orders</CardTitle>
            <CardDescription>Trended totals</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#c1440e" name="Revenue (USD)" />
                <Line type="monotone" dataKey="orders" stroke="#4a5f2a" name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Size mix</CardTitle>
            <CardDescription>Distribution of active sizes</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sizeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} fill="#c1440e" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product & Inventory</CardTitle>
          <CardDescription>Update sizes, pricing, availability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sizes.map((size) => (
            <div key={size.id} className="grid gap-3 rounded-lg border border-neutral-200 p-4 md:grid-cols-5 md:items-end">
              <div className="space-y-2 md:col-span-2">
                <Label>Name</Label>
                <Input value={size.name} onChange={(e) => updateSize(size.id, { name: e.target.value })} />
                <p className="text-xs text-midnight/60">{size.unit_label}</p>
              </div>
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input
                  type="number"
                  value={size.price_cents}
                  onChange={(e) => updateSize(size.id, { price_cents: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Available qty</Label>
                <Input
                  type="number"
                  value={size.available_qty}
                  onChange={(e) => updateSize(size.id, { available_qty: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <Switch
                  checked={size.is_active}
                  onChange={(e) => updateSize(size.id, { is_active: e.target.checked })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Pickup & Delivery Settings</CardTitle>
            <CardDescription>Configure fees and discounts</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Delivery fee (cents)</Label>
              <Input
                type="number"
                value={settings.delivery_fee_cents}
                onChange={(e) => updateSettings({ delivery_fee_cents: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pickup discount type</Label>
              <Select
                value={settings.pickup_discount_type}
                onChange={(e) => updateSettings({ pickup_discount_type: e.target.value as Settings['pickup_discount_type'] })}
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pickup discount value</Label>
              <Input
                type="number"
                value={settings.pickup_discount_value}
                onChange={(e) => updateSettings({ pickup_discount_value: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Enable pickup discount</Label>
              <Switch
                checked={settings.pickup_discount_enabled}
                onChange={(e) => updateSettings({ pickup_discount_enabled: e.target.checked })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>Filter, update status, review notes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="grid gap-3 rounded-lg border border-neutral-200 p-4 md:grid-cols-5 md:items-center">
              <div className="md:col-span-2">
                <div className="font-semibold text-midnight">#{order.id.slice(0, 8)}</div>
                <p className="text-sm text-midnight/60">{new Date(order.created_at).toLocaleString()}</p>
                <Badge className="mt-2">{order.fulfillment_method}</Badge>
              </div>
              <div>
                <p className="text-sm text-midnight/60">Total</p>
                <p className="font-semibold">{formatCurrency(order.total_cents, settings?.currency || 'USD')}</p>
              </div>
              <div>
                <p className="text-sm text-midnight/60">Payment</p>
                <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>{order.payment_status}</Badge>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}>
                  <option>Outstanding</option>
                  <option>In Progress</option>
                  <option>Ready</option>
                  <option>Shipped</option>
                  <option>Picked Up</option>
                  <option>Canceled</option>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Deduplicated by email/phone</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {customers.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="font-semibold text-midnight">{c.name}</div>
              <div className="text-sm text-midnight/70">{c.email}</div>
              <div className="text-sm text-midnight/60">{c.phone}</div>
              {c.total_spend && (
                <div className="text-sm text-midnight/80">Total: {formatCurrency(c.total_spend, settings?.currency || 'USD')}</div>
              )}
              {c.last_order_date && (
                <div className="text-xs text-midnight/60">Last order: {new Date(c.last_order_date).toLocaleDateString()}</div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingredients & Production Planning</CardTitle>
          <CardDescription>Calculate required quantities for outstanding orders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-midnight/70">Ingredient requirements are derived from size-ingredient mappings and open orders.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {ingredients.map((ing) => (
              <div key={ing.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-midnight">{ing.name}</div>
                    <p className="text-xs text-midnight/60">Unit: {ing.unit}</p>
                  </div>
                  <Badge variant="success">On hand: {ing.on_hand ?? 0}</Badge>
                </div>
                {ing.requirements !== undefined && (
                  <p className="mt-2 text-sm text-midnight/80">Required: {ing.requirements} {ing.unit}</p>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Internal production notes</Label>
            <Textarea
              placeholder="Add prep checklist, sourcing notes, or supplier contact."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Orders</CardTitle>
          <CardDescription>Highlight urgent items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {outstandingOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <div className="font-semibold text-midnight">#{o.id.slice(0, 8)}</div>
                <p className="text-sm text-midnight/70">{o.fulfillment_method} • {new Date(o.created_at).toLocaleTimeString()}</p>
              </div>
              <Badge variant="warning">{o.status}</Badge>
            </div>
          ))}
          {!outstandingOrders.length && <p className="text-sm text-midnight/70">All caught up.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

