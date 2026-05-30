import { env } from '@/lib/server/env'
import { HttpError } from '@/lib/server/http-error'
import { json, route } from '@/lib/server/response'
import {
  createReminderNotifications,
  deleteExpiredArchivedWorkouts,
  deleteExpiredNotifications,
  syncActiveWorkoutStatuses,
} from '@/lib/jobs/workouts'

function assertCronAccess(request) {
  if (!env.cronSecret) return

  const header = request.headers.get('authorization') || ''
  if (header !== `Bearer ${env.cronSecret}`) {
    throw new HttpError(401, 'Недействительный cron token')
  }
}

export const POST = route(async (request) => {
  assertCronAccess(request)
  const syncedWorkouts = await syncActiveWorkoutStatuses()
  const [remindersCreated, archivedDeleted, notificationsDeleted] = await Promise.all([
    createReminderNotifications(),
    deleteExpiredArchivedWorkouts(),
    deleteExpiredNotifications(),
  ])

  return json({ ok: true, syncedWorkouts, remindersCreated, archivedDeleted, notificationsDeleted })
})
