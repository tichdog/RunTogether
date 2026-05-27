import { dbId } from '../server/db'

const ACTIVE_WORKOUT_STATUSES = ['planned', 'open', 'full', 'in_progress']
const ACTIVE_PARTICIPATION_STATUSES = ['confirmed', 'pending']

export async function lockParticipationForUser() {
  // Prisma ORM does not expose PostgreSQL advisory locks. Conflict checks run inside the
  // same transaction as request updates and rely on unique constraints plus re-checks.
}

function overlaps(candidate, workout) {
  const candidateStart = new Date(candidate.start_at)
  const candidateEnd = new Date(
    candidateStart.getTime() + Number(candidate.duration_minutes || 60) * 60_000
  )
  const workoutStart = new Date(workout.start_at)
  const workoutEnd = new Date(
    workoutStart.getTime() + Number(workout.duration_minutes || 60) * 60_000
  )

  return candidateStart < workoutEnd && candidateEnd > workoutStart
}

export async function findParticipationConflict(client, userId, workout, options = {}) {
  const {
    excludeWorkoutId = workout.id,
    participationStatuses = ACTIVE_PARTICIPATION_STATUSES,
    includeOrganized = true,
  } = options

  const id = dbId(userId)
  const excludeId = excludeWorkoutId == null ? null : dbId(excludeWorkoutId)

  const [participations, organized] = await Promise.all([
    client.workout_participants.findMany({
      where: {
        user_id: id,
        status: { in: participationStatuses },
        workouts: {
          status: { in: ACTIVE_WORKOUT_STATUSES },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      },
      include: { workouts: true },
    }),
    includeOrganized
      ? client.workouts.findMany({
          where: {
            organizer_id: id,
            status: { in: ACTIVE_WORKOUT_STATUSES },
            ...(excludeId ? { id: { not: excludeId } } : {}),
          },
        })
      : [],
  ])

  const candidates = [
    ...participations.map((row) => ({
      ...row.workouts,
      participation_status: row.status,
      is_organizer: false,
    })),
    ...organized.map((row) => ({
      ...row,
      participation_status: 'confirmed',
      is_organizer: true,
    })),
  ].filter((row) => overlaps(row, workout))

  const statusRank = { confirmed: 0, pending: 1 }
  candidates.sort((a, b) => {
    const rank =
      (statusRank[a.participation_status] ?? 2) - (statusRank[b.participation_status] ?? 2)
    if (rank) return rank
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime() || Number(a.id - b.id)
  })

  return candidates[0] || null
}

export async function cancelOverlappingPendingRequests(client, userId, workout) {
  const rows = await client.workout_participants.findMany({
    where: {
      user_id: dbId(userId),
      status: 'pending',
      workouts: {
        status: { in: ACTIVE_WORKOUT_STATUSES },
        id: { not: dbId(workout.id) },
      },
    },
    include: {
      workouts: {
        select: {
          title: true,
          organizer_id: true,
          start_at: true,
          duration_minutes: true,
        },
      },
    },
  })

  const overlapping = rows.filter((row) => overlaps(row.workouts, workout))
  if (overlapping.length) {
    await client.workout_participants.updateMany({
      where: { id: { in: overlapping.map((row) => row.id) } },
      data: { status: 'cancelled', responded_at: new Date() },
    })
  }

  return overlapping.map((row) => ({
    ...row,
    title: row.workouts.title,
    organizer_id: row.workouts.organizer_id,
  }))
}

export function participationConflictMessage(conflict, subject = 'Вы') {
  const isCurrentUser = subject === 'Вы'

  if (conflict.is_organizer) {
    const verb = isCurrentUser ? 'организуете' : 'организует'
    return `${subject} уже ${verb} тренировку в это время: ${conflict.title}`
  }

  if (conflict.participation_status === 'confirmed') {
    const verb = isCurrentUser ? 'подтверждены' : 'подтвержден'
    return `${subject} уже ${verb} на тренировку в это время: ${conflict.title}`
  }

  const verb = isCurrentUser ? 'отправили' : 'отправил'
  return `${subject} уже ${verb} заявку на тренировку в это время: ${conflict.title}`
}
