import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { banUntilFromBody } from '@/lib/server/moderation'
import { publicUser } from '@/lib/mappers/user'
import { getUserRole } from '@/lib/repositories/users'
import { json, readJson, route } from '@/lib/server/response'
import { cleanLimitedText } from '@/lib/server/validation'
import { getSettings } from '@/lib/services/settings'

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  const { id } = await context.params
  const body = await readJson(request)
  const action = String(body.action || 'block').trim()
  const blockReason =
    action === 'block'
      ? cleanLimitedText(body.reason || 'Блокировка администратором', 'Причина блокировки', {
          max: INPUT_LIMITS.userBlockReason,
          required: true,
        })
      : null
  const target = await getUserRole(id)

  if (!['block', 'unblock'].includes(action)) {
    throw badRequest('Некорректное действие модерации')
  }

  if (!target) {
    throw notFound('Пользователь не найден')
  }

  if (Number(target.id) === Number(user.id)) {
    throw badRequest('Нельзя заблокировать самого себя')
  }

  if (isAdmin(target) && user.role !== 'super_admin') {
    throw forbidden('Блокировать админов может только супер-админ')
  }

  const data =
    action === 'unblock'
      ? {
          account_status: 'active',
          blocked_until: null,
          block_reason: null,
          updated_at: now(),
        }
      : {
          account_status: 'blocked',
          blocked_until: banUntilFromBody(body),
          block_reason: blockReason,
          updated_at: now(),
        }

  const updated = await prisma.users.update({
    where: { id: dbId(id) },
    data,
  })

  return json({ user: publicUser(updated, { viewer: user, settings: await getSettings() }) })
})
