import { requireAuth } from '@/lib/server/auth'
import { transaction } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { notifyWorkoutParticipants } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin } from '@/lib/repositories/workouts'
import { workoutPayload } from '@/lib/services/workouts'

export const POST = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const body = await readJson(request)
  const cancelled = await transaction(async (client) => {
    const workout = await getWorkoutRow(client, id, true)
    if (!workout) throw notFound('Тренировка не найдена')
    if (!isOwnerOrAdmin(user, workout)) throw forbidden()
    if (workout.status === 'completed') throw badRequest('Завершенную тренировку нельзя отменить')

    const { rows } = await client.query(
      `update workouts
          set status = 'cancelled', cancellation_reason = $2, cancelled_at = now(), updated_at = now()
        where id = $1
        returning *`,
      [id, body.reason || null]
    )

    await notifyWorkoutParticipants(client, id, {
      type: 'workout_cancelled',
      title: 'Тренировка отменена',
      message: workout.title,
    })
    return rows[0]
  })
  return json({ workout: workoutPayload(cancelled) })
})
