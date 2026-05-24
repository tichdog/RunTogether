const ACTIVE_WORKOUT_STATUSES = ["planned", "open", "full", "in_progress"];
const ACTIVE_PARTICIPATION_STATUSES = ["confirmed", "pending"];

export async function lockParticipationForUser(client, userId) {
  await client.query("select pg_advisory_xact_lock($1::bigint)", [userId]);
}

export async function findParticipationConflict(client, userId, workout, options = {}) {
  const {
    excludeWorkoutId = workout.id,
    participationStatuses = ACTIVE_PARTICIPATION_STATUSES,
    includeOrganized = true,
  } = options;

  const { rows } = await client.query(
    `with candidate_workouts as (
       select w.id,
              w.title,
              w.start_at,
              w.duration_minutes,
              wp.status as participation_status,
              false as is_organizer
         from workout_participants wp
         join workouts w on w.id = wp.workout_id
        where wp.user_id = $1
          and wp.status = any($5::text[])
          and w.status = any($6::text[])
          and ($4::bigint is null or w.id <> $4::bigint)
       union all
       select w.id,
              w.title,
              w.start_at,
              w.duration_minutes,
              'confirmed' as participation_status,
              true as is_organizer
         from workouts w
        where $7::boolean
          and w.organizer_id = $1
          and w.status = any($6::text[])
          and ($4::bigint is null or w.id <> $4::bigint)
     )
     select *
       from candidate_workouts
      where start_at < ($2::timestamptz + make_interval(mins => $3::int))
        and (start_at + make_interval(mins => duration_minutes::int)) > $2::timestamptz
      order by case participation_status
                 when 'confirmed' then 0
                 when 'pending' then 1
                 else 2
               end,
               start_at,
               id
      limit 1`,
    [
      userId,
      workout.start_at,
      Number(workout.duration_minutes || 60),
      excludeWorkoutId,
      participationStatuses,
      ACTIVE_WORKOUT_STATUSES,
      includeOrganized,
    ],
  );

  return rows[0] || null;
}

export async function cancelOverlappingPendingRequests(client, userId, workout) {
  const { rows } = await client.query(
    `update workout_participants wp
        set status = 'cancelled',
            responded_at = now()
       from workouts w
      where w.id = wp.workout_id
        and wp.user_id = $1
        and wp.status = 'pending'
        and w.status = any($5::text[])
        and w.id <> $4::bigint
        and w.start_at < ($2::timestamptz + make_interval(mins => $3::int))
        and (w.start_at + make_interval(mins => w.duration_minutes::int)) > $2::timestamptz
      returning wp.*, w.title, w.organizer_id`,
    [
      userId,
      workout.start_at,
      Number(workout.duration_minutes || 60),
      workout.id,
      ACTIVE_WORKOUT_STATUSES,
    ],
  );

  return rows;
}

export function participationConflictMessage(conflict, subject = "Вы") {
  const isCurrentUser = subject === "Вы";

  if (conflict.is_organizer) {
    const verb = isCurrentUser ? "организуете" : "организует";
    return `${subject} уже ${verb} тренировку в это время: ${conflict.title}`;
  }

  if (conflict.participation_status === "confirmed") {
    const verb = isCurrentUser ? "подтверждены" : "подтвержден";
    return `${subject} уже ${verb} на тренировку в это время: ${conflict.title}`;
  }

  const verb = isCurrentUser ? "отправили" : "отправил";
  return `${subject} уже ${verb} заявку на тренировку в это время: ${conflict.title}`;
}
