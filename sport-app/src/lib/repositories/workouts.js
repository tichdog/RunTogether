import { badRequest } from '../server/http-error'
import { isAdmin } from '../server/auth'
import { INPUT_LIMITS } from '../input-limits'
import { dbId, prisma } from '../server/db'
import { cleanLimitedText } from '../server/validation'
import { workoutInclude, buildWorkoutRows } from '../services/workouts'

const WORKOUT_LIMITS = {
  durationMinutes: { min: 15, max: 1440 },
  distanceKm: { min: 0.1, max: 250 },
  paceMinPerKm: { min: 0.1, max: 99.99 },
  participantLimit: { min: 1, max: 200 },
}

export function isOwnerOrAdmin(user, workout) {
  return isAdmin(user) || Number(workout.organizer_id) === Number(user.id)
}

export function parseWorkoutBody(body) {
  const title = cleanLimitedText(body.title, 'Название тренировки', {
    max: INPUT_LIMITS.workoutTitle,
    required: true,
  })
  const startAt = body.startAt || body.start_at
  const meetingPoint = body.meetingPoint || {}
  const route = body.route || {}
  const meetingPointName = cleanLimitedText(meetingPoint.name, 'Точка сбора', {
    max: INPUT_LIMITS.workoutMeetingName,
    required: true,
  })
  const meetingPointAddress = cleanLimitedText(meetingPoint.address, 'Адрес сбора', {
    max: INPUT_LIMITS.workoutMeetingAddress,
  })
  const routeName = cleanLimitedText(route.name, 'Маршрут', {
    max: INPUT_LIMITS.workoutRouteName,
    required: true,
  })
  const description = cleanLimitedText(body.description, 'Комментарий к тренировке', {
    max: INPUT_LIMITS.workoutDescription,
  })
  const difficulty = body.difficulty
  const durationMinutes = Number(body.durationMinutes ?? body.duration_minutes ?? 60)
  const participantLimit = Number(body.participantLimit ?? body.participant_limit)
  const distanceKm = Number(body.distanceKm ?? body.distance_km)
  const paceMinPerKm = calculatePaceMinPerKm(durationMinutes, distanceKm)

  if (
    !startAt ||
    !participantLimit ||
    !distanceKm
  ) {
    throw badRequest(
      'Заполните дату, точку сбора, маршрут, дистанцию, сложность и лимит участников'
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
    description: description || null,
    startAt,
    durationMinutes,
    meetingPoint: { ...meetingPoint, name: meetingPointName, address: meetingPointAddress },
    route: { ...route, name: routeName },
    distanceKm,
    paceMinPerKm,
    difficulty,
    participantLimit,
  }
}

export function validateWorkoutStart(startAt, settings = {}, nowDate = new Date()) {
  const startDate = new Date(startAt)
  if (Number.isNaN(startDate.getTime())) {
    throw badRequest('Некорректная дата тренировки')
  }

  if (startDate <= nowDate) {
    throw badRequest('Нельзя создать тренировку в прошлом')
  }

  const minLeadHours = Math.max(0, Number(settings.workout_create_min_lead_hours || 0))
  if (!minLeadHours) return

  const minStartDate = new Date(nowDate.getTime() + minLeadHours * 60 * 60 * 1000)
  if (startDate < minStartDate) {
    throw badRequest(`Тренировку нужно создавать минимум за ${minLeadHours} ч. до начала`)
  }
}

function assertNumberInRange(value, limits, label) {
  if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
    throw badRequest(`${label}: укажите число от ${limits.min} до ${limits.max}`)
  }
}

function calculatePaceMinPerKm(durationMinutes, distanceKm) {
  if (!Number.isFinite(durationMinutes) || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return Number.NaN
  }

  return Math.round((durationMinutes / distanceKm) * 100) / 100
}

export async function getWorkoutRow(client = prisma, workoutId) {
  const workout = await client.workouts.findUnique({
    where: { id: dbId(workoutId) },
    include: workoutInclude,
  })

  return workout ? (await buildWorkoutRows([workout]))[0] : null
}
