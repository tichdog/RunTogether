insert into system_settings (key, value)
values ('workout_archive_retention_days', '90')
on conflict (key) do nothing;
