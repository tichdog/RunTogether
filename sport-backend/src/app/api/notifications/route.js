import { requireAuth } from '@/lib/server/auth'
import { query } from '@/lib/server/db'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  const { rows } = await query(
    `select * from notifications
      where user_id = $1
      order by created_at desc
      limit 100`,
    [user.id]
  )
  return json({ notifications: rows })
})

export const PATCH = route(async (request) => {
  const user = await requireAuth(request)
  await query(
    `update notifications
        set read_at = coalesce(read_at, now())
      where user_id = $1
        and read_at is null`,
    [user.id]
  )
  const { rows } = await query(
    `select * from notifications
      where user_id = $1
      order by created_at desc
      limit 100`,
    [user.id]
  )
  return json({ notifications: rows })
})
