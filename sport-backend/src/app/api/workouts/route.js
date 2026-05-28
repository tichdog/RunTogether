import { requireAuth } from '@/lib/server/auth'
import { dbId, prisma } from '@/lib/server/db'
import { forbidden } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'
import { parseWorkoutBody, validateWorkoutStart } from '@/lib/repositories/workouts'
import {
  buildWorkoutRows,
  syncWorkoutStatus,
  workoutInclude,
  workoutPayload,
} from '@/lib/services/workouts'

function filterArchive(row, archiveOnly, includeArchived) {
  if (archiveOnly) {
    return (
      row.status === 'archived' ||
      (row.status !== 'cancelled' &&
        Date.now() >=
          new Date(row.start_at).getTime() + (Number(row.duration_minutes) + 1440) * 60_000)
    )
  }
  return includeArchived || row.status !== 'archived'
}

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat') == null ? null : Number(searchParams.get('lat'))
  const lng = searchParams.get('lng') == null ? null : Number(searchParams.get('lng'))
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng)
  const radiusKm =
    hasGeo && searchParams.get('radiusKm') != null ? Number(searchParams.get('radiusKm')) : null
  const sort = searchParams.get('sort') === 'distance' && hasGeo ? 'distance' : 'time'
  const archiveOnly =
    searchParams.get('archiveOnly') === 'true' || searchParams.get('archive') === 'only'
  const includeArchived =
    archiveOnly ||
    searchParams.get('archive') === '1' ||
    searchParams.get('includeArchived') === 'true'
  const startAt = {
    ...(searchParams.get('dateFrom') ? { gte: new Date(searchParams.get('dateFrom')) } : {}),
    ...(searchParams.get('dateTo') ? { lte: new Date(searchParams.get('dateTo')) } : {}),
  }
  const distanceKm = {
    ...(searchParams.get('distanceMin') ? { gte: Number(searchParams.get('distanceMin')) } : {}),
    ...(searchParams.get('distanceMax') ? { lte: Number(searchParams.get('distanceMax')) } : {}),
  }

  const workouts = await prisma.workouts.findMany({
    where: {
      ...(Object.keys(startAt).length ? { start_at: startAt } : {}),
      ...(Object.keys(distanceKm).length ? { distance_km: distanceKm } : {}),
      ...(searchParams.get('paceMax')
        ? { pace_min_per_km: { lte: Number(searchParams.get('paceMax')) } }
        : {}),
      ...(searchParams.get('difficulty') ? { difficulty: searchParams.get('difficulty') } : {}),
      ...(includeArchived || archiveOnly ? {} : { status: { not: 'archived' } }),
    },
    include: workoutInclude,
    orderBy: [{ created_at: 'desc' }, { start_at: 'desc' }],
    take: 300,
  })

  const synced = []
  for (const row of workouts) {
    const status = await syncWorkoutStatus(prisma, row.id)
    synced.push({
      ...row,
      status: status?.status || row.status,
      updated_at: status?.updated_at || row.updated_at,
    })
  }

  let rows = await buildWorkoutRows(synced, user, { lat, lng })
  rows = rows.filter((row) => filterArchive(row, archiveOnly, includeArchived))
  if (radiusKm != null) {
    rows = rows.filter(
      (row) => row.distance_from_user_km != null && row.distance_from_user_km <= radiusKm
    )
  }
  if (sort === 'distance') {
    rows.sort(
      (a, b) =>
        (a.distance_from_user_km ?? Number.POSITIVE_INFINITY) -
          (b.distance_from_user_km ?? Number.POSITIVE_INFINITY) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  return json({ workouts: rows.slice(0, 100).map((row) => workoutPayload(row, user)) })
})

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  const settings = await getSettings()
  if (settings.require_verified_to_create_workouts && !user.phone_verified) {
    throw forbidden(
      'РЎРѕР·РґР°РЅРёРµ С‚СЂРµРЅРёСЂРѕРІРѕРє РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј СЃ РїРѕРґС‚РІРµСЂР¶РґРµРЅРЅС‹Рј С‚РµР»РµС„РѕРЅРѕРј'
    )
  }

  const data = parseWorkoutBody(await readJson(request))
  validateWorkoutStart(data.startAt, settings)
  const workout = await prisma.$transaction(async (tx) => {
    const created = await tx.workouts.create({
      data: {
        organizer_id: dbId(user.id),
        title: data.title,
        description: data.description,
        start_at: new Date(data.startAt),
        duration_minutes: data.durationMinutes,
        meeting_point_name: data.meetingPoint.name,
        meeting_point_address: data.meetingPoint.address || null,
        meeting_lat: data.meetingPoint.lat || null,
        meeting_lng: data.meetingPoint.lng || null,
        route_name: data.route.name,
        route_geojson: data.route.geojson || null,
        distance_km: data.distanceKm,
        pace_min_per_km: data.paceMinPerKm,
        difficulty: data.difficulty,
        participant_limit: data.participantLimit,
        status: 'open',
      },
      include: workoutInclude,
    })
    await tx.activity_feed.create({
      data: {
        type: 'workout_created',
        actor_id: dbId(user.id),
        workout_id: created.id,
        metadata: { title: created.title },
      },
    })
    return created
  })

  const [row] = await buildWorkoutRows([workout], user)
  return json({ workout: workoutPayload(row, user) }, 201)
})
