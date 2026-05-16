import { requireAdmin, requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { publicUser } from "@/lib/mappers/user";
import { USER_SELECT } from "@/lib/repositories/users";
import { json, route } from "@/lib/server/response";

export const GET = route(async request => {
  const user = await requireAuth(request);
  requireAdmin(user);

  const { searchParams } = new URL(request.url);
  const search = `%${String(searchParams.get("search") || "").trim()}%`;
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const { rows } = await query(
    `${USER_SELECT}
     where ($1 = '%%' or u.full_name ilike $1 or u.email ilike $1 or u.phone ilike $1)
       and ($2::text is null or u.role = $2)
       and ($3::text is null or u.account_status = $3)
     order by u.created_at desc
     limit 100`,
    [search, role || null, status || null],
  );

  return json({ users: rows.map(publicUser) });
});
