-- Create RPC function to update user notification settings
create or replace function update_user_notifications(
  admin_email text,
  notification_updates jsonb
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  is_admin_user boolean;
  updated_user jsonb;
begin
  -- Verify admin
  select exists (
    select 1 from admin_users au
    where lower(au.email) = lower(admin_email)
  ) into is_admin_user;
  
  if not is_admin_user then
    raise exception 'Unauthorized: Admin access required';
  end if;
  
  -- Update user notification settings
  update admin_users
  set
    notification_email = coalesce(notification_updates->>'notification_email', notification_email),
    notification_phone = coalesce(notification_updates->>'notification_phone', notification_phone),
    email_notifications_enabled = coalesce((notification_updates->>'email_notifications_enabled')::boolean, email_notifications_enabled),
    sms_notifications_enabled = coalesce((notification_updates->>'sms_notifications_enabled')::boolean, sms_notifications_enabled)
  where lower(email) = lower(admin_email);
  
  -- Return updated user
  select row_to_json(au)::jsonb into updated_user
  from admin_users au
  where lower(au.email) = lower(admin_email);
  
  return updated_user;
end;
$$;

-- Grant execute permission
grant execute on function update_user_notifications(text, jsonb) to anon, authenticated;

