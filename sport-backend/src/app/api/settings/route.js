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
  return json({ settings: await upsertSettings(await readJson(request)) })
})
