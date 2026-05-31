import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile, getUserRole, replaceUserAvatar } from '@/lib/repositories/users'
import { json, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'
import { deleteImageUpload, saveImageUpload } from '@/lib/server/uploads'

export const POST = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params
  const target = await getUserRole(id)

  if (!target) throw notFound('Пользователь не найден')

  if (Number(target.id) !== Number(user.id) && isAdmin(target) && user.role !== 'super_admin') {
    throw forbidden('Аватар админов может менять только супер-админ')
  }

  const form = await request.formData()
  const avatarUrl = await saveImageUpload(form.get('avatar'))

  let previousAvatarUrl
  try {
    previousAvatarUrl = await replaceUserAvatar(id, avatarUrl)
  } catch (error) {
    await deleteImageUpload(avatarUrl)
    throw error
  }

  if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
    await deleteImageUpload(previousAvatarUrl)
  }

  const profile = await getUserProfile(id)
  return json({ user: publicUser(profile, { viewer: user, settings: await getSettings() }) })
})
