insert into system_settings (key, value)
values ('workout_create_min_lead_hours', '2')
on conflict (key) do nothing;
