import { json, route } from '@/lib/server/response'

export const GET = route(async () => {
  return json({ ok: true })
})
