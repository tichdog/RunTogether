import { isAdmin, requireAdmin, requireAuth } from '@/lib/server/auth'
import { mapReport, REPORT_SELECT } from '@/lib/mappers/report'
import { query, transaction } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { getSettings } from '@/lib/services/settings'

export const POST = route(async (request) => {
  const user = await requireAuth(request)
  const body = await readJson(request)
  const reportedUserId = Number(body.reportedUserId || body.reported_user_id)
  const reason = String(body.reason || '').trim()
  const details = String(body.details || '').trim()

  if (!reportedUserId || !reason) throw badRequest('Укажите пользователя и причину жалобы')
  if (Number(reportedUserId) === Number(user.id))
    throw badRequest('Нельзя отправить жалобу на себя')

  const report = await transaction(async (client) => {
    const { rows: targetRows } = await client.query('select id, role from users where id = $1', [
      reportedUserId,
    ])
    const target = targetRows[0]
    if (!target) throw badRequest('Пользователь не найден')

    const { rows: existingRows } = await client.query(
      `select id from reports
        where reporter_id = $1 and reported_user_id = $2 and status = 'open'
        limit 1`,
      [user.id, reportedUserId]
    )
    if (existingRows[0]) throw badRequest('У вас уже есть открытая жалоба на этого пользователя')

    const { rows } = await client.query(
      `insert into reports (reporter_id, reported_user_id, reason, details)
       values ($1, $2, $3, $4)
       returning *`,
      [user.id, reportedUserId, reason, details || null]
    )

    const settings = await getSettings()
    const { rows: countRows } = await client.query(
      "select count(distinct reporter_id)::int as count from reports where reported_user_id = $1 and status = 'open'",
      [reportedUserId]
    )

    if (
      !isAdmin(target) &&
      Number(countRows[0].count) >= Number(settings.auto_block_complaints_count)
    ) {
      await client.query(
        `update users
            set account_status = 'blocked',
                blocked_until = null,
                block_reason = $2,
                updated_at = now()
          where id = $1`,
        [reportedUserId, `Автобан: ${countRows[0].count} открытых жалоб`]
      )
    }

    return rows[0]
  })

  return json({ report }, 201)
})

export const GET = route(async (request) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const where =
    {
      open: "where r.status = 'open'",
      archive: "where r.status <> 'open'",
      all: '',
    }[status] ?? ''
  const { rows } = await query(
    `${REPORT_SELECT}
      ${where}
      order by case when r.status = 'open' then 0 else 1 end, r.created_at desc
      limit 300`
  )
  return json({ reports: rows.map(mapReport) })
})
