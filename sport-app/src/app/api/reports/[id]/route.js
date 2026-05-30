import { isAdmin, requireAdmin, requireAuth } from '@/lib/server/auth'
import { mapReport, reportInclude } from '@/lib/mappers/report'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest, forbidden, notFound } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { createNotification } from '@/lib/services/notifications'

function banUntilFromBody(body) {
  const mode = String(body.banMode || body.duration || 'permanent')
  if (mode === 'permanent') return null

  const days = Number(body.banDays || body.days)
  if (!Number.isFinite(days) || days <= 0) {
    throw badRequest('Укажите срок бана в днях')
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function ensureCanModerateTarget(moderator, target) {
  if (Number(moderator.id) === Number(target.id)) {
    throw badRequest('Нельзя модерировать жалобу на самого себя')
  }
  if (isAdmin(target) && moderator.role !== 'super_admin') {
    throw forbidden('Модерировать администраторов может только супер-админ')
  }
}

async function getReport(id) {
  const report = await prisma.reports.findUnique({
    where: { id: dbId(id) },
    include: reportInclude,
  })
  return report ? mapReport(report) : null
}

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request)
  requireAdmin(user)
  const { id } = await context.params
  const body = await readJson(request)
  const action = String(body.action || body.status || '').trim()
  const moderatorComment = String(body.moderatorComment || body.comment || '').trim()

  if (!['warn', 'ban', 'dismiss', 'reviewed', 'dismissed'].includes(action)) {
    throw badRequest('Некорректное решение по жалобе')
  }

  await prisma.$transaction(async (tx) => {
    const report = await tx.reports.findUnique({
      where: { id: dbId(id) },
      include: { users_reports_reported_user_idTousers: true },
    })
    if (!report) throw notFound('Жалоба не найдена')

    const target = report.users_reports_reported_user_idTousers
    ensureCanModerateTarget(user, target)

    if (action === 'dismiss' || action === 'dismissed') {
      await tx.reports.update({
        where: { id: report.id },
        data: {
          status: 'dismissed',
          resolution_action: 'dismiss',
          moderator_comment: moderatorComment || null,
          moderator_id: dbId(user.id),
          resolved_at: now(),
          updated_at: now(),
        },
      })
      return
    }

    if (action === 'warn' || action === 'reviewed') {
      const warningText = String(
        body.warningText || report.reason || 'Предупреждение по жалобе'
      ).trim()
      const warningMessage = moderatorComment || warningText
      await tx.user_warnings.create({
        data: {
          user_id: report.reported_user_id,
          moderator_id: dbId(user.id),
          report_id: report.id,
          reason: warningText,
          comment: moderatorComment || report.details || null,
        },
      })
      await tx.users.update({
        where: { id: report.reported_user_id },
        data: {
          warning_count: { increment: 1 },
          updated_at: now(),
        },
      })
      await tx.reports.update({
        where: { id: report.id },
        data: {
          status: 'warned',
          resolution_action: 'warn',
          moderator_comment: moderatorComment || null,
          moderator_id: dbId(user.id),
          resolved_at: now(),
          updated_at: now(),
        },
      })
      await createNotification(tx, {
        userId: report.reported_user_id,
        type: 'moderation_warning',
        title: 'Предупреждение от модератора',
        message: warningMessage,
        payload: {
          reportId: Number(id),
          reason: warningText,
          moderatorComment: moderatorComment || null,
        },
      })
      return
    }

    const banUntil = banUntilFromBody(body)
    const reason = moderatorComment || report.reason
    await tx.users.update({
      where: { id: report.reported_user_id },
      data: {
        account_status: 'blocked',
        blocked_until: banUntil,
        block_reason: reason,
        updated_at: now(),
      },
    })
    await tx.reports.update({
      where: { id: report.id },
      data: {
        status: 'banned',
        resolution_action: 'ban',
        moderator_comment: moderatorComment || null,
        moderator_id: dbId(user.id),
        ban_until: banUntil,
        resolved_at: now(),
        updated_at: now(),
      },
    })
    await createNotification(tx, {
      userId: report.reported_user_id,
      type: 'moderation_ban',
      title: 'Аккаунт заблокирован',
      message: banUntil
        ? `Бан до ${banUntil.toLocaleDateString('ru-RU')}`
        : 'Аккаунт заблокирован навсегда',
      payload: { reportId: Number(id), banUntil },
    })
  })

  const report = await getReport(id)
  return json({ report })
})
