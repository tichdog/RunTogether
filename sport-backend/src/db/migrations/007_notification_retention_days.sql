insert into system_settings (key, value)
values ('notification_retention_days', '30')
on conflict (key) do nothing;
