import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserRole } from '@/lib/repositories/users'
import { json, readJson, route } from '@/lib/server/response'

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  const { id } = await context.params
  const body = await readJson(request)
  const role = body.role

  if (!['member', 'admin', 'super_admin'].includes(role)) {
    throw badRequest('Некорректная роль')
  }

  const target = await getUserRole(id)

  if (!target) {
    throw notFound('Пользователь не найден')
  }

  if (Number(target.id) === Number(user.id) && role !== user.role) {
    throw badRequest('Нельзя изменить свою роль')
  }

  if ((isAdmin(target) || isAdmin({ role })) && user.role !== 'super_admin') {
    throw forbidden('Назначать и изменять админов может только супер-админ')
  }

  const updated = await prisma.users.update({
    where: { id: dbId(id) },
    data: { role, updated_at: now() },
  })

  return json({ user: publicUser(updated, { viewer: user }) })
})
