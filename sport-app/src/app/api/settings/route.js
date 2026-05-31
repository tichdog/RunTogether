import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { json, readJson, route } from '@/lib/server/response'
import { getSettings, upsertSettings } from '@/lib/services/settings'

export const GET = route(async (request) => {
  await requireAuth(request)
  return json({ settings: await getSettings() })
})

export const PATCH = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const values = await readJson(request)
  if (user.role !== 'super_admin') {
    delete values.workout_archive_retention_days
    delete values.admins_can_view_user_emails
    delete values.admins_can_view_user_phones
  }
  return json({ settings: await upsertSettings(values) })
})
