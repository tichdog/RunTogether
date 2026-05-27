import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  const notifications = await prisma.notifications.findMany({
    where: { user_id: dbId(user.id) },
    orderBy: { created_at: 'desc' },
    take: 100,
  })
  return json({ notifications })
})

export const PATCH = route(async (request) => {
  const user = await requireAuth(request)
  await prisma.notifications.updateMany({
    where: { user_id: dbId(user.id), read_at: null },
    data: { read_at: now() },
  })
  const notifications = await prisma.notifications.findMany({
    where: { user_id: dbId(user.id) },
    orderBy: { created_at: 'desc' },
    take: 100,
  })
  return json({ notifications })
})
