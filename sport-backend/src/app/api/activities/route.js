import { requireAuth } from '@/lib/server/auth'
import { query } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request) => {
  await requireAuth(request)
  const { rows } = await query(
    `select af.*, actor.full_name as actor_name, target.full_name as target_name, w.title as workout_title
       from activity_feed af
       left join users actor on actor.id = af.actor_id
       left join users target on target.id = af.target_user_id
       left join workouts w on w.id = af.workout_id
      order by af.created_at desc
      limit 100`
  )
  return json({ activities: rows })
})
