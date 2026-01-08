import type { FulfillmentMethod, ProductSize, Settings } from './types'

export function calculateOrderTotals(
  items: { size: ProductSize; quantity: number }[],
  settings: Settings,
  fulfillment: FulfillmentMethod,
) {
  const base = items.reduce((sum, item) => sum + (item.size?.price_cents ?? 0) * item.quantity, 0)
  const deliveryFee = fulfillment === 'delivery' ? settings.delivery_fee_cents : 0

  const pickupDiscount =
    fulfillment === 'pickup' && settings.pickup_discount_enabled
      ? settings.pickup_discount_type === 'percent'
        ? Math.round(base * (settings.pickup_discount_value / 100))
        : settings.pickup_discount_value
      : 0

  const subtotal = base - pickupDiscount
  const total = subtotal + deliveryFee

  return {
    base,
    pickupDiscount,
    deliveryFee,
    total,
  }
}

export function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

