export type FulfillmentMethod = 'delivery' | 'pickup'

export type OrderStatus = 'Outstanding' | 'In Progress' | 'Ready' | 'Shipped' | 'Picked Up' | 'Canceled'

export interface ProductSize {
  id: string
  name: string
  unit_label: string
  price_cents: number
  available_qty: number
  is_active: boolean
  sort_order?: number | null
}

export interface Settings {
  id: number
  pickup_discount_enabled: boolean
  pickup_discount_type: 'fixed' | 'percent'
  pickup_discount_value: number
  delivery_fee_cents: number
  currency: string
}

export interface CustomerPayload {
  name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
}

export interface CheckoutPayload {
  size_id: string
  quantity: number
  fulfillment_method: FulfillmentMethod
  customer: CustomerPayload
  notes?: string
}

