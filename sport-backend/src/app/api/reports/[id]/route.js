import { requireAdmin, requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { badRequest, notFound } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request);
  requireAdmin(user);
  const { id } = await context.params;
  const body = await readJson(request);
  const status = body.status;
  if (!["reviewed", "dismissed"].includes(status)) throw badRequest("Некорректный статус");

  const { rows } = await query(
    `update reports
        set status = $2, moderator_id = $3, resolved_at = now()
      where id = $1
      returning *`,
    [id, status, user.id],
  );
  if (!rows[0]) throw notFound("Жалоба не найдена");
  return json({ report: rows[0] });
});
