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

insert into system_settings (key, value)
values ('workout_archive_retention_days', '90')
on conflict (key) do nothing;
