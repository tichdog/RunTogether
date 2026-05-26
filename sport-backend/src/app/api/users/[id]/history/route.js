import { requireAuth, requireSelfOrAdmin } from '@/lib/server/auth'
import { query } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  requireSelfOrAdmin(user, id)

  const { rows } = await query(
    `select date_trunc('month', w.start_at) as month,
            count(*) as workouts_count,
            coalesce(sum(w.distance_km), 0) as distance_km
       from workout_participants wp
       join workouts w on w.id = wp.workout_id
      where wp.user_id = $1 and wp.status = 'confirmed' and w.status = 'completed'
      group by 1
      order by 1 desc`,
    [id]
  )
  return json({ history: rows })
})
