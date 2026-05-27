import { createNotification } from './notifications'
import { dbId, prisma } from '../server/db'

const ACHIEVEMENTS_CACHE_TTL_MS = 60_000
const COMPLETED_WORKOUT_STATUSES = ['completed', 'archived']
let adminAchievementsCache = null

export function clearAchievementsCache() {
  adminAchievementsCache = null
}

export async function getAdminAchievements() {
  if (adminAchievementsCache && adminAchievementsCache.expiresAt > Date.now()) {
    return adminAchievementsCache.value.map((achievement) => ({ ...achievement }))
  }

  const rows = await prisma.achievements.findMany({
    include: {
      _count: { select: { user_achievements: true } },
    },
    orderBy: { id: 'desc' },
  })

  const achievements = rows.map(({ _count, ...achievement }) => ({
    ...achievement,
    earned_count: _count.user_achievements,
  }))

  adminAchievementsCache = {
    value: achievements,
    expiresAt: Date.now() + ACHIEVEMENTS_CACHE_TTL_MS,
  }

  return achievements.map((achievement) => ({ ...achievement }))
}

async function getAchievementStats(client, userId) {
  const id = dbId(userId)
  const [participations, organizedCount] = await Promise.all([
    client.workout_participants.findMany({
      where: {
        user_id: id,
        status: 'confirmed',
        workouts: { status: { in: COMPLETED_WORKOUT_STATUSES } },
      },
      include: {
        workouts: {
          select: {
            id: true,
            distance_km: true,
            start_at: true,
          },
        },
      },
    }),
    client.workouts.count({
      where: {
        organizer_id: id,
        status: { in: COMPLETED_WORKOUT_STATUSES },
      },
    }),
  ])

  return {
    completed_count: participations.length,
    distance_sum: participations.reduce((sum, row) => sum + Number(row.workouts.distance_km), 0),
    morning_count: participations.filter((row) => new Date(row.workouts.start_at).getHours() < 9)
      .length,
    organized_count: organizedCount,
  }
}

export async function evaluateAchievements(client = prisma, userId) {
  const achievements = await client.achievements.findMany()
  const stats = await getAchievementStats(client, userId)
  const earned = []

  for (const achievement of achievements) {
    const condition = achievement.condition
    const matches =
      (condition.type === 'completed_workouts' &&
        Number(stats.completed_count) >= Number(condition.value)) ||
      (condition.type === 'distance_km' && Number(stats.distance_sum) >= Number(condition.value)) ||
      (condition.type === 'morning_workouts' &&
        Number(stats.morning_count) >= Number(condition.value)) ||
      (condition.type === 'organized_workouts' &&
        Number(stats.organized_count) >= Number(condition.value))

    if (!matches) continue

    let inserted = false
    try {
      await client.user_achievements.create({
        data: {
          user_id: dbId(userId),
          achievement_id: achievement.id,
        },
      })
      inserted = true
    } catch (error) {
      if (error.code !== 'P2002') throw error
    }

    if (inserted) {
      clearAchievementsCache()
      earned.push(achievement)
      await client.activity_feed.create({
        data: {
          type: 'achievement_earned',
          actor_id: dbId(userId),
          achievement_id: achievement.id,
          metadata: { title: achievement.title, icon: achievement.icon },
        },
      })
      await createNotification(client, {
        userId,
        type: 'achievement',
        title: 'Новое достижение',
        message: achievement.title,
        payload: { achievementId: achievement.id },
      })
    }
  }

  return earned
}

export async function evaluateAchievementsForAllUsers(client = prisma) {
  const users = await client.users.findMany({
    where: { account_status: 'active' },
    select: { id: true },
  })

  for (const user of users) {
    await evaluateAchievements(client, user.id)
  }
}
