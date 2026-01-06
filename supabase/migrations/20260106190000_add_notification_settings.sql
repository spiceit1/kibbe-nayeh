-- Add notification email and phone to settings table
alter table settings
  add column if not exists notification_email text,
  add column if not exists notification_phone text;

