import { createNotification } from './notifications'
import { query } from '../server/db'

const ACHIEVEMENTS_CACHE_TTL_MS = 60_000
let adminAchievementsCache = null

export function clearAchievementsCache() {
  adminAchievementsCache = null
}

export async function getAdminAchievements() {
  if (adminAchievementsCache && adminAchievementsCache.expiresAt > Date.now()) {
    return adminAchievementsCache.value.map((achievement) => ({ ...achievement }))
  }

  const { rows } = await query(
    `select a.*,
            count(ua.user_id)::int as earned_count
       from achievements a
       left join user_achievements ua on ua.achievement_id = a.id
      group by a.id
      order by a.id desc`
  )

  adminAchievementsCache = {
    value: rows,
    expiresAt: Date.now() + ACHIEVEMENTS_CACHE_TTL_MS,
  }

  return rows.map((achievement) => ({ ...achievement }))
}

export async function evaluateAchievements(client, userId) {
  const { rows: achievements } = await client.query('select * from achievements')
  const { rows } = await client.query(
    `select
       count(distinct wp.workout_id) filter (where wp.status = 'confirmed' and w.status in ('completed', 'archived')) as completed_count,
       coalesce(sum(w.distance_km) filter (where wp.status = 'confirmed' and w.status in ('completed', 'archived')), 0) as distance_sum,
       count(distinct wp.workout_id) filter (where wp.status = 'confirmed' and w.status in ('completed', 'archived') and extract(hour from w.start_at) < 9) as morning_count,
       (
         select count(*)::int
           from workouts organized
          where organized.organizer_id = $1
            and organized.status in ('completed', 'archived')
       ) as organized_count
     from workout_participants wp
     join workouts w on w.id = wp.workout_id
     where wp.user_id = $1`,
    [userId]
  )

  const stats = rows[0] || {}
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

    const inserted = await client.query(
      `insert into user_achievements (user_id, achievement_id)
       values ($1, $2)
       on conflict do nothing
       returning *`,
      [userId, achievement.id]
    )

    if (inserted.rowCount) {
      clearAchievementsCache()
      earned.push(achievement)
      await client.query(
        `insert into activity_feed (type, actor_id, achievement_id, metadata)
         values ('achievement_earned', $1, $2, $3::jsonb)`,
        [
          userId,
          achievement.id,
          JSON.stringify({ title: achievement.title, icon: achievement.icon }),
        ]
      )
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

export async function evaluateAchievementsForAllUsers(client) {
  const { rows: users } = await client.query("select id from users where account_status = 'active'")

  for (const user of users) {
    await evaluateAchievements(client, user.id)
  }
}
