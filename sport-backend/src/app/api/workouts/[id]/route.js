import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { notifyWorkoutParticipants } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin, parseWorkoutBody } from '@/lib/repositories/workouts'
import {
  buildWorkoutRows,
  syncWorkoutStatus,
  workoutInclude,
  workoutPayload,
} from '@/lib/services/workouts'

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  await syncWorkoutStatus(prisma, id)
  const workout = await prisma.workouts.findUnique({
    where: { id: dbId(id) },
    include: workoutInclude,
  })
  if (!workout) throw notFound('РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°')
  const [row] = await buildWorkoutRows([workout], user)
  return json({ workout: workoutPayload(row, user) })
})

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const data = parseWorkoutBody(await readJson(request))
  const updated = await prisma.$transaction(async (tx) => {
    const workout = await getWorkoutRow(tx, id)
    if (!workout) throw notFound('РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°')
    if (!isOwnerOrAdmin(user, workout)) throw forbidden()
    if (new Date(workout.start_at) <= new Date()) {
      throw badRequest(
        'РўСЂРµРЅРёСЂРѕРІРєСѓ РјРѕР¶РЅРѕ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РґРѕ РЅР°С‡Р°Р»Р°'
      )
    }
    if (workout.status === 'cancelled') {
      throw badRequest(
        'РћС‚РјРµРЅРµРЅРЅСѓСЋ С‚СЂРµРЅРёСЂРѕРІРєСѓ РЅРµР»СЊР·СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ'
      )
    }

    const row = await tx.workouts.update({
      where: { id: dbId(id) },
      data: {
        title: data.title,
        description: data.description,
        start_at: new Date(data.startAt),
        duration_minutes: data.durationMinutes,
        meeting_point_name: data.meetingPoint.name,
        meeting_point_address: data.meetingPoint.address || null,
        meeting_lat: data.meetingPoint.lat || null,
        meeting_lng: data.meetingPoint.lng || null,
        route_name: data.route.name,
        route_geojson: data.route.geojson || null,
        distance_km: data.distanceKm,
        pace_min_per_km: data.paceMinPerKm,
        difficulty: data.difficulty,
        participant_limit: data.participantLimit,
        updated_at: now(),
      },
      include: workoutInclude,
    })

    await notifyWorkoutParticipants(tx, id, {
      type: 'workout_changed',
      title: 'Тренировка изменена',
      message: data.title,
    })
    return row
  })

  const [row] = await buildWorkoutRows([updated], user)
  return json({ workout: workoutPayload(row, user) })
})
