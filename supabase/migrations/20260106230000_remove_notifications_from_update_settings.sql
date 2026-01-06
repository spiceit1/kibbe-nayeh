-- Update update_settings function to remove notification fields (moved to admin_users)
create or replace function update_settings(
  admin_email text,
  settings_updates jsonb
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  is_admin_user boolean;
begin
  -- Verify admin
  select exists (
    select 1 from admin_users au
    where lower(au.email) = lower(admin_email)
  ) into is_admin_user;
  
  if not is_admin_user then
    raise exception 'Unauthorized: Admin access required';
  end if;
  
  -- Update settings (notification fields removed - now in admin_users)
  update settings
  set
    pickup_discount_enabled = coalesce((settings_updates->>'pickup_discount_enabled')::boolean, pickup_discount_enabled),
    pickup_discount_type = coalesce(settings_updates->>'pickup_discount_type', pickup_discount_type),
    pickup_discount_value = coalesce((settings_updates->>'pickup_discount_value')::integer, pickup_discount_value),
    delivery_fee_cents = coalesce((settings_updates->>'delivery_fee_cents')::integer, delivery_fee_cents),
    currency = coalesce(settings_updates->>'currency', currency),
    venmo_address = coalesce(settings_updates->>'venmo_address', venmo_address),
    updated_at = now()
  where id = 1;
  
  -- Return updated settings
  return (select row_to_json(s)::jsonb from settings s where id = 1);
end;
$$;

