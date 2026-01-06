-- Enable Realtime for tables that need live updates
-- Run this in your Supabase SQL Editor

-- Enable Realtime for settings table (for delivery fee updates)
alter publication supabase_realtime add table settings;

-- Enable Realtime for product_sizes table (for price/availability updates)
alter publication supabase_realtime add table product_sizes;

