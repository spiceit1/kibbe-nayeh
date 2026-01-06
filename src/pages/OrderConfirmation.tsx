import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { formatCurrency } from '../lib/pricing'

type OrderSummary = {
  id: string
  status: string
  fulfillment_method: string
  total_cents: number
  pickup_discount_cents: number
  delivery_fee_cents: number
  currency: string
  items: { name: string; quantity: number; price_cents: number }[]
}

export default function OrderConfirmationPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!sessionId) return
      try {
        const res = await fetch(`/.netlify/functions/order-status?session_id=${sessionId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Unable to load order')
        setOrder(data.order as OrderSummary)
      } catch (err) {
        setError((err as Error).message)
      }
    }
    load()
  }, [sessionId])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-pomegranate">Thank you</p>
        <h1 className="font-display text-4xl text-midnight">Order confirmed</h1>
        <p className="text-midnight/80">A receipt and SMS confirmation have been sent. Save this page for your records.</p>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {order && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order #{order.id.slice(0, 8)}</CardTitle>
                <CardDescription>Fulfillment: {order.fulfillment_method}</CardDescription>
              </div>
              <Badge variant={order.status === 'Outstanding' ? 'warning' : 'success'}>{order.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-midnight/80">
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div>
                    <div className="font-semibold text-midnight">{item.name}</div>
                    <div className="text-xs text-midnight/60">Qty {item.quantity}</div>
                  </div>
                  <div className="font-semibold">{formatCurrency(item.price_cents * item.quantity, order.currency)}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span>Pickup discount</span>
              <span>-{formatCurrency(order.pickup_discount_cents, order.currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delivery fee</span>
              <span>{formatCurrency(order.delivery_fee_cents, order.currency)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-lg font-semibold text-midnight">
              <span>Total</span>
              <span>{formatCurrency(order.total_cents, order.currency)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

