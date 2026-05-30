import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { publicUser } from '@/lib/mappers/user'
import { listUserProfiles } from '@/lib/repositories/users'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  const { searchParams } = new URL(request.url)
  const rows = await listUserProfiles({
    search: searchParams.get('search') || '',
    role: searchParams.get('role') || null,
    status: searchParams.get('status') || null,
  })

  return json({ users: rows.map((row) => publicUser(row, { viewer: user })) })
})
