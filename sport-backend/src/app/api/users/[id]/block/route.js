import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserRole } from '@/lib/repositories/users'
import { json, readJson, route } from '@/lib/server/response'

function banUntilFromBody(body) {
  const mode = String(body.banMode || body.duration || 'permanent')
  if (mode === 'permanent') return null
  const days = Number(body.banDays || body.days)
  if (!Number.isFinite(days) || days <= 0) {
    throw badRequest('РЈРєР°Р¶РёС‚Рµ СЃСЂРѕРє Р±Р°РЅР° РІ РґРЅСЏС…')
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
    throw badRequest('РќРµРєРѕСЂСЂРµРєС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ РјРѕРґРµСЂР°С†РёРё')
  }
  if (!target) throw notFound('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ')
  if (Number(target.id) === Number(user.id)) {
    throw badRequest('РќРµР»СЊР·СЏ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ СЃР°РјРѕРіРѕ СЃРµР±СЏ')
  }
  if (isAdmin(target) && user.role !== 'super_admin') {
    throw forbidden(
      'Р‘Р»РѕРєРёСЂРѕРІР°С‚СЊ Р°РґРјРёРЅРѕРІ РјРѕР¶РµС‚ С‚РѕР»СЊРєРѕ СЃСѓРїРµСЂ-Р°РґРјРёРЅ'
    )
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
          block_reason: String(
            body.reason || 'Р‘Р»РѕРєРёСЂРѕРІРєР° Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј'
          ).trim(),
          updated_at: now(),
        }

  const updated = await prisma.users.update({ where: { id: dbId(id) }, data })
  return json({ user: publicUser(updated, { viewer: user }) })
})
