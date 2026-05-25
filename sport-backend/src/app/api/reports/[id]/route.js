import { isAdmin, requireAdmin, requireAuth } from "@/lib/server/auth";
import { mapReport, REPORT_SELECT } from "@/lib/mappers/report";
import { query, transaction } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { createNotification } from "@/lib/services/notifications";

function banUntilFromBody(body) {
  const mode = String(body.banMode || body.duration || "permanent");
  if (mode === "permanent") return null;

  const days = Number(body.banDays || body.days);
  if (!Number.isFinite(days) || days <= 0) {
    throw badRequest("Укажите срок бана в днях");
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function ensureCanModerateTarget(moderator, target) {
  if (Number(moderator.id) === Number(target.id)) {
    throw badRequest("Нельзя модерировать жалобу на самого себя");
  }
  if (isAdmin(target) && moderator.role !== "super_admin") {
    throw forbidden("Модерировать администраторов может только супер-админ");
  }
}

async function getReport(id) {
  const { rows } = await query(`${REPORT_SELECT} where r.id = $1`, [id]);
  return rows[0] ? mapReport(rows[0]) : null;
}

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request);
  requireAdmin(user);
  const { id } = await context.params;
  const body = await readJson(request);
  const action = String(body.action || body.status || "").trim();
  const moderatorComment = String(body.moderatorComment || body.comment || "").trim();

  if (!["warn", "ban", "dismiss", "reviewed", "dismissed"].includes(action)) {
    throw badRequest("Некорректное решение по жалобе");
  }

  await transaction(async client => {
    const { rows: reportRows } = await client.query(
      `select r.*, target.id as target_id, target.role as target_role
         from reports r
         join users target on target.id = r.reported_user_id
        where r.id = $1
        for update`,
      [id],
    );
    const report = reportRows[0];
    if (!report) throw notFound("Жалоба не найдена");

    ensureCanModerateTarget(user, { id: report.target_id, role: report.target_role });

    if (action === "dismiss" || action === "dismissed") {
      await client.query(
        `update reports
            set status = 'dismissed',
                resolution_action = 'dismiss',
                moderator_comment = $2,
                moderator_id = $3,
                resolved_at = now(),
                updated_at = now()
          where id = $1`,
        [id, moderatorComment || null, user.id],
      );
      return;
    }

    if (action === "warn" || action === "reviewed") {
      const warningText = String(body.warningText || report.reason || "Предупреждение по жалобе").trim();
      await client.query(
        `insert into user_warnings (user_id, moderator_id, report_id, reason, comment)
         values ($1, $2, $3, $4, $5)`,
        [report.reported_user_id, user.id, id, warningText, moderatorComment || report.details || null],
      );
      await client.query(
        "update users set warning_count = warning_count + 1, updated_at = now() where id = $1",
        [report.reported_user_id],
      );
      await client.query(
        `update reports
            set status = 'warned',
                resolution_action = 'warn',
                moderator_comment = $2,
                moderator_id = $3,
                resolved_at = now(),
                updated_at = now()
          where id = $1`,
        [id, moderatorComment || null, user.id],
      );
      await createNotification(client, {
        userId: report.reported_user_id,
        type: "moderation_warning",
        title: "Предупреждение от модератора",
        message: warningText,
        payload: { reportId: Number(id) },
      });
      return;
    }

    const banUntil = banUntilFromBody(body);
    const reason = moderatorComment || report.reason;
    await client.query(
      `update users
          set account_status = 'blocked',
              blocked_until = $2,
              block_reason = $3,
              updated_at = now()
        where id = $1`,
      [report.reported_user_id, banUntil, reason],
    );
    await client.query(
      `update reports
          set status = 'banned',
              resolution_action = 'ban',
              moderator_comment = $2,
              moderator_id = $3,
              ban_until = $4,
              resolved_at = now(),
              updated_at = now()
        where id = $1`,
      [id, moderatorComment || null, user.id, banUntil],
    );
    await createNotification(client, {
      userId: report.reported_user_id,
      type: "moderation_ban",
      title: "Аккаунт заблокирован",
      message: banUntil ? `Бан до ${banUntil.toLocaleDateString("ru-RU")}` : "Аккаунт заблокирован навсегда",
      payload: { reportId: Number(id), banUntil },
    });
  });

  const report = await getReport(id);
  return json({ report });
});
