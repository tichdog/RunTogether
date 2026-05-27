import { requireAuth } from '@/lib/server/auth'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile } from '@/lib/repositories/users'
import { json, route } from '@/lib/server/response'

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  const profile = await getUserProfile(user.id)
  return json({ user: publicUser(profile, { viewer: user }) })
})
