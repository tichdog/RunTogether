import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { forbidden } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { getSettings } from "@/lib/services/settings";
import { parseWorkoutBody } from "@/lib/repositories/workouts";
import { syncWorkoutStatus, workoutPayload } from "@/lib/services/workouts";

export const GET = route(async request => {
  await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat") == null ? null : Number(searchParams.get("lat"));
  const lng = searchParams.get("lng") == null ? null : Number(searchParams.get("lng"));
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
  const radiusKm = hasGeo && searchParams.get("radiusKm") != null ? Number(searchParams.get("radiusKm")) : null;
  const sort = searchParams.get("sort") === "distance" && hasGeo ? "distance" : "time";

  const distanceExpr = hasGeo
    ? `(6371 * acos(least(1, greatest(-1,
         cos(radians($8::numeric)) * cos(radians(w.meeting_lat)) *
         cos(radians(w.meeting_lng) - radians($9::numeric)) +
         sin(radians($8::numeric)) * sin(radians(w.meeting_lat))
       ))))`
    : "null";

  const params = [
    searchParams.get("dateFrom") || null,
    searchParams.get("dateTo") || null,
    searchParams.get("distanceMin") || null,
    searchParams.get("distanceMax") || null,
    searchParams.get("paceMax") || null,
    searchParams.get("difficulty") || null,
    radiusKm,
  ];

  if (hasGeo) {
    params.push(lat, lng);
  }

  const { rows } = await query(
    `select w.*, u.full_name as organizer_name,
            count(wp.id) filter (where wp.status = 'confirmed') as confirmed_count,
            ${distanceExpr} as distance_from_user_km
       from workouts w
       join users u on u.id = w.organizer_id
       left join workout_participants wp on wp.workout_id = w.id
      where ($1::timestamptz is null or w.start_at >= $1)
        and ($2::timestamptz is null or w.start_at <= $2)
        and ($3::numeric is null or w.distance_km >= $3)
        and ($4::numeric is null or w.distance_km <= $4)
        and ($5::numeric is null or w.pace_min_per_km <= $5)
        and ($6::text is null or w.difficulty = $6)
        and ($7::numeric is null or ${distanceExpr} <= $7)
      group by w.id, u.full_name
      order by ${sort === "distance" ? "distance_from_user_km nulls last, w.start_at" : "w.start_at"}
      limit 100`,
    params,
  );

  await Promise.all(rows.map(row => syncWorkoutStatus(query, row.id)));
  return json({ workouts: rows.map(workoutPayload) });
});

export const POST = route(async request => {
  const user = await requireAuth(request);
  const settings = await getSettings();
  if (settings.require_verified_to_create_workouts && !user.phone_verified) {
    throw forbidden("Создание тренировок доступно только пользователям с подтвержденным телефоном");
  }

  const data = parseWorkoutBody(await readJson(request));
  const { rows } = await query(
    `insert into workouts (
      organizer_id, title, description, start_at, duration_minutes, meeting_point_name,
      meeting_point_address, meeting_lat, meeting_lng, route_name, route_geojson,
      distance_km, pace_min_per_km, difficulty, participant_limit, status
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,'planned')
    returning *`,
    [
      user.id,
      data.title,
      data.description,
      data.startAt,
      data.durationMinutes,
      data.meetingPoint.name,
      data.meetingPoint.address || null,
      data.meetingPoint.lat || null,
      data.meetingPoint.lng || null,
      data.route.name,
      JSON.stringify(data.route.geojson || null),
      data.distanceKm,
      data.paceMinPerKm,
      data.difficulty,
      data.participantLimit,
    ],
  );

  await query(
    `insert into activity_feed (type, actor_id, workout_id, metadata)
     values ('workout_created', $1, $2, $3::jsonb)`,
    [user.id, rows[0].id, JSON.stringify({ title: rows[0].title })],
  );

  return json(
    { workout: workoutPayload({ ...rows[0], organizer_name: user.full_name, confirmed_count: 0 }) },
    201,
  );
});
