import { requireAuth } from '@/lib/server/auth'
import { query, transaction } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { notifyWorkoutParticipants } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin, parseWorkoutBody } from '@/lib/repositories/workouts'
import { syncWorkoutStatus, workoutPayload } from '@/lib/services/workouts'

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  await syncWorkoutStatus(query, id)
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
            my_wp.id as participant_request_id
       from workouts w
       join users u on u.id = w.organizer_id
       left join user_training_stats os on os.user_id = u.id
       left join workout_participants wp on wp.workout_id = w.id
       left join workout_participants my_wp on my_wp.workout_id = w.id and my_wp.user_id = $2
      where w.id = $1
      group by w.id, u.id, os.average_rating, my_wp.status, my_wp.id`,
    [id, user.id]
  )
  if (!rows[0]) throw notFound('Тренировка не найдена')
  return json({ workout: workoutPayload(rows[0], user) })
})

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const data = parseWorkoutBody(await readJson(request))
  const updated = await transaction(async (client) => {
    const workout = await getWorkoutRow(client, id, true)
    if (!workout) throw notFound('Тренировка не найдена')
    if (!isOwnerOrAdmin(user, workout)) throw forbidden()
    if (new Date(workout.start_at) <= new Date()) {
      throw badRequest('Тренировку можно редактировать только до начала')
    }
    if (workout.status === 'cancelled') {
      throw badRequest('Отмененную тренировку нельзя редактировать')
    }

    const { rows } = await client.query(
      `update workouts
          set title = $2, description = $3, start_at = $4, duration_minutes = $5,
              meeting_point_name = $6, meeting_point_address = $7, meeting_lat = $8,
              meeting_lng = $9, route_name = $10, route_geojson = $11::jsonb,
              distance_km = $12, pace_min_per_km = $13, difficulty = $14,
              participant_limit = $15, updated_at = now()
        where id = $1
        returning *`,
      [
        id,
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

    await notifyWorkoutParticipants(client, id, {
      type: 'workout_changed',
      title: 'Тренировка изменена',
      message: data.title,
    })
    return rows[0]
  })

  return json({ workout: workoutPayload(updated, user) })
})
