import { isAdmin, requireAdmin, requireAuth } from '@/lib/server/auth'
import { mapReport, reportInclude } from '@/lib/mappers/report'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  const body = await readJson(request)
  const reportedUserId = Number(body.reportedUserId || body.reported_user_id)
  const reason = String(body.reason || '').trim()
  const details = String(body.details || '').trim()

  if (!reportedUserId || !reason)
    throw badRequest('РЈРєР°Р¶РёС‚Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РїСЂРёС‡РёРЅСѓ Р¶Р°Р»РѕР±С‹')
  if (Number(reportedUserId) === Number(user.id))
    throw badRequest('РќРµР»СЊР·СЏ РѕС‚РїСЂР°РІРёС‚СЊ Р¶Р°Р»РѕР±Сѓ РЅР° СЃРµР±СЏ')

  const report = await prisma.$transaction(async (tx) => {
    const target = await tx.users.findUnique({
      where: { id: dbId(reportedUserId) },
      select: { id: true, role: true },
    })
    if (!target) throw badRequest('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ')

    const existing = await tx.reports.findFirst({
      where: {
        reporter_id: dbId(user.id),
        reported_user_id: dbId(reportedUserId),
        status: 'open',
      },
      select: { id: true },
    })
    if (existing)
      throw badRequest(
        'РЈ РІР°СЃ СѓР¶Рµ РµСЃС‚СЊ РѕС‚РєСЂС‹С‚Р°СЏ Р¶Р°Р»РѕР±Р° РЅР° СЌС‚РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ'
      )

    const created = await tx.reports.create({
      data: {
        reporter_id: dbId(user.id),
        reported_user_id: dbId(reportedUserId),
        reason,
        details: details || null,
      },
    })

    const settings = await getSettings()
    const openReports = await tx.reports.findMany({
      where: { reported_user_id: dbId(reportedUserId), status: 'open' },
      select: { reporter_id: true },
      distinct: ['reporter_id'],
    })

    if (!isAdmin(target) && openReports.length >= Number(settings.auto_block_complaints_count)) {
      await tx.users.update({
        where: { id: dbId(reportedUserId) },
        data: {
          account_status: 'blocked',
          blocked_until: null,
          block_reason: `РђРІС‚РѕР±Р°РЅ: ${openReports.length} РѕС‚РєСЂС‹С‚С‹С… Р¶Р°Р»РѕР±`,
          updated_at: now(),
        },
      })
    }

    return created
  })

  return json({ report }, 201)
})

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const reports = await prisma.reports.findMany({
    where:
      status === 'open'
        ? { status: 'open' }
        : status === 'archive'
          ? { status: { not: 'open' } }
          : {},
    include: reportInclude,
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    take: 300,
  })
  reports.sort((a, b) => {
    const statusRank = (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1)
    if (statusRank) return statusRank
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return json({ reports: reports.map(mapReport) })
})
