import { requireAuth } from '@/lib/server/auth'
import { prisma } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request) => {
  await requireAuth(request)
  const rows = await prisma.activity_feed.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      users_activity_feed_actor_idTousers: { select: { full_name: true } },
      users_activity_feed_target_user_idTousers: { select: { full_name: true } },
      workouts: { select: { title: true } },
    },
  })

  return json({
    activities: rows.map((row) => ({
      ...row,
      actor_name: row.users_activity_feed_actor_idTousers?.full_name || null,
      target_name: row.users_activity_feed_target_user_idTousers?.full_name || null,
      workout_title: row.workouts?.title || null,
    })),
  })
})
