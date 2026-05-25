alter table users add column if not exists warning_count integer not null default 0;
alter table users add column if not exists blocked_until timestamptz;
alter table users add column if not exists block_reason text;

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
