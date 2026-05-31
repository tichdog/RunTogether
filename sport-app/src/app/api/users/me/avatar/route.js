import { requireAuth } from '@/lib/server/auth'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile, replaceUserAvatar } from '@/lib/repositories/users'
import { json, route } from '@/lib/server/response'
import { deleteImageUpload, saveImageUpload } from '@/lib/server/uploads'

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  const form = await request.formData()
  const avatarUrl = await saveImageUpload(form.get('avatar'))

  let previousAvatarUrl
  try {
    previousAvatarUrl = await replaceUserAvatar(user.id, avatarUrl)
  } catch (error) {
    await deleteImageUpload(avatarUrl)
    throw error
  }

  if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
    await deleteImageUpload(previousAvatarUrl)
  }

  const profile = await getUserProfile(user.id)

  return json({ user: publicUser(profile, { viewer: user }) })
})
