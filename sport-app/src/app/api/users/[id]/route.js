import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile, getUserRole } from '@/lib/repositories/users'
import { json, noContent, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params

  const profile = await getUserProfile(id)

  if (!profile) {
    throw notFound('Пользователь не найден')
  }

  return json({ user: publicUser(profile, { viewer: user, settings: await getSettings() }) })
})

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  const { id } = await context.params
  const target = await getUserRole(id)

  if (!target) {
    throw notFound('Пользователь не найден')
  }

  if (Number(target.id) === Number(user.id)) {
    throw badRequest('Админ не может удалить сам себя')
  }

  if (isAdmin(target) && user.role !== 'super_admin') {
    throw forbidden('Удалять админов может только супер-админ')
  }

  if (target.role === 'super_admin') {
    const count = await prisma.users.count({
      where: { role: 'super_admin' },
    })

    if (count <= 1) {
      throw badRequest('Нельзя удалить последнего супер-админа')
    }
  }

  await prisma.users.delete({
    where: { id: dbId(id) },
  })

  return noContent()
})
