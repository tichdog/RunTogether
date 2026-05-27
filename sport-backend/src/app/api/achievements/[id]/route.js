import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { badRequest, notFound } from '@/lib/server/http-error'
import { json, noContent, readJson, route } from '@/lib/server/response'
import {
  clearAchievementsCache,
  evaluateAchievementsForAllUsers,
} from '@/lib/services/achievements'
import { normalizeAchievementPayload } from '@/lib/services/achievement-definitions'

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params
  const payload = normalizeAchievementPayload(await readJson(request), { partial: true })

  if (!Object.keys(payload).length) {
    throw badRequest('РќРµС‚ РґР°РЅРЅС‹С… РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ')
  }

  try {
    const achievement = await prisma.$transaction(async (tx) => {
      const existing = await tx.achievements.findUnique({ where: { id: dbId(id) } })
      if (!existing) throw notFound('Р”РѕСЃС‚РёР¶РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ')

      const updated = await tx.achievements.update({
        where: { id: existing.id },
        data: {
          ...(payload.code ? { code: payload.code } : {}),
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.description ? { description: payload.description } : {}),
          ...(payload.icon ? { icon: payload.icon } : {}),
          ...(payload.condition ? { condition: payload.condition } : {}),
        },
      })

      await evaluateAchievementsForAllUsers(tx)
      return updated
    })

    clearAchievementsCache()
    return json({ achievement })
  } catch (error) {
    if (error.code === 'P2002')
      throw badRequest('Р”РѕСЃС‚РёР¶РµРЅРёРµ СЃ С‚Р°РєРёРј РєРѕРґРѕРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚')
    throw error
  }
})

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params

  try {
    await prisma.achievements.delete({ where: { id: dbId(id) } })
  } catch (error) {
    if (error.code === 'P2025') throw notFound('Р”РѕСЃС‚РёР¶РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ')
    throw error
  }

  clearAchievementsCache()
  return noContent()
})
