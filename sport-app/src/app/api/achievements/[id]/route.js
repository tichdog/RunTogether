import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { badRequest, notFound } from '@/lib/server/http-error'
import { json, noContent, readJson, route } from '@/lib/server/response'
import {
  clearAchievementsCache,
  evaluateAchievementsForAllUsers,
} from '@/lib/services/achievements'
import {
  achievementBodyFromFormData,
  normalizeAchievementPayload,
} from '@/lib/services/achievement-definitions'
import { deleteImageUpload, saveAchievementIconUpload } from '@/lib/server/uploads'

async function readAchievementRequest(request) {
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return { body: await readJson(request), uploadedIconUrl: null }
  }

  const form = await request.formData()
  const body = achievementBodyFromFormData(form)
  const iconImage = form.get('iconImage')
  let uploadedIconUrl = null

  if (iconImage && typeof iconImage.arrayBuffer === 'function' && iconImage.size > 0) {
    uploadedIconUrl = await saveAchievementIconUpload(iconImage)
    body.icon = uploadedIconUrl
  }

  return { body, uploadedIconUrl }
}

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params
  const { body, uploadedIconUrl } = await readAchievementRequest(request)

  try {
    const payload = normalizeAchievementPayload(body, { partial: true })
    if (!Object.keys(payload).length) {
      throw badRequest('Нет данных для обновления')
    }

    const { achievement, previousIcon } = await prisma.$transaction(async (tx) => {
      const existing = await tx.achievements.findUnique({ where: { id: dbId(id) } })
      if (!existing) throw notFound('Достижение не найдено')

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
      return { achievement: updated, previousIcon: existing.icon }
    })

    if (payload.icon && previousIcon !== achievement.icon) {
      await deleteImageUpload(previousIcon)
    }

    clearAchievementsCache()
    return json({ achievement })
  } catch (error) {
    if (uploadedIconUrl) await deleteImageUpload(uploadedIconUrl)
    if (error.code === 'P2002') throw badRequest('Достижение с таким кодом уже существует')
    throw error
  }
})

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params

  let deleted
  try {
    deleted = await prisma.achievements.delete({ where: { id: dbId(id) } })
  } catch (error) {
    if (error.code === 'P2025') throw notFound('Достижение не найдено')
    throw error
  }

  await deleteImageUpload(deleted?.icon)
  clearAchievementsCache()
  return noContent()
})
