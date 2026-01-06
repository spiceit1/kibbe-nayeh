-- Enable Realtime for tables that need live updates
alter publication supabase_realtime add table settings;
alter publication supabase_realtime add table product_sizes;
