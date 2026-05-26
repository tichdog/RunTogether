import { pool, query } from '../server/db'
import { createNotification } from '../services/notifications'
import { syncWorkoutStatus } from '../services/workouts'

export async function createReminderNotifications() {
  const { rows } = await query(
    `select w.id, w.title, w.start_at, wp.user_id
       from workouts w
       join workout_participants wp on wp.workout_id = w.id and wp.status = 'confirmed'
      where w.status in ('open', 'full')
        and w.start_at between now() and now() + interval '24 hours'
        and not exists (
          select 1 from notifications n
           where n.user_id = wp.user_id
             and n.type = 'workout_reminder'
             and n.payload->>'workoutId' = w.id::text
             and n.payload->>'window' = case
               when w.start_at <= now() + interval '1 hour' then '1h'
               else '24h'
             end
        )`
  )

  for (const row of rows) {
    const window = new Date(row.start_at).getTime() <= Date.now() + 60 * 60 * 1000 ? '1h' : '24h'
    await createNotification(pool, {
      userId: row.user_id,
      type: 'workout_reminder',
      title: window === '1h' ? 'Тренировка через час' : 'Тренировка завтра',
      message: row.title,
      payload: { workoutId: row.id, window },
      scheduledFor: row.start_at,
    })
  }

  return rows.length
}

export async function syncActiveWorkoutStatuses() {
  const { rows } = await query(
    "select id from workouts where status not in ('cancelled', 'completed')"
  )
  for (const row of rows) {
    await syncWorkoutStatus(pool, row.id)
  }
  return rows.length
}
