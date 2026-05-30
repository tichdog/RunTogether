import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { prisma } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import {
  clearAchievementsCache,
  evaluateAchievementsForAllUsers,
  getAdminAchievements,
} from '@/lib/services/achievements'
import { normalizeAchievementPayload } from '@/lib/services/achievement-definitions'

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  return json({ achievements: await getAdminAchievements() })
})

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  const payload = normalizeAchievementPayload(await readJson(request))

  try {
    const achievement = await prisma.$transaction(async (tx) => {
      const created = await tx.achievements.create({
        data: {
          code: payload.code,
          title: payload.title,
          description: payload.description,
          icon: payload.icon,
          condition: payload.condition,
        },
      })
      await evaluateAchievementsForAllUsers(tx)
      return created
    })

    clearAchievementsCache()
    return json({ achievement: { ...achievement, earned_count: 0 } }, 201)
  } catch (error) {
    if (error.code === 'P2002') throw badRequest('`Достижение с таким кодом уже существует`')
    throw error
  }
})
