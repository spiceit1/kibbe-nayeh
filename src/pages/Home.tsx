import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Truck, Utensils, Phone, Mail, MapPin, Trash2, Minus, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { supabase } from '../lib/supabaseClient'
import { defaultSettings, sampleSizes } from '../lib/sampleData'
import { calculateOrderTotals, formatCurrency } from '../lib/pricing'
import type { CheckoutPayload, FulfillmentMethod, ProductSize, Settings } from '../lib/types'

const emptyForm = {
  items: [] as { size_id: string; quantity: number }[],
  fulfillment_method: 'delivery' as FulfillmentMethod,
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  notes: '',
}

export default function HomePage() {
  const navigate = useNavigate()
  const [sizes, setSizes] = useState<ProductSize[]>(sampleSizes)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!supabase) return
      const [{ data: sizeData }, { data: settingsData }] = await Promise.all([
        supabase.from('product_sizes').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('settings').select('*').limit(1).maybeSingle(),
      ])
      if (sizeData && sizeData.length) {
        setSizes(sizeData)
        setForm((prev) => ({
          ...prev,
          items: sizeData.filter((s) => s.is_active).map((s) => ({ size_id: s.id, quantity: 0 })),
        }))
      }
      if (settingsData) setSettings(settingsData as Settings)
    }
    loadData()
  }, [])

  const totals = useMemo(() => {
    const items = form.items
      .filter((i) => i.quantity > 0)
      .map((item) => {
        const size = sizes.find((s) => s.id === item.size_id)
        return size ? { size, quantity: item.quantity } : null
      })
      .filter(Boolean) as { size: ProductSize; quantity: number }[]
    return calculateOrderTotals(items, settings, form.fulfillment_method)
  }, [form.items, settings, form.fulfillment_method, sizes])

  const updateQuantity = (index: number, delta: number) => {
    setForm((prev) => {
      const next = [...prev.items]
      const size = sizes.find((s) => s.id === next[index].size_id)
      const max = size?.available_qty ?? 99
      const newQty = Math.min(Math.max(0, next[index].quantity + delta), max)
      next[index] = { ...next[index], quantity: newQty }
      return { ...prev, items: next }
    })
  }

  const handleCheckout = async () => {
    setError(null)
    setMessage(null)
    
    // Check for missing required fields
    const missingFields: string[] = []

    const nonZeroItems = form.items.filter((i) => i.quantity > 0)
    const hasItems = nonZeroItems.length > 0 && nonZeroItems.every((i) => i.size_id && i.quantity > 0)
    if (!hasItems) {
      setError('Please add at least one item.')
      return
    }
    
    // Check contact information
    if (!form.name?.trim()) missingFields.push('Full name')
    if (!form.email?.trim()) missingFields.push('Email')
    if (!form.phone?.trim()) missingFields.push('Phone')
    
    // Check delivery address if needed
    if (form.fulfillment_method === 'delivery') {
      if (!form.address?.trim()) missingFields.push('Street address')
      if (!form.city?.trim()) missingFields.push('City')
      if (!form.state?.trim()) missingFields.push('State')
      if (!form.postal_code?.trim()) missingFields.push('Postal code')
    }
    
    if (missingFields.length > 0) {
      if (missingFields.length === 1) {
        setError(`Please fill in: ${missingFields[0]}`)
      } else {
        setError(`Please fill in: ${missingFields.join(', ')}`)
      }
      return
    }

    setLoading(true)
    try {
      const payload: CheckoutPayload = {
        items: nonZeroItems,
        fulfillment_method: form.fulfillment_method,
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          postal_code: form.postal_code,
        },
        notes: form.notes,
      }
      const res = await fetch('/.netlify/functions/create-venmo-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to create order')
      
      // Redirect to order confirmation page
      if (data.order_id && data.venmo_address) {
        navigate(`/order-confirmation?order_id=${data.order_id}&venmo=${encodeURIComponent(data.venmo_address)}&total=${data.total_cents}&currency=${data.currency}`)
      } else {
        throw new Error('Missing order or Venmo information')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-8 rounded-3xl bg-white/80 p-8 shadow-lg ring-1 ring-neutral-200 md:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="success" className="w-fit">
            Fresh • Handcrafted same-day
          </Badge>
          <h1 className="font-display text-4xl text-midnight md:text-5xl">Kibbeh Nayeh</h1>
          <p className="text-lg text-midnight/80">
            A Levantine classic made from hand-selected beef, fine bulgur, and cool olive oil—served raw with
            brightness from mint, onion, and warming spices. Crafted in small batches and chilled for pickup or
            delivery.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-midnight/80">
            <div className="flex items-center gap-2 rounded-full bg-pomegranate/10 px-3 py-2 text-pomegranate">
              <Utensils size={16} /> Traditional preparation
            </div>
            <div className="flex items-center gap-2 rounded-full bg-olive/10 px-3 py-2 text-olive">
              <Truck size={16} /> Delivery or pickup
            </div>
          </div>
        </div>
        <div id="order" className="space-y-4">
          <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Build your order</CardTitle>
                <CardDescription>Choose your items, quantity, and fulfillment method</CardDescription>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  {form.items.map((item, idx) => {
                    const size = sizes.find((s) => s.id === item.size_id)
                    const available = size?.available_qty ?? 0
                    return (
                      <div
                        key={`${item.size_id}-${idx}`}
                        className="grid gap-3 rounded-lg border border-neutral-200 p-3 md:grid-cols-[2fr,1fr]"
                      >
                        <div className="space-y-1">
                          <Select
                            className="min-w-[260px]"
                            value={item.size_id}
                            onChange={(e) =>
                              setForm((prev) => {
                                const next = [...prev.items]
                                next[idx] = { ...next[idx], size_id: e.target.value }
                                return { ...prev, items: next }
                              })
                            }
                          >
                            {sizes.filter((s) => s.is_active).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} — {formatCurrency(s.price_cents, settings.currency)}
                              </option>
                            ))}
                          </Select>
                          {available <= 0 ? (
                            <p className="text-sm font-semibold text-red-600">SOLD OUT</p>
                          ) : available === 1 ? (
                            <p className="text-sm font-semibold text-pomegranate">Last one!</p>
                          ) : (
                            <p className="text-xs text-midnight/60">Available: {available}</p>
                          )}
                        </div>
                        <div className="space-y-1 flex flex-col items-stretch">
                          {item.quantity === 0 ? (
                            <div title={available <= 0 ? 'Sold Out' : undefined}>
                              <Button
                                className="h-12 justify-center w-full"
                                onClick={() => updateQuantity(idx, +1)}
                                disabled={available <= 0}
                              >
                                <ShoppingCart size={18} className="mr-2" />
                                Add to Cart
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex h-12 items-stretch overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50">
                                <button
                                  type="button"
                                  aria-label={item.quantity <= 1 ? 'Remove item' : 'Decrease quantity'}
                                  className={`flex w-12 items-center justify-center border-r border-neutral-200 transition ${
                                    item.quantity <= 1
                                      ? 'text-red-500 hover:bg-red-50'
                                      : 'text-midnight/80 hover:bg-neutral-100'
                                  } disabled:text-neutral-300 disabled:hover:bg-transparent`}
                                  onClick={() => updateQuantity(idx, item.quantity <= 1 ? -item.quantity : -1)}
                                  disabled={item.quantity === 0}
                                >
                                  {item.quantity <= 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                                </button>
                                <div className="flex-1 flex items-center justify-center text-lg font-semibold text-midnight bg-white">
                                  {item.quantity}
                                </div>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  className="flex w-12 items-center justify-center border-l border-neutral-200 text-midnight/80 transition hover:bg-neutral-100 disabled:text-neutral-300 disabled:hover:bg-transparent"
                                  onClick={() => updateQuantity(idx, +1)}
                                  disabled={available <= 0 || item.quantity >= available}
                                >
                                  <Plus size={18} />
                                </button>
                              </div>
                              {available > 0 && item.quantity >= available && (
                                <p className="text-xs text-neutral-600 text-center">Max quantity reached</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fulfillment</Label>
                  <Select
                    value={form.fulfillment_method}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, fulfillment_method: e.target.value as FulfillmentMethod }))
                    }
                  >
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                  </Select>
                  <p className="text-xs text-midnight/60">Pickup discount auto-applied when enabled.</p>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    placeholder="Add mint garnish, time window..."
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                {form.fulfillment_method === 'delivery' && (
                  <div className="space-y-2">
                    <Label>Street address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              {form.fulfillment_method === 'delivery' && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal code</Label>
                    <Input
                      value={form.postal_code}
                      onChange={(e) => setForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div className="rounded-lg bg-sand px-4 py-3 text-sm text-midnight/80">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totals.base, settings.currency)}</span>
                </div>
                {totals.pickupDiscount > 0 && (
                  <div className="flex items-center justify-between text-olive">
                    <span>Pickup discount</span>
                    <span>-{formatCurrency(totals.pickupDiscount, settings.currency)}</span>
                  </div>
                )}
                {totals.deliveryFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Delivery fee</span>
                    <span>{formatCurrency(totals.deliveryFee, settings.currency)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 text-lg font-semibold text-midnight">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total, settings.currency)}</span>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              {message && (
                <div className="flex items-center gap-2 rounded-lg border border-olive/30 bg-olive/10 px-3 py-2 text-sm text-olive">
                  <CheckCircle2 size={16} /> {message}
                </div>
              )}
              <Button className="w-full" size="lg" onClick={handleCheckout} disabled={loading}>
                {loading ? 'Creating order...' : 'Place order'}
              </Button>
              <p className="text-xs text-midnight/60">
                Pay via Venmo. You'll receive payment instructions after placing your order.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Serving suggestions</CardTitle>
            <CardDescription>Traditional accompaniments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-midnight/80">
            <p>Chill, then finish with cold-pressed olive oil, mint, and sweet onion. Serve with warm pita, arak, or chilled rosé.</p>
            <p>Pairs with pickled turnips, cucumber, tomatoes, and a pinch of Aleppo pepper.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delivery & Pickup</CardTitle>
            <CardDescription>Clear windows and handoff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-midnight/80">
            <p>Pickup discount is applied automatically. Add your preferred pickup time in notes.</p>
            <p>Delivery includes insulated packaging. Driver will text on approach.</p>
          </CardContent>
        </Card>
        <Card id="faq">
          <CardHeader>
            <CardTitle>FAQ</CardTitle>
            <CardDescription>Quick answers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-midnight/80">
            <p><strong>How far do you deliver?</strong> Configure your delivery radius in admin settings; fees are flat per order.</p>
            <p><strong>Can I freeze it?</strong> We recommend enjoying fresh within 24 hours.</p>
            <p><strong>Allergens?</strong> Contains wheat (bulgur). Produced in a kitchen that handles nuts and dairy.</p>
          </CardContent>
        </Card>
      </section>

      <section id="policies" className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>We respond quickly during prep hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-midnight/80">
            <div className="flex items-center gap-2"><Phone size={16} /> <span>+1 (555) 123-4567 (edit in settings)</span></div>
            <div className="flex items-center gap-2"><Mail size={16} /> <a className="text-pomegranate hover:underline" href="mailto:orders@kibbehnayeh.com">orders@kibbehnayeh.com</a></div>
            <div className="flex items-center gap-2"><MapPin size={16} /> <span>Pickup: add final address in settings</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>Editable templates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-midnight/80">
            <p><strong>Refunds:</strong> Full refund if canceled 24h before pickup/delivery. No refunds after prep starts.</p>
            <p><strong>Privacy:</strong> Customer data stored securely in Supabase. Used only for order fulfillment and notifications.</p>
            <p><strong>Food safety:</strong> Prepared under strict cold-chain handling. Keep refrigerated and consume promptly.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

