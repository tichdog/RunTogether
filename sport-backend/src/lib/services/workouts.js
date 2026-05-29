import { dbId, prisma } from '../server/db'
import { isAdmin } from '../server/auth'
import { evaluateAchievements } from './achievements'
import { getUserStatsMap } from '../repositories/users'

const TERMINAL = new Set(['cancelled', 'archived'])
const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000
const ACTIVE_WORKOUT_STATUSES = new Set(['planned', 'open', 'full', 'in_progress'])
const ARCHIVE_LIST_STATUSES = new Set(['completed', 'archived', 'cancelled'])

export const workoutInclude = {
  users: true,
  workout_participants: {
    include: { users: true },
  },
}

export function workoutEndAt(workout) {
  const start = new Date(workout.start_at)
  return new Date(start.getTime() + Number(workout.duration_minutes || 60) * 60000)
}

export function hasWorkoutEnded(workout, currentDate = new Date()) {
  return currentDate >= workoutEndAt(workout)
}

export function shouldShowInWorkoutArchive(workout, currentDate = new Date()) {
  if (!workout) return false
  return ARCHIVE_LIST_STATUSES.has(workout.status) || hasWorkoutEnded(workout, currentDate)
}

export function shouldShowInActiveWorkouts(workout, currentDate = new Date()) {
  if (!workout) return false
  if (shouldShowInWorkoutArchive(workout, currentDate)) return false
  return ACTIVE_WORKOUT_STATUSES.has(workout.status)
}

export function deriveWorkoutStatus(workout, confirmedCount = 0, now = new Date()) {
  if (!workout || workout.status === 'cancelled') return workout?.status
  const start = new Date(workout.start_at)
  const end = workoutEndAt(workout)
  const archiveAt = new Date(end.getTime() + ARCHIVE_AFTER_MS)

  if (now >= archiveAt) return 'archived'
  if (now >= end) return 'completed'
  if (now >= start) return 'in_progress'
  if (Number(confirmedCount) >= Number(workout.participant_limit)) return 'full'
  return 'open'
}

export async function syncWorkoutStatus(client = prisma, workoutId) {
  const workout = await client.workouts.findUnique({
    where: { id: dbId(workoutId) },
    include: {
      workout_participants: {
        where: { status: 'confirmed' },
        select: { user_id: true },
      },
    },
  })

  if (!workout || TERMINAL.has(workout.status)) return workout

  const nextStatus = deriveWorkoutStatus(workout, workout.workout_participants.length)
  if (nextStatus !== workout.status) {
    const updated = await client.workouts.update({
      where: { id: workout.id },
      data: { status: nextStatus, updated_at: new Date() },
      include: {
        workout_participants: {
          where: { status: 'confirmed' },
          select: { user_id: true },
        },
      },
    })

    if (
      nextStatus === 'completed' ||
      (nextStatus === 'archived' && workout.status !== 'completed')
    ) {
      await evaluateWorkoutAchievements(client, updated)
    }

    return { ...updated, confirmed_count: updated.workout_participants.length }
  }

  return { ...workout, confirmed_count: workout.workout_participants.length }
}

async function evaluateWorkoutAchievements(client, workout) {
  const userIds = new Set([
    workout.organizer_id.toString(),
    ...workout.workout_participants.map((row) => row.user_id.toString()),
  ])

  for (const userId of userIds) {
    await evaluateAchievements(client, userId)
  }
}

function initialsFor(user) {
  return `${user.first_name?.[0] || user.full_name?.[0] || user.email?.[0] || 'U'}${user.last_name?.[0] || ''}`.toUpperCase()
}

function userCard(user, stats) {
  return {
    id: user.id,
    name: user.full_name,
    initials: initialsFor(user),
    avatarUrl: user.avatar_url,
    role: user.role,
    stats: { rating: stats?.average_rating ?? null },
  }
}

function distanceKm(workout, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (workout.meeting_lat == null || workout.meeting_lng == null) return null

  const toRad = (value) => (Number(value) * Math.PI) / 180
  const dLat = toRad(Number(workout.meeting_lat) - lat)
  const dLng = toRad(Number(workout.meeting_lng) - lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(Number(workout.meeting_lat))) * Math.sin(dLng / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function buildWorkoutRows(workouts, viewer = null, { lat = null, lng = null } = {}) {
  const userIds = new Set()
  for (const workout of workouts) {
    userIds.add(workout.organizer_id.toString())
    for (const participant of workout.workout_participants || []) {
      userIds.add(participant.user_id.toString())
    }
  }
  const stats = await getUserStatsMap([...userIds])

  return workouts.map((workout) => {
    const confirmed = (workout.workout_participants || []).filter(
      (participant) => participant.status === 'confirmed'
    )
    const viewerRequest = (workout.workout_participants || []).find(
      (participant) => viewer && Number(participant.user_id) === Number(viewer.id)
    )
    const organizerStats = stats.get(workout.organizer_id.toString())

    return {
      ...workout,
      organizer_name: workout.users?.full_name,
      organizer: workout.users ? userCard(workout.users, organizerStats) : null,
      participants: confirmed.map((participant) =>
        userCard(participant.users, stats.get(participant.user_id.toString()))
      ),
      confirmed_count: confirmed.length,
      participant_status: viewerRequest?.status || null,
      participant_request_id: viewerRequest?.id || null,
      distance_from_user_km: distanceKm(workout, lat, lng),
    }
  })
}

function canViewParticipants(row, viewer) {
  return (
    viewer &&
    (isAdmin(viewer) ||
      Number(row.organizer_id) === Number(viewer.id) ||
      row.participant_status === 'confirmed')
  )
}

export function workoutPayload(row, viewer = null) {
  const confirmed = Number(row.confirmed_count || 0)
  const status = row.status === 'archived' ? 'completed' : row.status
  const participantsVisible = canViewParticipants(row, viewer)
  return {
    id: row.id,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    organizer: row.organizer || null,
    participants: participantsVisible ? row.participants || [] : [],
    participantsHidden: Boolean(viewer) && !participantsVisible,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    durationMinutes: Number(row.duration_minutes),
    meetingPoint: {
      name: row.meeting_point_name,
      address: row.meeting_point_address,
      lat: row.meeting_lat == null ? null : Number(row.meeting_lat),
      lng: row.meeting_lng == null ? null : Number(row.meeting_lng),
    },
    route: {
      name: row.route_name,
      geojson: row.route_geojson,
    },
    distanceKm: Number(row.distance_km),
    paceMinPerKm: Number(row.pace_min_per_km),
    difficulty: row.difficulty,
    participantLimit: Number(row.participant_limit),
    confirmedCount: confirmed,
    freePlaces: Math.max(0, Number(row.participant_limit) - confirmed),
    status,
    archived: row.status === 'archived',
    participantStatus: row.participant_status || null,
    participantRequestId:
      row.participant_request_id == null ? null : Number(row.participant_request_id),
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    distanceFromUserKm:
      row.distance_from_user_km == null ? null : Number(row.distance_from_user_km),
  }
}
