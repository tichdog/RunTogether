import { query } from "../server/db";

const TERMINAL = new Set(["cancelled", "completed"]);

export function deriveWorkoutStatus(workout, confirmedCount = 0, now = new Date()) {
  if (!workout || workout.status === "cancelled") return workout?.status;
  const start = new Date(workout.start_at);
  const end = new Date(start.getTime() + Number(workout.duration_minutes || 60) * 60000);

  if (now >= end) return "completed";
  if (now >= start) return "in_progress";
  if (Number(confirmedCount) >= Number(workout.participant_limit)) return "full";
  return "open";
}

export async function syncWorkoutStatus(clientOrPool, workoutId) {
  const runner = clientOrPool?.query ? clientOrPool : null;
  const exec = (text, params) => (runner ? runner.query(text, params) : query(text, params));

  const { rows } = await exec(
    `select w.*,
            count(wp.id) filter (where wp.status = 'confirmed') as confirmed_count
       from workouts w
       left join workout_participants wp on wp.workout_id = w.id
      where w.id = $1
      group by w.id`,
    [workoutId],
  );

  const workout = rows[0];
  if (!workout || TERMINAL.has(workout.status)) return workout;

  const nextStatus = deriveWorkoutStatus(workout, workout.confirmed_count);
  if (nextStatus !== workout.status) {
    const updated = await exec(
      "update workouts set status = $2, updated_at = now() where id = $1 returning *",
      [workoutId, nextStatus],
    );
    return updated.rows[0];
  }
  return workout;
}

export function workoutPayload(row) {
  const confirmed = Number(row.confirmed_count || 0);
  return {
    id: row.id,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    durationMinutes: Number(row.duration_minutes),
    meetingPoint: {
      name: row.meeting_point_name,
      address: row.meeting_point_address,
      lat: row.meeting_lat == null ? null : Number(row.meeting_lat),
      lng: row.meeting_lng == null ? null : Number(row.meeting_lng),
    },
    route: {
      name: row.route_name,
      geojson: row.route_geojson,
    },
    distanceKm: Number(row.distance_km),
    paceMinPerKm: Number(row.pace_min_per_km),
    difficulty: row.difficulty,
    participantLimit: Number(row.participant_limit),
    confirmedCount: confirmed,
    freePlaces: Math.max(0, Number(row.participant_limit) - confirmed),
    status: row.status,
    participantStatus: row.participant_status || null,
    participantRequestId: row.participant_request_id == null ? null : Number(row.participant_request_id),
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    distanceFromUserKm: row.distance_from_user_km == null ? null : Number(row.distance_from_user_km),
  };
}
