-- Add venmo_address to settings table
alter table settings add column if not exists venmo_address text;
