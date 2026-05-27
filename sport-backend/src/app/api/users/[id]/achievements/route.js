import { requireAuth, requireSelfOrAdmin } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  requireSelfOrAdmin(user, id)

  const rows = await prisma.user_achievements.findMany({
    where: { user_id: dbId(id) },
    orderBy: { earned_at: 'desc' },
    include: { achievements: true },
  })

  return json({
    achievements: rows.map((row) => ({ ...row.achievements, earned_at: row.earned_at })),
  })
})
