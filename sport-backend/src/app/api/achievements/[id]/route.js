import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { query, transaction } from '@/lib/server/db'
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
    throw badRequest('Нет данных для обновления')
  }

  try {
    const achievement = await transaction(async (client) => {
      const { rows } = await client.query(
        `update achievements
            set code = coalesce($2, code),
                title = coalesce($3, title),
                description = coalesce($4, description),
                icon = coalesce($5, icon),
                condition = coalesce($6::jsonb, condition)
          where id = $1
          returning *`,
        [
          id,
          payload.code || null,
          payload.title || null,
          payload.description || null,
          payload.icon || null,
          payload.condition ? JSON.stringify(payload.condition) : null,
        ]
      )

      if (!rows[0]) throw notFound('Достижение не найдено')
      await evaluateAchievementsForAllUsers(client)
      return rows[0]
    })

    clearAchievementsCache()
    return json({ achievement })
  } catch (error) {
    if (error.code === '23505') throw badRequest('Достижение с таким кодом уже существует')
    throw error
  }
})

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params

  const { rowCount } = await query('delete from achievements where id = $1', [id])
  if (!rowCount) throw notFound('Достижение не найдено')

  clearAchievementsCache()
  return noContent()
})
