import { requireAuth } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { badRequest, forbidden } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { json, readJson, route } from '@/lib/server/response'
import { attachUserProfiles } from '@/lib/repositories/users'
import { evaluateAchievements } from '@/lib/services/achievements'
import { syncWorkoutStatus } from '@/lib/services/workouts'

function isWorkoutMember(workout, userId) {
  return (
    Number(workout.organizer_id) === Number(userId) ||
    workout.workout_participants.some(
      (participant) =>
        Number(participant.user_id) === Number(userId) && participant.status === 'confirmed'
    )
  )
}

export const GET = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  await syncWorkoutStatus(prisma, id)

  const workout = await prisma.workouts.findUnique({
    where: { id: dbId(id) },
    include: {
      users: true,
      workout_participants: {
        where: { status: 'confirmed' },
        include: { users: true },
      },
      reviews: {
        where: { reviewer_id: dbId(user.id) },
      },
    },
  })

  if (
    !workout ||
    !['completed', 'archived'].includes(workout.status) ||
    !isWorkoutMember(workout, user.id)
  ) {
    return json({ reviewTargets: [] })
  }

  const targets = [
    { user: workout.users, isOrganizer: true },
    ...workout.workout_participants.map((participant) => ({
      user: participant.users,
      isOrganizer: false,
    })),
  ].filter((target) => Number(target.user.id) !== Number(user.id))
  const profiles = await attachUserProfiles(targets.map((target) => target.user))
  const profilesById = new Map(profiles.map((profile) => [profile.id.toString(), profile]))

  return json({
    reviewTargets: targets.map((target) => {
      const review = workout.reviews.find(
        (item) => Number(item.reviewee_id) === Number(target.user.id)
      )
      return {
        user: publicUser(profilesById.get(target.user.id.toString()), { viewer: user }),
        isOrganizer: target.isOrganizer,
        review: review ? { id: review.id, rating: Number(review.rating), text: review.text } : null,
      }
    }),
  })
})

export const POST = route(async (request, context) => {
  const user = await requireAuth(request)
  const { id } = await context.params
  await syncWorkoutStatus(prisma, id)

  const body = await readJson(request)
  const rating = Number(body.rating)
  const revieweeId = Number(body.revieweeId || body.reviewee_id)
  if (!revieweeId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest('РЈРєР°Р¶РёС‚Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РѕС†РµРЅРєСѓ 1-5')
  }
  if (Number(user.id) === revieweeId) {
    throw badRequest('РќРµР»СЊР·СЏ РѕС†РµРЅРёС‚СЊ СЃР°РјРѕРіРѕ СЃРµР±СЏ')
  }

  const review = await prisma.$transaction(async (tx) => {
    const workout = await tx.workouts.findUnique({
      where: { id: dbId(id) },
      include: {
        workout_participants: {
          where: { status: 'confirmed' },
          select: { user_id: true },
        },
      },
    })

    const reviewerAllowed =
      workout &&
      ['completed', 'archived'].includes(workout.status) &&
      (Number(workout.organizer_id) === Number(user.id) ||
        workout.workout_participants.some((row) => Number(row.user_id) === Number(user.id)))
    const revieweeAllowed =
      workout &&
      (Number(workout.organizer_id) === revieweeId ||
        workout.workout_participants.some((row) => Number(row.user_id) === revieweeId))

    if (!reviewerAllowed || !revieweeAllowed) {
      throw forbidden(
        'РћС†РµРЅРёРІР°С‚СЊ РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ С‚РµС…, СЃ РєРµРј РІС‹ Р±С‹Р»Рё РЅР° Р·Р°РІРµСЂС€РµРЅРЅРѕР№ С‚СЂРµРЅРёСЂРѕРІРєРµ'
      )
    }

    const existing = await tx.reviews.findFirst({
      where: {
        workout_id: dbId(id),
        reviewer_id: dbId(user.id),
        reviewee_id: dbId(revieweeId),
      },
      select: { id: true },
    })
    if (existing) {
      throw badRequest(
        'Р­С‚РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІС‹ СѓР¶Рµ РѕС†РµРЅРёР»Рё РїРѕСЃР»Рµ СЌС‚РѕР№ С‚СЂРµРЅРёСЂРѕРІРєРё'
      )
    }

    const row = await tx.reviews.create({
      data: {
        workout_id: dbId(id),
        reviewer_id: dbId(user.id),
        reviewee_id: dbId(revieweeId),
        rating,
        text: body.text || null,
      },
    })
    await evaluateAchievements(tx, revieweeId)
    return row
  })

  return json({ review }, 201)
})
