import { dbId, prisma } from '../server/db'

function jsonValue(value) {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(jsonValue)
  if (!value || typeof value !== 'object' || value instanceof Date) return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, jsonValue(nested)]))
}

export async function createNotification(
  client = prisma,
  { userId, type, title, message, payload = {}, scheduledFor = null }
) {
  return client.notifications.create({
    data: {
      user_id: dbId(userId),
      type,
      title,
      message,
      payload: jsonValue(payload),
      scheduled_for: scheduledFor,
    },
  })
}

export async function notifyWorkoutParticipants(client = prisma, workoutId, notification) {
  const participants = await client.workout_participants.findMany({
    where: {
      workout_id: dbId(workoutId),
      status: 'confirmed',
    },
    select: { user_id: true },
  })

  for (const row of participants) {
    await createNotification(client, {
      userId: row.user_id,
      payload: { workoutId, ...(notification.payload || {}) },
      ...notification,
    })
  }
}
