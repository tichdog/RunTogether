import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
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

  await prisma.$transaction(async (tx) => {
    const workout = await getWorkoutRow(tx, id)

    if (!workout) {
      throw notFound('Тренировка не найдена')
    }

    if (isRemovingOtherUser && !isOwnerOrAdmin(user, workout)) {
      throw forbidden()
    }

    const existing = await tx.workout_participants.findFirst({
      where: {
        workout_id: dbId(id),
        user_id: dbId(targetUserId),
        status: { in: ['pending', 'confirmed'] },
      },
    })

    if (isRemovingOtherUser && !existing) {
      throw notFound('Участник не найден')
    }

    if (existing) {
      await tx.workout_participants.update({
        where: { id: existing.id },
        data: { status: 'cancelled', responded_at: now() },
      })
    }

    if (existing && isRemovingOtherUser) {
      await createNotification(tx, {
        userId: targetUserId,
        type: 'participation_removed',
        title: 'Участие в тренировке отменено',
        message: workout.title,
        payload: { workoutId: workout.id },
      })
    }

    await syncWorkoutStatus(tx, id)
  })

  return noContent()
})