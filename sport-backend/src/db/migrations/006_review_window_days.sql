insert into system_settings (key, value)
values ('review_window_days', '7')
on conflict (key) do nothing;
