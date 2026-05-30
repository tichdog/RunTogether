import { requireAuth } from '@/lib/server/auth'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { dbId, prisma } from '@/lib/server/db'
import { badRequest, forbidden } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { json, readJson, route } from '@/lib/server/response'
import { cleanLimitedText } from '@/lib/server/validation'
import { attachUserProfiles } from '@/lib/repositories/users'
import { evaluateAchievements } from '@/lib/services/achievements'
import { createNotification } from '@/lib/services/notifications'
import { getSettings } from '@/lib/services/settings'
import { syncWorkoutStatus } from '@/lib/services/workouts'

const DAY_MS = 24 * 60 * 60 * 1000

function isWorkoutMember(workout, userId) {
  return (
    Number(workout.organizer_id) === Number(userId) ||
    workout.workout_participants.some(
      (participant) =>
        Number(participant.user_id) === Number(userId) && participant.status === 'confirmed'
    )
  )
}

function reviewWindowDays(settings) {
  return Math.max(1, Number(settings.review_window_days) || 7)
}

function workoutReviewDeadline(workout, settings) {
  const start = new Date(workout.start_at)
  const end = new Date(start.getTime() + Number(workout.duration_minutes || 60) * 60000)
  return new Date(end.getTime() + reviewWindowDays(settings) * DAY_MS)
}

function canReviewWorkout(workout, settings, now = new Date()) {
  return now <= workoutReviewDeadline(workout, settings)
}

function cleanReviewText(value) {
  return cleanLimitedText(value, 'Текст отзыва', { max: INPUT_LIMITS.reviewText })
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

  const settings = await getSettings()
  const reviewExpiresAt = workoutReviewDeadline(workout, settings)
  const canReview = canReviewWorkout(workout, settings)
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
    canReview,
    reviewExpiresAt,
    reviewWindowDays: reviewWindowDays(settings),
    reviewTargets: targets.map((target) => {
      const review = workout.reviews.find(
        (item) => Number(item.reviewee_id) === Number(target.user.id)
      )
      return {
        user: publicUser(profilesById.get(target.user.id.toString()), { viewer: user }),
        isOrganizer: target.isOrganizer,
        canReview,
        reviewExpiresAt,
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
  const text = cleanReviewText(body.text)
  if (!revieweeId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest('Укажите пользователя и оценку от 1 до 5')
  }
  if (Number(user.id) === revieweeId) {
    throw badRequest('Нельзя оценить самого себя')
  }

  const settings = await getSettings()
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
      throw forbidden('Оценивать можно только тех, с кем вы были на завершенной тренировке')
    }

    if (!canReviewWorkout(workout, settings)) {
      throw forbidden('Срок для отзыва по этой тренировке истек')
    }

    const isOrganizerReview = Number(workout.organizer_id) === revieweeId
    if (isOrganizerReview && !text) {
      throw badRequest('Напишите текст отзыва для организатора')
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
      throw badRequest('Вы уже оставили отзыв этому пользователю после этой тренировки')
    }

    const row = await tx.reviews.create({
      data: {
        workout_id: dbId(id),
        reviewer_id: dbId(user.id),
        reviewee_id: dbId(revieweeId),
        rating,
        text: text || null,
      },
    })

    if (isOrganizerReview) {
      const senderName = user.full_name || user.email || 'участника'
      await createNotification(tx, {
        userId: workout.organizer_id,
        type: 'workout_review',
        title: `Отзыв по тренировке «${workout.title}»`,
        message: `${senderName}: ${text}`,
        payload: {
          workoutId: id,
          workoutTitle: workout.title,
          reviewId: row.id,
          senderId: user.id,
          senderName,
          rating,
        },
      })
    }

    await evaluateAchievements(tx, revieweeId)
    return row
  })

  return json({ review }, 201)
})
