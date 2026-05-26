import { env } from '@/lib/server/env'
import { HttpError } from '@/lib/server/http-error'
import { json, route } from '@/lib/server/response'
import { createReminderNotifications, syncActiveWorkoutStatuses } from '@/lib/jobs/workouts'

function assertCronAccess(request) {
  if (!env.cronSecret) return

  const header = request.headers.get('authorization') || ''
  if (header !== `Bearer ${env.cronSecret}`) {
    throw new HttpError(401, 'Недействительный cron token')
  }
}

export const POST = route(async (request) => {
  assertCronAccess(request)
  const [syncedWorkouts, remindersCreated] = await Promise.all([
    syncActiveWorkoutStatuses(),
    createReminderNotifications(),
  ])

  return json({ ok: true, syncedWorkouts, remindersCreated })
})
