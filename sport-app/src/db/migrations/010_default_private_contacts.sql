alter table users
  alter column privacy_settings set default '{"hide_email": true, "hide_phone": true}'::jsonb;
