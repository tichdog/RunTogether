import { requireAuth } from '@/lib/server/auth'
import { transaction } from '@/lib/server/db'
import { forbidden, notFound } from '@/lib/server/http-error'
import { noContent, readJson, route } from '@/lib/server/response'
import { createNotification } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin } from '@/lib/repositories/workouts'
import { syncWorkoutStatus } from '@/lib/services/workouts'

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const body = await readJson(request)
  const targetUserId = body.userId || body.user_id || user.id
  const isRemovingOtherUser = Number(targetUserId) !== Number(user.id)

  await transaction(async (client) => {
    const workout = await getWorkoutRow(client, id, true)
    if (!workout) throw notFound('Тренировка не найдена')
    if (isRemovingOtherUser && !isOwnerOrAdmin(user, workout)) throw forbidden()

    const { rows } = await client.query(
      `update workout_participants
          set status = 'cancelled', responded_at = now()
        where workout_id = $1 and user_id = $2 and status in ('pending', 'confirmed')
        returning *`,
      [id, targetUserId]
    )
    if (isRemovingOtherUser && !rows[0]) throw notFound('Участник не найден')

    if (rows[0] && isRemovingOtherUser) {
      await createNotification(client, {
        userId: targetUserId,
        type: 'participation_removed',
        title: 'Участие в тренировке отменено',
        message: workout.title,
        payload: { workoutId: workout.id },
      })
    }

    await syncWorkoutStatus(client, id)
  })
  return noContent()
})
