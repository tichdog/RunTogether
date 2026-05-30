import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  const existing = await prisma.notifications.findFirst({
    where: { id: dbId(id), user_id: dbId(user.id) },
  })
  const notification = existing
    ? await prisma.notifications.update({
        where: { id: existing.id },
        data: { read_at: now() },
      })
    : null
  return json({ notification })
})
