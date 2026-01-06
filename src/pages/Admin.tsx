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

type OrderItem = {
  size_name: string
  quantity: number
  price_cents: number
  unit_label?: string
}

type OrderRow = {
  id: string
  status: OrderStatus
  total_cents: number
  subtotal_cents: number
  fulfillment_method: 'delivery' | 'pickup'
  created_at: string
  payment_status: string
  delivery_fee_cents: number
  pickup_discount_cents: number
  notes: string | null
  delivery_address: {
    address?: string
    city?: string
    state?: string
    postal_code?: string
  } | null
  customer?: {
    name: string
    email: string
    phone: string | null
  } | null
  order_items?: OrderItem[]
}

type CustomerRow = {
  id: string
  name: string
  email: string
  phone: string | null
  total_spend?: number
  last_order_date?: string
  order_count?: number
}

type IngredientRow = {
  id: string
  name: string
  unit: string
  on_hand?: number
  requirements?: number
}

type Toast = {
  id: string
  message: string
  type: 'saving' | 'success' | 'error'
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
  const [toasts, setToasts] = useState<Toast[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)
  const [customerOrders, setCustomerOrders] = useState<OrderRow[]>([])
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false)
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  
  const showToast = (message: string, type: 'saving' | 'success' | 'error') => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, message, type }])
    
    if (type !== 'saving') {
      // Auto-remove success/error toasts after 3 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3000)
    }
    
    return id
  }
  
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

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
          .select(`
            id,
            status,
            total_cents,
            subtotal_cents,
            fulfillment_method,
            created_at,
            payment_status,
            delivery_fee_cents,
            pickup_discount_cents,
            notes,
            delivery_address,
            customer:customers(id, name, email, phone),
            order_items(size_name, quantity, price_cents, unit_label)
          `)
          .order('created_at', { ascending: false })
          .limit(50),
        client.from('dedup_customers').select('*'),
        client.from('ingredients').select('*').order('name'),
      ])
      if (sizeRes.error) throw sizeRes.error
      if (settingsRes.error) throw settingsRes.error
      if (orderRes.error) throw orderRes.error
      if (customerRes.error) throw customerRes.error
      if (ingredientRes.error) throw ingredientRes.error
      setSizes(sizeRes.data || [])
      setSettings(settingsRes.data as Settings)
      
      // Transform orders data to include nested relations
      const ordersData = (orderRes.data || []).map((order: any) => ({
        ...order,
        customer: order.customer ? (Array.isArray(order.customer) ? order.customer[0] : order.customer) : null,
        order_items: order.order_items || [],
      }))
      setOrders(ordersData as OrderRow[])
      
      // Get order counts for customers
      const customersData = await Promise.all(
        (customerRes.data || []).map(async (customer: CustomerRow) => {
          const { count, error } = await client
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
          return { ...customer, order_count: error ? 0 : (count || 0) }
        })
      )
      setCustomers(customersData as CustomerRow[])
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
      setError('Supabase is not configured. Check your environment variables.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      console.log('📧 Requesting magic link for:', email)
      console.log('🔑 Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
      console.log('🔑 Has anon key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
      
      const { data, error: signInError } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      })
      
      if (signInError) {
        console.error('❌ Magic link error:', signInError)
        // Provide more helpful error messages
        if (signInError.message.includes('Invalid API key') || signInError.message.includes('JWT')) {
          setError('Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in .env and restart the dev server.')
        } else {
          setError(signInError.message)
        }
        throw signInError
      }
      
      console.log('✅ Magic link request successful:', data)
      showToast(`Magic link sent to ${email}. Check your inbox (and spam folder).`, 'success')
    } catch (err) {
      console.error('❌ Login error:', err)
      const errorMessage = (err as Error).message
      if (!errorMessage.includes('Invalid API key')) {
        setError(errorMessage)
      }
      showToast(`Error: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateSize = async (id: string, updates: Partial<ProductSize>) => {
    const client = supabase
    if (!client) return
    
    const toastId = showToast('Saving product...', 'saving')
    setError(null)
    
    // Optimistically update local state
    setSizes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
    
    const { error: updateError } = await client.from('product_sizes').update(updates).eq('id', id)
    if (updateError) {
      removeToast(toastId)
      setError(updateError.message)
      showToast(`Error: ${updateError.message}`, 'error')
      // Revert on error
      fetchDashboard()
    } else {
      removeToast(toastId)
      showToast('✓ Product updated', 'success')
      // Refetch to ensure sync
      setTimeout(() => fetchDashboard(), 300)
    }
  }
  
  const handleSizeBlur = (id: string, field: keyof ProductSize, value: string | number | boolean) => {
    // Save when user leaves the field
    updateSize(id, { [field]: value } as Partial<ProductSize>)
  }

  const updateSettings = async (updates: Partial<Settings>) => {
    const client = supabase
    if (!client || !settings) return
    
    const toastId = showToast('Saving settings...', 'saving')
    setError(null)
    
    // Optimistically update local state
    setSettings((prev) => prev ? { ...prev, ...updates } : null)
    
    const { error: updateError } = await client.from('settings').update(updates).eq('id', settings.id)
    if (updateError) {
      removeToast(toastId)
      setError(updateError.message)
      showToast(`Error: ${updateError.message}`, 'error')
      fetchDashboard() // Revert on error
    } else {
      removeToast(toastId)
      showToast('✓ Settings saved', 'success')
      fetchDashboard()
    }
  }

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const client = supabase
    if (!client) return
    
    const toastId = showToast('Updating order...', 'saving')
    const { error: updateError } = await client.from('orders').update({ status }).eq('id', orderId)
    if (updateError) {
      removeToast(toastId)
      setError(updateError.message)
      showToast(`Error: ${updateError.message}`, 'error')
    } else {
      removeToast(toastId)
      showToast('✓ Order updated', 'success')
      fetchDashboard()
    }
  }

  const loadCustomerOrders = async (customerId: string) => {
    const client = supabase
    if (!client) return
    
    setLoadingCustomerOrders(true)
    try {
      const { data, error } = await client
        .from('orders')
        .select(`
          id,
          status,
          total_cents,
          subtotal_cents,
          fulfillment_method,
          created_at,
          payment_status,
          delivery_fee_cents,
          pickup_discount_cents,
          notes,
          delivery_address,
          order_items(size_name, quantity, price_cents, unit_label)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCustomerOrders((data || []) as OrderRow[])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingCustomerOrders(false)
    }
  }

  const handleCustomerClick = async (customer: CustomerRow) => {
    setSelectedCustomer(customer)
    await loadCustomerOrders(customer.id)
  }

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (dateRange === 'all') return orders
    
    if (dateRange === 'custom') {
      if (!customStartDate || !customEndDate) return orders
      const startDate = new Date(customStartDate)
      const endDate = new Date(customEndDate)
      endDate.setHours(23, 59, 59, 999)
      return orders.filter((o) => {
        const orderDate = new Date(o.created_at)
        return orderDate >= startDate && orderDate <= endDate
      })
    }
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate: Date
    
    switch (dateRange) {
      case 'today':
        startDate = today
        break
      case 'week':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate = new Date(today)
        startDate.setMonth(startDate.getMonth() - 1)
        break
      default:
        return orders
    }
    
    const endDate = new Date(today)
    endDate.setHours(23, 59, 59, 999)
    
    return orders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= startDate && orderDate <= endDate
    })
  }, [orders, dateRange, customStartDate, customEndDate])

  const outstandingOrders = orders.filter((o) => o.status === 'Outstanding')
  const metrics = useMemo(() => {
    const revenue = filteredOrders.reduce((sum, o) => sum + o.total_cents, 0)
    const avg = filteredOrders.length ? revenue / filteredOrders.length : 0
    const pickupCount = filteredOrders.filter((o) => o.fulfillment_method === 'pickup').length
    const deliveryCount = filteredOrders.filter((o) => o.fulfillment_method === 'delivery').length
    return { revenue, avg, pickupCount, deliveryCount }
  }, [filteredOrders])

  const chartData = useMemo(() => {
    const byDay: Record<string, { date: string; revenue: number; orders: number }> = {}
    filteredOrders.forEach((o) => {
      const day = o.created_at?.slice(0, 10)
      if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0 }
      byDay[day].revenue += o.total_cents / 100
      byDay[day].orders += 1
    })
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredOrders])

  const sizeBreakdown = useMemo(() => {
    // Count orders by size from order_items
    const sizeCounts: Record<string, number> = {}
    filteredOrders.forEach((order) => {
      if (order.order_items) {
        order.order_items.forEach((item) => {
          sizeCounts[item.size_name] = (sizeCounts[item.size_name] || 0) + item.quantity
        })
      }
    })
    
    // Convert to array format for pie chart
    return Object.entries(sizeCounts).map(([name, value]) => ({
      name,
      value,
    }))
  }, [filteredOrders])

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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg
              ${
                toast.type === 'saving'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : toast.type === 'success'
                  ? 'border-green-300 bg-green-100 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }
              animate-in slide-in-from-bottom-2
            `}
          >
            {toast.type === 'saving' && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
            )}
            {toast.type === 'success' && <span className="text-lg">✓</span>}
            {toast.type === 'error' && <span className="text-lg">✕</span>}
            <span className="text-sm font-medium">{toast.message}</span>
            {toast.type !== 'saving' && (
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 text-current opacity-70 hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Filter metrics and charts by date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={dateRange === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('all')}
            >
              All Time
            </Button>
            <Button
              variant={dateRange === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('today')}
            >
              Today
            </Button>
            <Button
              variant={dateRange === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('week')}
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRange === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('month')}
            >
              Last 30 Days
            </Button>
            <Button
              variant={dateRange === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('custom')}
            >
              Custom Range
            </Button>
          </div>
          {dateRange === 'custom' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-midnight/60">
              Revenue {dateRange !== 'all' && `(${dateRange === 'custom' ? 'custom' : dateRange})`}
            </p>
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
            {chartData.length > 0 ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-midnight/60">
                No data for selected date range
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Size mix</CardTitle>
            <CardDescription>Distribution by quantity ordered</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {sizeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={sizeBreakdown} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="40%" 
                    cy="50%" 
                    outerRadius={70} 
                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    labelLine={false}
                  />
                  <Tooltip />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ paddingLeft: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-midnight/60">
                No data for selected date range
              </div>
            )}
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
            <div key={size.id} className="grid gap-4 rounded-lg border border-neutral-200 p-4 md:grid-cols-5 md:items-start">
              <div className="space-y-2 md:col-span-2">
                <Label>Name</Label>
                <Input 
                  value={size.name || ''} 
                  onChange={(e) => {
                    setSizes((prev) => prev.map((s) => (s.id === size.id ? { ...s, name: e.target.value } : s)))
                  }}
                  onBlur={(e) => handleSizeBlur(size.id, 'name', e.target.value)}
                />
                <p className="text-xs text-midnight/60">{size.unit_label}</p>
              </div>
              <div className="space-y-2">
                <Label>Price (cents)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={size.price_cents?.toString() ?? '0'}
                  onChange={(e) => {
                    const val = e.target.value
                    // Allow empty string, numbers, and negative sign at start
                    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                      setSizes((prev) => prev.map((s) => 
                        s.id === size.id 
                          ? { ...s, price_cents: val === '' ? 0 : parseInt(val, 10) || 0 } 
                          : s
                      ))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                    handleSizeBlur(size.id, 'price_cents', val)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Available qty</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={size.available_qty?.toString() ?? '0'}
                  onChange={(e) => {
                    const val = e.target.value
                    // Allow empty string and numbers only
                    if (val === '' || /^\d*$/.test(val)) {
                      setSizes((prev) => prev.map((s) => 
                        s.id === size.id 
                          ? { ...s, available_qty: val === '' ? 0 : parseInt(val, 10) || 0 } 
                          : s
                      ))
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                    handleSizeBlur(size.id, 'available_qty', val)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{size.is_active ? 'Active' : 'Inactive'}</Label>
                <div className="pt-2">
                  <Switch
                    checked={size.is_active ?? true}
                    onChange={(e) => {
                      const newValue = e.target.checked
                      setSizes((prev) => prev.map((s) => (s.id === size.id ? { ...s, is_active: newValue } : s)))
                      updateSize(size.id, { is_active: newValue })
                    }}
                  />
                </div>
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
            <div className="space-y-2 md:col-span-3">
              <Label>Venmo address</Label>
              <Input
                type="text"
                placeholder="your-venmo-username"
                value={settings.venmo_address ?? ''}
                onChange={(e) => {
                  setSettings((prev) => prev ? {
                    ...prev,
                    venmo_address: e.target.value
                  } : null)
                }}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  updateSettings({ venmo_address: e.target.value || null })
                }}
              />
              <p className="text-xs text-midnight/60">Enter your Venmo username (without @)</p>
            </div>
            <div className="space-y-2">
              <Label>Delivery fee (cents)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={settings.delivery_fee_cents?.toString() ?? '0'}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                    setSettings((prev) => prev ? {
                      ...prev,
                      delivery_fee_cents: val === '' ? 0 : parseInt(val, 10) || 0
                    } : null)
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                  updateSettings({ delivery_fee_cents: val })
                }}
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
              <Label>
                Pickup discount value
                {settings.pickup_discount_type === 'fixed' && (
                  <span className="ml-2 text-xs font-normal text-midnight/60">(in cents)</span>
                )}
                {settings.pickup_discount_type === 'percent' && (
                  <span className="ml-2 text-xs font-normal text-midnight/60">(percentage)</span>
                )}
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={settings.pickup_discount_value?.toString() ?? '0'}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                    setSettings((prev) => prev ? {
                      ...prev,
                      pickup_discount_value: val === '' ? 0 : parseInt(val, 10) || 0
                    } : null)
                  }
                }}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                  updateSettings({ pickup_discount_value: val })
                }}
              />
              {settings.pickup_discount_type === 'fixed' && settings.pickup_discount_value > 0 && (
                <p className="text-xs text-midnight/60">
                  = {formatCurrency(settings.pickup_discount_value, settings.currency)}
                </p>
              )}
              {settings.pickup_discount_type === 'percent' && settings.pickup_discount_value > 0 && (
                <p className="text-xs text-midnight/60">
                  = {settings.pickup_discount_value}% off
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{settings.pickup_discount_enabled ? 'Pickup discount enabled' : 'Pickup discount disabled'}</Label>
              <div className="pt-2">
                <Switch
                  checked={settings.pickup_discount_enabled}
                  onChange={(e) => {
                    const newValue = e.target.checked
                    setSettings((prev) => prev ? { ...prev, pickup_discount_enabled: newValue } : null)
                    updateSettings({ pickup_discount_enabled: newValue })
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>Filter, update status, review notes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-neutral-200 p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-5 md:items-center">
                <div className="md:col-span-2">
                  <div className="font-semibold text-midnight">#{order.id.slice(0, 8).toUpperCase()}</div>
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
              
              {/* Order Details */}
              <div className="grid gap-4 pt-3 border-t border-neutral-200 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-midnight">Customer</p>
                  {order.customer ? (
                    <div className="text-sm text-midnight/80">
                      <p>{order.customer.name}</p>
                      <p className="text-midnight/60">{order.customer.email}</p>
                      {order.customer.phone && <p className="text-midnight/60">{order.customer.phone}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-midnight/60">No customer info</p>
                  )}
                </div>
                
                {order.fulfillment_method === 'delivery' && order.delivery_address && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-midnight">Delivery Address</p>
                    <div className="text-sm text-midnight/80">
                      <p>{order.delivery_address.address}</p>
                      <p>{order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.postal_code}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Order Items */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-neutral-200">
                  <p className="text-sm font-semibold text-midnight">Items</p>
                  <div className="space-y-1">
                    {order.order_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm text-midnight/80">
                        <span>{item.size_name} × {item.quantity}</span>
                        <span>{formatCurrency(item.price_cents * item.quantity, settings?.currency || 'USD')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Order Totals Breakdown */}
              <div className="space-y-1 pt-3 border-t border-neutral-200 text-sm">
                <div className="flex items-center justify-between text-midnight/80">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal_cents, settings?.currency || 'USD')}</span>
                </div>
                {order.pickup_discount_cents > 0 && (
                  <div className="flex items-center justify-between text-olive">
                    <span>Pickup discount</span>
                    <span>-{formatCurrency(order.pickup_discount_cents, settings?.currency || 'USD')}</span>
                  </div>
                )}
                {order.delivery_fee_cents > 0 && (
                  <div className="flex items-center justify-between text-midnight/80">
                    <span>Delivery fee</span>
                    <span>{formatCurrency(order.delivery_fee_cents, settings?.currency || 'USD')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 font-semibold text-midnight">
                  <span>Total</span>
                  <span>{formatCurrency(order.total_cents, settings?.currency || 'USD')}</span>
                </div>
              </div>
              
              {/* Notes */}
              {order.notes && (
                <div className="pt-3 border-t border-neutral-200">
                  <p className="text-sm font-semibold text-midnight mb-1">Notes</p>
                  <p className="text-sm text-midnight/80">{order.notes}</p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Deduplicated by email/phone. Click to view orders.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {customers.map((c) => (
            <div 
              key={c.id} 
              className="rounded-lg border border-neutral-200 p-4 cursor-pointer hover:border-pomegranate hover:bg-pomegranate/5 transition-colors"
              onClick={() => handleCustomerClick(c)}
            >
              <div className="font-semibold text-midnight">{c.name}</div>
              <div className="text-sm text-midnight/70">{c.email}</div>
              <div className="text-sm text-midnight/60">{c.phone}</div>
              <div className="mt-2 space-y-1">
                {c.order_count !== undefined && (
                  <div className="text-sm font-medium text-midnight/80">
                    Orders: <span className="text-pomegranate">{c.order_count}</span>
                  </div>
                )}
                {c.total_spend && (
                  <div className="text-sm text-midnight/80">Total: {formatCurrency(c.total_spend, settings?.currency || 'USD')}</div>
                )}
                {c.last_order_date && (
                  <div className="text-xs text-midnight/60">Last order: {new Date(c.last_order_date).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Customer Orders Modal */}
      {selectedCustomer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedCustomer(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display text-midnight">{selectedCustomer.name}</h2>
                <p className="text-sm text-midnight/60">{selectedCustomer.email} • {selectedCustomer.phone}</p>
              </div>
              <Button variant="outline" onClick={() => setSelectedCustomer(null)}>×</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingCustomerOrders ? (
                <div className="text-center py-8 text-midnight/60">Loading orders...</div>
              ) : customerOrders.length === 0 ? (
                <div className="text-center py-8 text-midnight/60">No orders found</div>
              ) : (
                <div className="space-y-4">
                  {customerOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-neutral-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-midnight">Order #{order.id.slice(0, 8).toUpperCase()}</div>
                          <p className="text-sm text-midnight/60">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{order.fulfillment_method}</Badge>
                          <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>{order.payment_status}</Badge>
                          <Badge variant={order.status === 'Outstanding' ? 'warning' : 'success'}>{order.status}</Badge>
                        </div>
                      </div>
                      
                      {order.fulfillment_method === 'delivery' && order.delivery_address && (
                        <div className="text-sm text-midnight/80">
                          <p className="font-semibold text-midnight mb-1">Delivery Address</p>
                          <p>{order.delivery_address.address}</p>
                          <p>{order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.postal_code}</p>
                        </div>
                      )}
                      
                      {order.order_items && order.order_items.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-midnight">Items</p>
                          {order.order_items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm text-midnight/80">
                              <span>{item.size_name} × {item.quantity}</span>
                              <span>{formatCurrency(item.price_cents * item.quantity, settings?.currency || 'USD')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="space-y-1 text-sm pt-2 border-t border-neutral-200">
                        <div className="flex items-center justify-between text-midnight/80">
                          <span>Subtotal</span>
                          <span>{formatCurrency(order.subtotal_cents, settings?.currency || 'USD')}</span>
                        </div>
                        {order.pickup_discount_cents > 0 && (
                          <div className="flex items-center justify-between text-olive">
                            <span>Pickup discount</span>
                            <span>-{formatCurrency(order.pickup_discount_cents, settings?.currency || 'USD')}</span>
                          </div>
                        )}
                        {order.delivery_fee_cents > 0 && (
                          <div className="flex items-center justify-between text-midnight/80">
                            <span>Delivery fee</span>
                            <span>{formatCurrency(order.delivery_fee_cents, settings?.currency || 'USD')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 font-semibold text-midnight">
                          <span>Total</span>
                          <span>{formatCurrency(order.total_cents, settings?.currency || 'USD')}</span>
                        </div>
                      </div>
                      
                      {order.notes && (
                        <div className="pt-2 border-t border-neutral-200">
                          <p className="text-sm font-semibold text-midnight mb-1">Notes</p>
                          <p className="text-sm text-midnight/80">{order.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        <CardContent className="space-y-4">
          {outstandingOrders.map((o) => (
            <div key={o.id} className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-midnight">Order #{o.id.slice(0, 8).toUpperCase()}</div>
                  <p className="text-sm text-midnight/70">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{o.fulfillment_method}</Badge>
                  <Badge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>{o.payment_status}</Badge>
                  <Badge variant="warning">{o.status}</Badge>
                </div>
              </div>
              
              <div className="grid gap-4 pt-2 border-t border-amber-200 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-midnight">Customer</p>
                  {o.customer ? (
                    <div className="text-sm text-midnight/80">
                      <p>{o.customer.name}</p>
                      <p className="text-midnight/60">{o.customer.email}</p>
                      {o.customer.phone && <p className="text-midnight/60">{o.customer.phone}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-midnight/60">No customer info</p>
                  )}
                </div>
                
                {o.fulfillment_method === 'delivery' && o.delivery_address && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-midnight">Delivery Address</p>
                    <div className="text-sm text-midnight/80">
                      <p>{o.delivery_address.address}</p>
                      <p>{o.delivery_address.city}, {o.delivery_address.state} {o.delivery_address.postal_code}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {o.order_items && o.order_items.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-amber-200">
                  <p className="text-sm font-semibold text-midnight">Items</p>
                  <div className="space-y-1">
                    {o.order_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm text-midnight/80">
                        <span>{item.size_name} × {item.quantity}</span>
                        <span>{formatCurrency(item.price_cents * item.quantity, settings?.currency || 'USD')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-1 pt-2 border-t border-amber-200 text-sm">
                <div className="flex items-center justify-between text-midnight/80">
                  <span>Subtotal</span>
                  <span>{formatCurrency(o.subtotal_cents, settings?.currency || 'USD')}</span>
                </div>
                {o.pickup_discount_cents > 0 && (
                  <div className="flex items-center justify-between text-olive">
                    <span>Pickup discount</span>
                    <span>-{formatCurrency(o.pickup_discount_cents, settings?.currency || 'USD')}</span>
                  </div>
                )}
                {o.delivery_fee_cents > 0 && (
                  <div className="flex items-center justify-between text-midnight/80">
                    <span>Delivery fee</span>
                    <span>{formatCurrency(o.delivery_fee_cents, settings?.currency || 'USD')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-amber-200 font-semibold text-midnight">
                  <span>Total</span>
                  <span>{formatCurrency(o.total_cents, settings?.currency || 'USD')}</span>
                </div>
              </div>
              
              {o.notes && (
                <div className="pt-2 border-t border-amber-200">
                  <p className="text-sm font-semibold text-midnight mb-1">Notes</p>
                  <p className="text-sm text-midnight/80">{o.notes}</p>
                </div>
              )}
              
              <div className="pt-2 border-t border-amber-200">
                <Label>Update Status</Label>
                <Select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderStatus)}>
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
          {!outstandingOrders.length && <p className="text-sm text-midnight/70">All caught up.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

