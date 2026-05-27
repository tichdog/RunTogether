create table if not exists users (
  id bigserial primary key,
  email text unique,
  phone text unique,
  password_hash text not null,
  first_name text,
  last_name text,
  gender text check (gender in ('male', 'female', 'other')),
  full_name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'admin', 'super_admin')),
  account_status text not null default 'active' check (account_status in ('active', 'blocked')),
  warning_count integer not null default 0,
  blocked_until timestamptz,
  block_reason text,
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'phone_verified', 'fully_verified')),
  privacy_settings jsonb not null default '{"hide_email": false, "hide_phone": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_or_phone check (email is not null or phone is not null)
);

alter table users add column if not exists first_name text;
alter table users add column if not exists last_name text;
alter table users add column if not exists gender text;
alter table users add column if not exists warning_count integer not null default 0;
alter table users add column if not exists blocked_until timestamptz;
alter table users add column if not exists block_reason text;
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('member', 'admin', 'super_admin'));

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

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists workouts (
  id bigserial primary key,
  organizer_id bigint not null references users(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  meeting_point_name text not null,
  meeting_point_address text,
  meeting_lat numeric(9,6),
  meeting_lng numeric(9,6),
  route_name text not null,
  route_geojson jsonb,
  distance_km numeric(7,2) not null check (distance_km > 0),
  pace_min_per_km numeric(4,2) not null check (pace_min_per_km > 0),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  participant_limit integer not null check (participant_limit > 0),
  status text not null default 'open' check (status in ('planned', 'open', 'full', 'in_progress', 'completed', 'archived', 'cancelled')),
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_participants (
  id bigserial primary key,
  workout_id bigint not null references workouts(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (workout_id, user_id)
);

create table if not exists notifications (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id bigserial primary key,
  workout_id bigint not null references workouts(id) on delete cascade,
  reviewer_id bigint not null references users(id) on delete cascade,
  reviewee_id bigint not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  text text,
  created_at timestamptz not null default now(),
  unique (workout_id, reviewer_id, reviewee_id),
  constraint no_self_review check (reviewer_id <> reviewee_id)
);

create table if not exists achievements (
  id bigserial primary key,
  code text not null unique,
  title text not null,
  description text not null,
  icon text not null,
  condition jsonb not null
);

create table if not exists user_achievements (
  user_id bigint not null references users(id) on delete cascade,
  achievement_id bigint not null references achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists reports (
  id bigserial primary key,
  reporter_id bigint not null references users(id) on delete cascade,
  reported_user_id bigint not null references users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'warned', 'banned', 'dismissed')),
  resolution_action text,
  moderator_comment text,
  ban_until timestamptz,
  moderator_id bigint references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table reports drop constraint if exists reports_status_check;
alter table reports add constraint reports_status_check check (status in ('open', 'reviewed', 'warned', 'banned', 'dismissed'));
alter table reports add column if not exists resolution_action text;
alter table reports add column if not exists moderator_comment text;
alter table reports add column if not exists ban_until timestamptz;
alter table reports add column if not exists updated_at timestamptz not null default now();

create table if not exists user_warnings (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  moderator_id bigint references users(id) on delete set null,
  report_id bigint references reports(id) on delete set null,
  reason text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists activity_feed (
  id bigserial primary key,
  type text not null,
  actor_id bigint references users(id) on delete set null,
  workout_id bigint references workouts(id) on delete cascade,
  target_user_id bigint references users(id) on delete set null,
  achievement_id bigint references achievements(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workouts_start_at on workouts(start_at);
create index if not exists idx_workouts_status on workouts(status);
create index if not exists idx_workout_participants_user on workout_participants(user_id);
create index if not exists idx_notifications_user_read on notifications(user_id, read_at);
create index if not exists idx_reports_status on reports(status);

alter table workouts drop constraint if exists workouts_status_check;
alter table workouts add constraint workouts_status_check check (status in ('planned', 'open', 'full', 'in_progress', 'completed', 'archived', 'cancelled'));

create or replace view user_training_stats as
select
  u.id as user_id,
  count(distinct organized.id) filter (where organized.status in ('completed', 'archived')) as organized_workouts,
  count(distinct attended.id) filter (where attended.status in ('completed', 'archived')) as attended_workouts,
  coalesce(sum(attended.distance_km) filter (where attended.status in ('completed', 'archived')), 0) as total_distance_km,
  round(avg(r.rating)::numeric, 2) as average_rating,
  count(distinct rep.id) as complaints_count
from users u
left join workouts organized on organized.organizer_id = u.id
left join workout_participants wp on wp.user_id = u.id and wp.status = 'confirmed'
left join workouts attended on attended.id = wp.workout_id
left join reviews r on r.reviewee_id = u.id
left join reports rep on rep.reported_user_id = u.id
group by u.id;

insert into system_settings (key, value) values
  ('require_verified_to_create_workouts', 'true'),
  ('require_email_verification', 'false'),
  ('require_phone_verification', 'false'),
  ('default_participant_limit', '20'),
  ('auto_block_complaints_count', '10'),
  ('workout_archive_retention_days', '90'),
  ('review_window_days', '7'),
  ('notification_retention_days', '30')
on conflict (key) do nothing;

insert into achievements (code, title, description, icon, condition) values
  ('first_finish', 'Первый финиш', 'Завершить первую тренировку', 'medal', '{"type":"completed_workouts","value":1}'),
  ('ten_runs', '10 тренировок', 'Завершить 10 тренировок', 'trophy', '{"type":"completed_workouts","value":10}'),
  ('hundred_km', '100 км', 'Набрать 100 км суммарной дистанции', 'route', '{"type":"distance_km","value":100}'),
  ('early_bird', 'Утренний старт', 'Завершить 3 утренние тренировки', 'sunrise', '{"type":"morning_workouts","value":3}')
on conflict (code) do nothing;
