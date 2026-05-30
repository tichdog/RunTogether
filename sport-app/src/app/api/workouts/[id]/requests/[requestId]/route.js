import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { createNotification } from '@/lib/services/notifications'
import { getWorkoutRow, isOwnerOrAdmin } from '@/lib/repositories/workouts'
import { syncWorkoutStatus } from '@/lib/services/workouts'
import {
  cancelOverlappingPendingRequests,
  findParticipationConflict,
  lockParticipationForUser,
  participationConflictMessage,
} from '@/lib/services/participation-conflicts'

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id, requestId } = await context.params
  const body = await readJson(request)
  const status = body.status

  if (!['confirmed', 'declined'].includes(status)) {
    throw badRequest('Статус должен быть confirmed или declined')
  }

  const result = await prisma.$transaction(async (tx) => {
    const workout = await getWorkoutRow(tx, id)

    if (!workout) {
      throw notFound('Тренировка не найдена')
    }

    if (!isOwnerOrAdmin(user, workout)) {
      throw forbidden()
    }

    const syncedWorkout = await syncWorkoutStatus(tx, id)
    workout.status = syncedWorkout?.status || workout.status

    if (!['open', 'planned', 'full'].includes(workout.status)) {
      throw badRequest('Нельзя изменять заявки после завершения тренировки')
    }

    const existingRequest = await tx.workout_participants.findFirst({
      where: { id: dbId(requestId), workout_id: dbId(id) },
    })

    if (!existingRequest) {
      throw notFound('Заявка не найдена')
    }

    if (status === 'confirmed') {
      await lockParticipationForUser(tx, existingRequest.user_id)

      if (
        existingRequest.status !== 'confirmed' &&
        Number(workout.confirmed_count) >= Number(workout.participant_limit)
      ) {
        throw badRequest('Свободных мест нет')
      }

      const conflict = await findParticipationConflict(tx, existingRequest.user_id, workout, {
        participationStatuses: ['confirmed'],
      })

      if (conflict) {
        throw badRequest(participationConflictMessage(conflict, 'Участник'))
      }

      await cancelOverlappingPendingRequests(tx, existingRequest.user_id, workout)
    }

    const row = await tx.workout_participants.update({
      where: { id: existingRequest.id },
      data: { status, responded_at: now() },
    })

    await createNotification(tx, {
      userId: row.user_id,
      type: 'participation_response',
      title: status === 'confirmed' ? 'Заявка подтверждена' : 'Заявка отклонена',
      message: workout.title,
      payload: { workoutId: workout.id, status },
    })

    const synced = await syncWorkoutStatus(tx, id)

    return { request: row, workout: synced }
  })

  return json(result)
})
