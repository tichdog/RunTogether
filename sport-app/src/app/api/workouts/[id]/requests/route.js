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

    if (!workout) {
      throw notFound('Тренировка не найдена')
    }

    const synced = await syncWorkoutStatus(tx, id)
    workout.status = synced?.status || workout.status

    if (Number(workout.organizer_id) === Number(user.id)) {
      throw badRequest('Организатор уже участвует в тренировке')
    }

    if (!['open', 'planned'].includes(workout.status)) {
      throw badRequest('Набор закрыт')
    }

    if (Number(workout.confirmed_count) >= Number(workout.participant_limit)) {
      throw badRequest('Свободных мест нет')
    }

    await lockParticipationForUser(tx, user.id)

    const currentRequest = await tx.workout_participants.findFirst({
      where: {
        workout_id: dbId(id),
        user_id: dbId(user.id),
      },
    })

    if (currentRequest?.status === 'confirmed') {
      throw badRequest('Вы уже участвуете в этой тренировке')
    }

    if (currentRequest?.status === 'pending') {
      throw badRequest('Заявка уже на рассмотрении')
    }

    const conflict = await findParticipationConflict(tx, user.id, workout)

    if (conflict) {
      throw badRequest(participationConflictMessage(conflict))
    }

    const row = currentRequest
      ? await tx.workout_participants.update({
          where: { id: currentRequest.id },
          data: {
            status: 'pending',
            requested_at: now(),
            responded_at: null,
          },
        })
      : await tx.workout_participants.create({
          data: {
            workout_id: dbId(id),
            user_id: dbId(user.id),
            status: 'pending',
          },
        })

    await createNotification(tx, {
      userId: workout.organizer_id,
      type: 'participation_request',
      title: 'Новая заявка на тренировку',
      message: workout.title,
      payload: {
        workoutId: workout.id,
        requestId: row.id,
        userId: user.id,
      },
    })

    return row
  })

  return json({ request: participant }, 201)
})

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params

  const workout = await prisma.workouts.findUnique({
    where: { id: dbId(id) },
  })

  if (!workout) {
    throw notFound('Тренировка не найдена')
  }

  if (!isOwnerOrAdmin(user, workout)) {
    throw forbidden()
  }

  const rows = await prisma.workout_participants.findMany({
    where: { workout_id: dbId(id) },
    orderBy: { requested_at: 'desc' },
    include: {
      users: {
        select: {
          full_name: true,
          email: true,
        },
      },
    },
  })

  return json({
    requests: rows.map((row) => ({
      ...row,
      full_name: row.users.full_name,
      email: row.users.email,
    })),
  })
})
