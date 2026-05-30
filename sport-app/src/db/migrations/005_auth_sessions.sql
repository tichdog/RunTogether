create table if not exists auth_sessions (
  id uuid primary key,
  user_id bigint not null references users(id) on delete cascade,
  access_jti text not null unique,
  refresh_token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auth_sessions_user on auth_sessions(user_id);
create index if not exists idx_auth_sessions_refresh_hash on auth_sessions(refresh_token_hash);
create index if not exists idx_auth_sessions_active on auth_sessions(user_id, revoked_at, expires_at);
