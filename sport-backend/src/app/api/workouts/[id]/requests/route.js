import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, route } from '@/lib/server/response'
import { createNotification } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin } from '@/lib/repositories/workouts'
import { syncWorkoutStatus } from '@/lib/services/workouts'
import {
  findParticipationConflict,
  lockParticipationForUser,
  participationConflictMessage,
} from '@/lib/services/participation-conflicts'

export const POST = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const participant = await prisma.$transaction(async (tx) => {
    const workout = await getWorkoutRow(tx, id)
    if (!workout) throw notFound('РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°')
    const synced = await syncWorkoutStatus(tx, id)
    workout.status = synced?.status || workout.status
    if (Number(workout.organizer_id) === Number(user.id))
      throw badRequest('РћСЂРіР°РЅРёР·Р°С‚РѕСЂ СѓР¶Рµ СѓС‡Р°СЃС‚РІСѓРµС‚ РІ С‚СЂРµРЅРёСЂРѕРІРєРµ')
    if (!['open', 'planned'].includes(workout.status)) throw badRequest('РќР°Р±РѕСЂ Р·Р°РєСЂС‹С‚')
    if (Number(workout.confirmed_count) >= Number(workout.participant_limit))
      throw badRequest('РЎРІРѕР±РѕРґРЅС‹С… РјРµСЃС‚ РЅРµС‚')

    await lockParticipationForUser(tx, user.id)

    const currentRequest = await tx.workout_participants.findFirst({
      where: { workout_id: dbId(id), user_id: dbId(user.id) },
    })
    if (currentRequest?.status === 'confirmed') {
      throw badRequest('Р’С‹ СѓР¶Рµ СѓС‡Р°СЃС‚РІСѓРµС‚Рµ РІ СЌС‚РѕР№ С‚СЂРµРЅРёСЂРѕРІРєРµ')
    }
    if (currentRequest?.status === 'pending') {
      throw badRequest('Р—Р°СЏРІРєР° СѓР¶Рµ РЅР° СЂР°СЃСЃРјРѕС‚СЂРµРЅРёРё')
    }

    const conflict = await findParticipationConflict(tx, user.id, workout)
    if (conflict) {
      throw badRequest(participationConflictMessage(conflict))
    }

    const row = currentRequest
      ? await tx.workout_participants.update({
          where: { id: currentRequest.id },
          data: { status: 'pending', requested_at: now(), responded_at: null },
        })
      : await tx.workout_participants.create({
          data: { workout_id: dbId(id), user_id: dbId(user.id), status: 'pending' },
        })

    await createNotification(tx, {
      userId: workout.organizer_id,
      type: 'participation_request',
      title: 'Новая заявка на тренировку',
      message: workout.title,
      payload: { workoutId: workout.id, requestId: row.id, userId: user.id },
    })
    return row
  })
  return json({ request: participant }, 201)
})

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const workout = await prisma.workouts.findUnique({ where: { id: dbId(id) } })
  if (!workout) throw notFound('РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°')
  if (!isOwnerOrAdmin(user, workout)) throw forbidden()

  const rows = await prisma.workout_participants.findMany({
    where: { workout_id: dbId(id) },
    orderBy: { requested_at: 'desc' },
    include: { users: { select: { full_name: true, email: true } } },
  })
  return json({
    requests: rows.map((row) => ({
      ...row,
      full_name: row.users.full_name,
      email: row.users.email,
    })),
  })
})
