import { requireAuth } from '@/lib/server/auth'
import { query } from '@/lib/server/db'
import { forbidden } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'
import { parseWorkoutBody } from '@/lib/repositories/workouts'
import { syncWorkoutStatus, workoutPayload } from '@/lib/services/workouts'

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat') == null ? null : Number(searchParams.get('lat'))
  const lng = searchParams.get('lng') == null ? null : Number(searchParams.get('lng'))
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng)
  const radiusKm =
    hasGeo && searchParams.get('radiusKm') != null ? Number(searchParams.get('radiusKm')) : null
  const sort = searchParams.get('sort') === 'distance' && hasGeo ? 'distance' : 'time'
  const archiveOnly =
    searchParams.get('archiveOnly') === 'true' || searchParams.get('archive') === 'only'
  const includeArchived =
    archiveOnly ||
    searchParams.get('archive') === '1' ||
    searchParams.get('includeArchived') === 'true'

  const distanceExpr = hasGeo
    ? `(6371 * acos(least(1, greatest(-1,
         cos(radians($8::numeric)) * cos(radians(w.meeting_lat)) *
         cos(radians(w.meeting_lng) - radians($9::numeric)) +
         sin(radians($8::numeric)) * sin(radians(w.meeting_lat))
       ))))`
    : 'null'

  const params = [
    searchParams.get('dateFrom') || null,
    searchParams.get('dateTo') || null,
    searchParams.get('distanceMin') || null,
    searchParams.get('distanceMax') || null,
    searchParams.get('paceMax') || null,
    searchParams.get('difficulty') || null,
    radiusKm,
  ]

  if (hasGeo) {
    params.push(lat, lng)
  }
  const currentUserParam = params.length + 1
  params.push(user.id)

  const { rows } = await query(
    `select w.*, u.full_name as organizer_name,
            jsonb_build_object(
              'id', u.id,
              'name', u.full_name,
              'initials', upper(left(coalesce(u.first_name, u.full_name, u.email, 'U'), 1) || left(coalesce(u.last_name, ''), 1)),
              'avatarUrl', u.avatar_url,
              'role', u.role,
              'stats', jsonb_build_object('rating', os.average_rating)
            ) as organizer,
            coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', pu.id,
                'name', pu.full_name,
                'initials', upper(left(coalesce(pu.first_name, pu.full_name, pu.email, 'U'), 1) || left(coalesce(pu.last_name, ''), 1)),
                'avatarUrl', pu.avatar_url,
                'role', pu.role,
                'stats', jsonb_build_object('rating', ps.average_rating)
              ) order by pu.full_name)
                from workout_participants pwp
                join users pu on pu.id = pwp.user_id
                left join user_training_stats ps on ps.user_id = pu.id
               where pwp.workout_id = w.id and pwp.status = 'confirmed'
            ), '[]'::jsonb) as participants,
            count(wp.id) filter (where wp.status = 'confirmed') as confirmed_count,
            my_wp.status as participant_status,
            my_wp.id as participant_request_id,
            ${distanceExpr} as distance_from_user_km
       from workouts w
       join users u on u.id = w.organizer_id
       left join user_training_stats os on os.user_id = u.id
       left join workout_participants wp on wp.workout_id = w.id
       left join workout_participants my_wp on my_wp.workout_id = w.id and my_wp.user_id = $${currentUserParam}
      where ($1::timestamptz is null or w.start_at >= $1)
        and ($2::timestamptz is null or w.start_at <= $2)
        and ($3::numeric is null or w.distance_km >= $3)
        and ($4::numeric is null or w.distance_km <= $4)
        and ($5::numeric is null or w.pace_min_per_km <= $5)
        and ($6::text is null or w.difficulty = $6)
        and ($7::numeric is null or ${distanceExpr} <= $7)
        and (
          not ($${currentUserParam + 1}::boolean)
          or w.status = 'archived'
          or (
            w.status <> 'cancelled'
            and now() >= w.start_at + ((w.duration_minutes + 1440) || ' minutes')::interval
          )
        )
        and ($${currentUserParam + 2}::boolean or $${currentUserParam + 1}::boolean or w.status <> 'archived')
      group by w.id, u.id, os.average_rating, my_wp.status, my_wp.id
      order by ${
        sort === 'distance'
          ? 'distance_from_user_km nulls last, w.created_at desc, w.start_at desc'
          : 'w.created_at desc, w.start_at desc'
      }
      limit 100`,
    [...params, archiveOnly, includeArchived]
  )

  const syncedRows = await Promise.all(
    rows.map(async (row) => {
      const synced = await syncWorkoutStatus(query, row.id)
      return synced ? { ...row, status: synced.status, updated_at: synced.updated_at } : row
    })
  )
  return json({
    workouts: syncedRows
      .filter((row) => {
        if (archiveOnly) return row.status === 'archived'
        return includeArchived || row.status !== 'archived'
      })
      .map((row) => workoutPayload(row, user)),
  })
})

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  const settings = await getSettings()
  if (settings.require_verified_to_create_workouts && !user.phone_verified) {
    throw forbidden('Создание тренировок доступно только пользователям с подтвержденным телефоном')
  }

  const data = parseWorkoutBody(await readJson(request))
  const { rows } = await query(
    `insert into workouts (
      organizer_id, title, description, start_at, duration_minutes, meeting_point_name,
      meeting_point_address, meeting_lat, meeting_lng, route_name, route_geojson,
      distance_km, pace_min_per_km, difficulty, participant_limit, status
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,'open')
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
    ]
  )

  await query(
    `insert into activity_feed (type, actor_id, workout_id, metadata)
     values ('workout_created', $1, $2, $3::jsonb)`,
    [user.id, rows[0].id, JSON.stringify({ title: rows[0].title })]
  )

  return json(
    {
      workout: workoutPayload(
        { ...rows[0], organizer_name: user.full_name, confirmed_count: 0 },
        user
      ),
    },
    201
  )
})
