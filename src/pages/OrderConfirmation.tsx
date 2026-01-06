import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { formatCurrency } from '../lib/pricing'
import { supabase } from '../lib/supabaseClient'

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
  const orderId = params.get('order_id')
  const venmoAddress = params.get('venmo')
  const totalCents = params.get('total')
  const currency = params.get('currency') || 'USD'
  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (orderId) {
        // Load order details from Supabase
        if (supabase) {
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select(`
              id,
              status,
              fulfillment_method,
              total_cents,
              pickup_discount_cents,
              delivery_fee_cents,
              order_items (
                size_name,
                quantity,
                price_cents
              )
            `)
            .eq('id', orderId)
            .maybeSingle()
          
          if (orderError || !orderData) {
            setError('Order not found')
            return
          }
          
          setOrder({
            id: orderData.id,
            status: orderData.status,
            fulfillment_method: orderData.fulfillment_method,
            total_cents: orderData.total_cents,
            pickup_discount_cents: orderData.pickup_discount_cents,
            delivery_fee_cents: orderData.delivery_fee_cents,
            currency: currency,
            items: (orderData.order_items as any[]).map((item: any) => ({
              name: item.size_name,
              quantity: item.quantity,
              price_cents: item.price_cents,
            })),
          })
        }
      }
    }
    load()
  }, [orderId, currency])

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

      {venmoAddress && totalCents && (
        <Card className="border-2 border-pomegranate">
          <CardHeader>
            <CardTitle>Pay via Venmo</CardTitle>
            <CardDescription>Send payment to complete your order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-pomegranate/10 p-4 text-center">
              <p className="text-sm font-medium text-midnight/80 mb-2">Send payment to:</p>
              <p className="text-2xl font-bold text-pomegranate">@{venmoAddress}</p>
              <p className="text-lg font-semibold text-midnight mt-3">
                {formatCurrency(Number(totalCents), currency)}
              </p>
            </div>
            <div className="space-y-2 text-sm text-midnight/80">
              <p><strong>Important:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Include order #{orderId?.slice(0, 8).toUpperCase()} in the Venmo note</li>
                <li>Your order will be prepared once payment is confirmed</li>
                <li>You'll receive a confirmation email and SMS</li>
              </ul>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const venmoUrl = `https://venmo.com/${venmoAddress}?txn=pay&amount=${Number(totalCents) / 100}&note=Order ${orderId?.slice(0, 8).toUpperCase()}`
                window.open(venmoUrl, '_blank')
              }}
            >
              Open Venmo App
            </Button>
          </CardContent>
        </Card>
      )}

      {order && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order #{order.id.slice(0, 8).toUpperCase()}</CardTitle>
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
            {order.pickup_discount_cents > 0 && (
              <div className="flex items-center justify-between">
                <span>Pickup discount</span>
                <span>-{formatCurrency(order.pickup_discount_cents, order.currency)}</span>
              </div>
            )}
            {order.delivery_fee_cents > 0 && (
              <div className="flex items-center justify-between">
                <span>Delivery fee</span>
                <span>{formatCurrency(order.delivery_fee_cents, order.currency)}</span>
              </div>
            )}
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

