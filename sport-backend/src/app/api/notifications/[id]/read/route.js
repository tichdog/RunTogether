import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { json, route } from "@/lib/server/response";

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  const { rows } = await query(
    `update notifications set read_at = now()
      where id = $1 and user_id = $2
      returning *`,
    [id, user.id],
  );
  return json({ notification: rows[0] || null });
});
