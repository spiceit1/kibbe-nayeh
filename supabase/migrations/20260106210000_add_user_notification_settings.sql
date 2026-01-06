-- Add notification settings to admin_users table
alter table admin_users
  add column if not exists notification_email text,
  add column if not exists notification_phone text,
  add column if not exists email_notifications_enabled boolean default false,
  add column if not exists sms_notifications_enabled boolean default false;

-- Remove notification settings from settings table (moved to per-user)
alter table settings
  drop column if exists notification_email,
  drop column if exists notification_phone;

