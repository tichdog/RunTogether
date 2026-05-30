import { requireAuth, requireSelfOrAdmin } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

function monthKey(date) {
  const value = new Date(date)
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
}

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  requireSelfOrAdmin(user, id)

  const rows = await prisma.workout_participants.findMany({
    where: {
      user_id: dbId(id),
      status: 'confirmed',
      workouts: { status: { in: ['completed', 'archived'] } },
    },
    include: {
      workouts: {
        select: {
          start_at: true,
          distance_km: true,
        },
      },
    },
  })

  const grouped = new Map()
  for (const row of rows) {
    const month = monthKey(row.workouts.start_at)
    const key = month.toISOString()
    const item = grouped.get(key) || { month, workouts_count: 0, distance_km: 0 }
    item.workouts_count += 1
    item.distance_km += Number(row.workouts.distance_km)
    grouped.set(key, item)
  }

  return json({
    history: [...grouped.values()].sort((a, b) => b.month.getTime() - a.month.getTime()),
  })
})
