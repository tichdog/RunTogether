import { Router } from "express";
import { transaction, query } from "../config/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { getSettings } from "../services/settings.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.post("/", async (req, res, next) => {
  try {
    const reportedUserId = Number(req.body.reportedUserId || req.body.reported_user_id);
    const reason = String(req.body.reason || "").trim();
    if (!reportedUserId || !reason) throw badRequest("Укажите пользователя и причину жалобы");

    const report = await transaction(async client => {
      const { rows } = await client.query(
        `insert into reports (reporter_id, reported_user_id, reason, details)
         values ($1, $2, $3, $4)
         returning *`,
        [req.user.id, reportedUserId, reason, req.body.details || null],
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

    res.status(201).json({ report });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `select r.*, reporter.full_name as reporter_name, reported.full_name as reported_user_name
         from reports r
         join users reporter on reporter.id = r.reporter_id
         join users reported on reported.id = r.reported_user_id
        order by r.created_at desc
        limit 100`,
    );
    res.json({ reports: rows });
  } catch (error) {
    next(error);
  }
});

reportsRouter.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["reviewed", "dismissed"].includes(status)) throw badRequest("Некорректный статус");
    const { rows } = await query(
      `update reports
          set status = $2, moderator_id = $3, resolved_at = now()
        where id = $1
        returning *`,
      [req.params.id, status, req.user.id],
    );
    if (!rows[0]) throw notFound("Жалоба не найдена");
    res.json({ report: rows[0] });
  } catch (error) {
    next(error);
  }
});
