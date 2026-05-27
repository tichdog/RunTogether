import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile } from '@/lib/repositories/users'
import { json, route } from '@/lib/server/response'
import { saveImageUpload } from '@/lib/server/uploads'

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  const form = await request.formData()
  const avatarUrl = await saveImageUpload(form.get('avatar'))
  await prisma.users.update({
    where: { id: dbId(user.id) },
    data: { avatar_url: avatarUrl, updated_at: now() },
  })
  const profile = await getUserProfile(user.id)

  return json({ user: publicUser(profile, { viewer: user }) })
})
