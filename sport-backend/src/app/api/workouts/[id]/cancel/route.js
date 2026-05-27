import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { notifyWorkoutParticipants } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin } from '@/lib/repositories/workouts'
import { buildWorkoutRows, workoutInclude, workoutPayload } from '@/lib/services/workouts'

export const POST = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const body = await readJson(request)
  const cancelled = await prisma.$transaction(async (tx) => {
    const workout = await getWorkoutRow(tx, id)
    if (!workout) throw notFound('РўСЂРµРЅРёСЂРѕРІРєР° РЅРµ РЅР°Р№РґРµРЅР°')
    if (!isOwnerOrAdmin(user, workout)) throw forbidden()
    if (['completed', 'archived'].includes(workout.status))
      throw badRequest('Р—Р°РІРµСЂС€РµРЅРЅСѓСЋ С‚СЂРµРЅРёСЂРѕРІРєСѓ РЅРµР»СЊР·СЏ РѕС‚РјРµРЅРёС‚СЊ')

    const row = await tx.workouts.update({
      where: { id: dbId(id) },
      data: {
        status: 'cancelled',
        cancellation_reason: body.reason || null,
        cancelled_at: now(),
        updated_at: now(),
      },
      include: workoutInclude,
    })

    await notifyWorkoutParticipants(tx, id, {
      type: 'workout_cancelled',
      title: 'Тренировка отменена',
      message: workout.title,
    })
    return row
  })
  const [row] = await buildWorkoutRows([cancelled], user)
  return json({ workout: workoutPayload(row, user) })
})
