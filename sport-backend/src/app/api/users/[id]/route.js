import { requireAdmin, requireAuth, isAdmin } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile, getUserRole } from '@/lib/repositories/users'
import { json, noContent, route } from '@/lib/server/response'

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params

  const profile = await getUserProfile(id)
  if (!profile) throw notFound('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ')
  return json({ user: publicUser(profile, { viewer: user }) })
})

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params
  const target = await getUserRole(id)

  if (!target) throw notFound('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ')
  if (Number(target.id) === Number(user.id)) {
    throw badRequest('РђРґРјРёРЅ РЅРµ РјРѕР¶РµС‚ СѓРґР°Р»РёС‚СЊ СЃР°Рј СЃРµР±СЏ')
  }
  if (isAdmin(target) && user.role !== 'super_admin') {
    throw forbidden('РЈРґР°Р»СЏС‚СЊ Р°РґРјРёРЅРѕРІ РјРѕР¶РµС‚ С‚РѕР»СЊРєРѕ СЃСѓРїРµСЂ-Р°РґРјРёРЅ')
  }
  if (target.role === 'super_admin') {
    const count = await prisma.users.count({ where: { role: 'super_admin' } })
    if (count <= 1) {
      throw badRequest('РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ РїРѕСЃР»РµРґРЅРµРіРѕ СЃСѓРїРµСЂ-Р°РґРјРёРЅР°')
    }
  }

  await prisma.users.delete({ where: { id: dbId(id) } })
  return noContent()
})
