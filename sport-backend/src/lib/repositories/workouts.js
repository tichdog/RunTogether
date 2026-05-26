import { badRequest } from '../server/http-error'
import { isAdmin } from '../server/auth'

const WORKOUT_LIMITS = {
  durationMinutes: { min: 15, max: 1440 },
  distanceKm: { min: 0.1, max: 99999.99 },
  paceMinPerKm: { min: 0.1, max: 99.99 },
  participantLimit: { min: 1, max: 200 },
}

export function isOwnerOrAdmin(user, workout) {
  return isAdmin(user) || Number(workout.organizer_id) === Number(user.id)
}

export function parseWorkoutBody(body) {
  const title = String(body.title || '').trim()
  const startAt = body.startAt || body.start_at
  const meetingPoint = body.meetingPoint || {}
  const route = body.route || {}
  const difficulty = body.difficulty
  const durationMinutes = Number(body.durationMinutes ?? body.duration_minutes ?? 60)
  const participantLimit = Number(body.participantLimit ?? body.participant_limit)
  const distanceKm = Number(body.distanceKm ?? body.distance_km)
  const paceMinPerKm = Number(body.paceMinPerKm ?? body.pace_min_per_km)

  if (
    !title ||
    !startAt ||
    !meetingPoint.name ||
    !route.name ||
    !participantLimit ||
    !distanceKm ||
    !paceMinPerKm
  ) {
    throw badRequest(
      'Заполните дату, точку сбора, маршрут, темп, дистанцию, сложность и лимит участников'
    )
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    throw badRequest('Некорректная сложность')
  }
  assertNumberInRange(durationMinutes, WORKOUT_LIMITS.durationMinutes, 'Длительность')
  assertNumberInRange(distanceKm, WORKOUT_LIMITS.distanceKm, 'Дистанция')
  assertNumberInRange(paceMinPerKm, WORKOUT_LIMITS.paceMinPerKm, 'Темп')
  assertNumberInRange(participantLimit, WORKOUT_LIMITS.participantLimit, 'Лимит участников')

  return {
    title,
    description: body.description || null,
    startAt,
    durationMinutes,
    meetingPoint,
    route,
    distanceKm,
    paceMinPerKm,
    difficulty,
    participantLimit,
  }
}

function assertNumberInRange(value, limits, label) {
  if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
    throw badRequest(`${label}: укажите число от ${limits.min} до ${limits.max}`)
  }
}

export async function getWorkoutRow(client, workoutId, lock = false) {
  const { rows } = await client.query(
    `select w.*,
            u.full_name as organizer_name,
            (select count(*)
               from workout_participants wp
              where wp.workout_id = w.id and wp.status = 'confirmed') as confirmed_count
       from workouts w
       join users u on u.id = w.organizer_id
      where w.id = $1
      ${lock ? 'for update of w' : ''}`,
    [workoutId]
  )
  return rows[0]
}
