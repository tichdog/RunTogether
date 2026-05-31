import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile, getUserRole } from '@/lib/repositories/users'
import { json, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'
import { saveImageUpload } from '@/lib/server/uploads'

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

  const updated = await prisma.users.update({
    where: { id: dbId(id) },
    data: { avatar_url: avatarUrl, updated_at: now() },
  })

  if (!updated) throw badRequest('Аватар не удалось сохранить')

  const profile = await getUserProfile(id)
  return json({ user: publicUser(profile, { viewer: user, settings: await getSettings() }) })
})
