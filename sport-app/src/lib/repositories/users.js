import { dbId, now, prisma } from '../server/db'

const COMPLETED_WORKOUT_STATUSES = ['completed', 'archived']

function privacyFlag(user, key) {
  return Boolean(user.privacy_settings?.[key])
}

export async function getUserStatsMap(userIds, client = prisma) {
  const ids = [...new Set(userIds.map((id) => dbId(id)))]
  const empty = new Map()
  if (!ids.length) return empty

  const [organized, attended, ratings, complaints] = await Promise.all([
    client.workouts.groupBy({
      by: ['organizer_id'],
      where: {
        organizer_id: { in: ids },
        status: { in: COMPLETED_WORKOUT_STATUSES },
      },
      _count: { id: true },
    }),
    client.workout_participants.findMany({
      where: {
        user_id: { in: ids },
        status: 'confirmed',
        workouts: { status: { in: COMPLETED_WORKOUT_STATUSES } },
      },
      include: {
        workouts: {
          select: {
            id: true,
            distance_km: true,
          },
        },
      },
    }),
    client.reviews.groupBy({
      by: ['reviewee_id'],
      where: { reviewee_id: { in: ids } },
      _avg: { rating: true },
    }),
    client.reports.groupBy({
      by: ['reported_user_id'],
      where: { reported_user_id: { in: ids } },
      _count: { id: true },
    }),
  ])

  const stats = new Map(
    ids.map((id) => [
      id.toString(),
      {
        organized_workouts: 0,
        attended_workouts: 0,
        total_distance_km: 0,
        average_rating: null,
        complaints_count: 0,
      },
    ])
  )

  for (const row of organized) {
    stats.get(row.organizer_id.toString()).organized_workouts = row._count.id
  }

  for (const row of attended) {
    const item = stats.get(row.user_id.toString())
    item.attended_workouts += 1
    item.total_distance_km += Number(row.workouts.distance_km || 0)
  }

  for (const row of ratings) {
    stats.get(row.reviewee_id.toString()).average_rating = row._avg.rating
      ? Number(row._avg.rating.toFixed(2))
      : null
  }

  for (const row of complaints) {
    stats.get(row.reported_user_id.toString()).complaints_count = row._count.id
  }

  return stats
}

export async function attachUserProfiles(users, client = prisma) {
  if (!users.length) return []

  const stats = await getUserStatsMap(
    users.map((user) => user.id),
    client
  )

  return users.map((user) => ({
    ...user,
    ...stats.get(user.id.toString()),
    hide_email: privacyFlag(user, 'hide_email'),
    hide_phone: privacyFlag(user, 'hide_phone'),
    achievements: (user.user_achievements || []).map((item) => ({
      ...item.achievements,
      earnedAt: item.earned_at,
    })),
  }))
}

export async function getUserProfile(id, client = prisma) {
  const user = await client.users.findUnique({
    where: { id: dbId(id) },
    include: {
      user_achievements: {
        orderBy: { earned_at: 'desc' },
        include: { achievements: true },
      },
    },
  })

  return user ? (await attachUserProfiles([user], client))[0] : null
}

export async function listUserProfiles({ search = '', role = null, status = null } = {}) {
  const text = String(search || '').trim()
  const users = await prisma.users.findMany({
    where: {
      ...(text
        ? {
            OR: [
              { full_name: { contains: text, mode: 'insensitive' } },
              { email: { contains: text, mode: 'insensitive' } },
              { phone: { contains: text } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(status ? { account_status: status } : {}),
    },
    include: {
      user_achievements: {
        orderBy: { earned_at: 'desc' },
        include: { achievements: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  })

  return attachUserProfiles(users)
}

export async function getUserRole(id, client = prisma) {
  return client.users.findUnique({
    where: { id: dbId(id) },
    select: { id: true, role: true },
  })
}

export async function replaceUserAvatar(id, avatarUrl) {
  return prisma.$transaction(async (tx) => {
    const [lockedUser] = await tx.$queryRaw`
      select avatar_url
      from users
      where id = ${dbId(id)}
      for update
    `

    await tx.users.update({
      where: { id: dbId(id) },
      data: { avatar_url: avatarUrl, updated_at: now() },
    })

    return lockedUser?.avatar_url
  })
}
