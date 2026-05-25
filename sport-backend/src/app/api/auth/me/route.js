import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { publicUser } from "@/lib/mappers/user";
import { USER_SELECT } from "@/lib/repositories/users";
import { json, route } from "@/lib/server/response";

export const GET = route(async request => {
  const user = await requireAuth(request);
  const { rows } = await query(`${USER_SELECT} where u.id = $1`, [user.id]);
  return json({ user: publicUser(rows[0], { viewer: user }) });
});
