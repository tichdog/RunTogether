import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { prisma } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import {
  clearAchievementsCache,
  evaluateAchievementsForAllUsers,
  getAdminAchievements,
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

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  return json({ achievements: await getAdminAchievements() })
})

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)

  const { body, uploadedIconUrl } = await readAchievementRequest(request)

  try {
    const payload = normalizeAchievementPayload(body)
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
    if (uploadedIconUrl) await deleteImageUpload(uploadedIconUrl)
    if (error.code === 'P2002') throw badRequest('`Достижение с таким кодом уже существует`')
    throw error
  }
})
