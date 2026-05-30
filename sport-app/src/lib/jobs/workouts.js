import { prisma } from '../server/db'
import { createNotification } from '../services/notifications'
import { getSettings } from '../services/settings'
import { syncWorkoutStatus } from '../services/workouts'

const EXPIRING_NOTIFICATION_TYPES = [
  'participation_request',
  'participation_response',
  'participation_removed',
  'workout_cancelled',
  'workout_changed',
  'workout_created',
  'workout_reminder',
  'workout_review',
]

export async function createReminderNotifications() {
  const now = new Date()
  const dayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const hourAhead = new Date(now.getTime() + 60 * 60 * 1000)
  const workouts = await prisma.workouts.findMany({
    where: {
      status: { in: ['open', 'full'] },
      start_at: { gte: now, lte: dayAhead },
    },
    include: {
      workout_participants: {
        where: { status: 'confirmed' },
        select: { user_id: true },
      },
    },
  })

  let created = 0
  for (const workout of workouts) {
    const window = new Date(workout.start_at).getTime() <= hourAhead.getTime() ? '1h' : '24h'
    for (const participant of workout.workout_participants) {
      const existing = await prisma.notifications.findFirst({
        where: {
          user_id: participant.user_id,
          type: 'workout_reminder',
          payload: {
            path: ['workoutId'],
            equals: workout.id.toString(),
          },
        },
      })
      if (existing?.payload?.window === window) continue

      await createNotification(prisma, {
        userId: participant.user_id,
        type: 'workout_reminder',
        title: window === '1h' ? 'Тренировка через час' : 'Тренировка завтра',
        message: workout.title,
        payload: { workoutId: workout.id, window },
        scheduledFor: workout.start_at,
      })
      created += 1
    }
  }

  return created
}

export async function syncActiveWorkoutStatuses() {
  const workouts = await prisma.workouts.findMany({
    where: { status: { notIn: ['cancelled', 'archived'] } },
    select: { id: true },
  })
  for (const row of workouts) {
    await syncWorkoutStatus(prisma, row.id)
  }
  return workouts.length
}

export async function deleteExpiredArchivedWorkouts() {
  const settings = await getSettings()
  const retentionDays = Math.max(1, Number(settings.workout_archive_retention_days) || 90)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.workouts.deleteMany({
    where: {
      status: 'archived',
      updated_at: { lt: cutoff },
    },
  })
  return result.count
}

export async function deleteExpiredNotifications() {
  const settings = await getSettings()
  const retentionDays = Math.max(1, Number(settings.notification_retention_days) || 30)
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.notifications.deleteMany({
    where: {
      type: { in: EXPIRING_NOTIFICATION_TYPES },
      created_at: { lt: cutoff },
    },
  })
  return result.count
}
