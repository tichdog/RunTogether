import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { query } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserRole } from '@/lib/repositories/users'
import { json, readJson, route } from '@/lib/server/response'

function banUntilFromBody(body) {
  const mode = String(body.banMode || body.duration || 'permanent')
  if (mode === 'permanent') return null
  const days = Number(body.banDays || body.days)
  if (!Number.isFinite(days) || days <= 0) {
    throw badRequest('Укажите срок бана в днях')
  }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params
  const body = await readJson(request)
  const action = String(body.action || 'block').trim()
  const target = await getUserRole(id)

  if (!['block', 'unblock'].includes(action)) {
    throw badRequest('Некорректное действие модерации')
  }
  if (!target) throw notFound('Пользователь не найден')
  if (Number(target.id) === Number(user.id)) {
    throw badRequest('Нельзя заблокировать самого себя')
  }
  if (isAdmin(target) && user.role !== 'super_admin') {
    throw forbidden('Блокировать админов может только супер-админ')
  }

  if (action === 'unblock') {
    const { rows } = await query(
      `update users
          set account_status = 'active',
              blocked_until = null,
              block_reason = null,
              updated_at = now()
        where id = $1
        returning *`,
      [id]
    )
    return json({ user: publicUser(rows[0], { viewer: user }) })
  }

  const banUntil = banUntilFromBody(body)
  const reason = String(body.reason || 'Блокировка администратором').trim()
  const { rows } = await query(
    `update users
        set account_status = 'blocked',
            blocked_until = $2,
            block_reason = $3,
            updated_at = now()
      where id = $1
      returning *`,
    [id, banUntil, reason]
  )
  return json({ user: publicUser(rows[0], { viewer: user }) })
})
