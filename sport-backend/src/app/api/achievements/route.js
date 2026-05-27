import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { transaction } from '@/lib/server/db'
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
    const achievement = await transaction(async (client) => {
      const { rows } = await client.query(
        `insert into achievements (code, title, description, icon, condition)
         values ($1, $2, $3, $4, $5::jsonb)
         returning *`,
        [
          payload.code,
          payload.title,
          payload.description,
          payload.icon,
          JSON.stringify(payload.condition),
        ]
      )
      await evaluateAchievementsForAllUsers(client)
      return rows[0]
    })

    clearAchievementsCache()
    return json({ achievement: { ...achievement, earned_count: 0 } }, 201)
  } catch (error) {
    if (error.code === '23505') throw badRequest('Достижение с таким кодом уже существует')
    throw error
  }
})
