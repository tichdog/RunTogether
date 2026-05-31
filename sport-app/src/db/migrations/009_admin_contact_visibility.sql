insert into system_settings (key, value)
values
  ('admins_can_view_user_emails', 'true'),
  ('admins_can_view_user_phones', 'true')
on conflict (key) do nothing;
