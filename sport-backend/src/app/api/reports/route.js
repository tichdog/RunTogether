import { requireAdmin, requireAuth } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { badRequest } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { getSettings } from "@/lib/services/settings";

export const POST = route(async request => {
  const user = await requireAuth(request);
  const body = await readJson(request);
  const reportedUserId = Number(body.reportedUserId || body.reported_user_id);
  const reason = String(body.reason || "").trim();
  if (!reportedUserId || !reason) throw badRequest("Укажите пользователя и причину жалобы");

  const report = await transaction(async client => {
    const { rows } = await client.query(
      `insert into reports (reporter_id, reported_user_id, reason, details)
       values ($1, $2, $3, $4)
       returning *`,
      [user.id, reportedUserId, reason, body.details || null],
    );

    const settings = await getSettings();
    const { rows: countRows } = await client.query(
      "select count(*)::int as count from reports where reported_user_id = $1 and status = 'open'",
      [reportedUserId],
    );
    if (Number(countRows[0].count) >= Number(settings.auto_block_complaints_count)) {
      await client.query("update users set account_status = 'blocked' where id = $1", [reportedUserId]);
    }
    return rows[0];
  });

  return json({ report }, 201);
});

export const GET = route(async request => {
  const user = await requireAuth(request);
  requireAdmin(user);
  const { rows } = await query(
    `select r.*, reporter.full_name as reporter_name, reported.full_name as reported_user_name
       from reports r
       join users reporter on reporter.id = r.reporter_id
       join users reported on reported.id = r.reported_user_id
      order by r.created_at desc
      limit 100`,
  );
  return json({ reports: rows });
});
