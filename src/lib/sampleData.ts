import type { ProductSize, Settings } from './types'

export const sampleSizes: ProductSize[] = [
  {
    id: 'sample-small',
    name: 'Taster (8 oz)',
    unit_label: '8 oz tray',
    price_cents: 1800,
    available_qty: 24,
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'sample-medium',
    name: 'Family (16 oz)',
    unit_label: '16 oz tray',
    price_cents: 3200,
    available_qty: 18,
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'sample-large',
    name: 'Gathering (32 oz)',
    unit_label: '32 oz platter',
    price_cents: 5900,
    available_qty: 10,
    is_active: true,
    sort_order: 3,
  },
]

export const defaultSettings: Settings = {
  id: 1,
  pickup_discount_enabled: true,
  pickup_discount_type: 'percent',
  pickup_discount_value: 10,
  delivery_fee_cents: 800,
  currency: 'USD',
}

