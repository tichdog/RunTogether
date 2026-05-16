import { requireAuth, requireSelfOrAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { json, route } from "@/lib/server/response";

export const GET = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  requireSelfOrAdmin(user, id);

  const { rows } = await query(
    `select a.*, ua.earned_at
       from user_achievements ua
       join achievements a on a.id = ua.achievement_id
      where ua.user_id = $1
      order by ua.earned_at desc`,
    [id],
  );
  return json({ achievements: rows });
});
