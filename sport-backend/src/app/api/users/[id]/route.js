import { requireAdmin, requireAuth, requireSelfOrAdmin, isAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { publicUser } from "@/lib/mappers/user";
import { getUserRole, USER_SELECT } from "@/lib/repositories/users";
import { json, noContent, route } from "@/lib/server/response";

export const GET = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  requireSelfOrAdmin(user, id);

  const { rows } = await query(`${USER_SELECT} where u.id = $1`, [id]);
  if (!rows[0]) throw notFound("Пользователь не найден");
  return json({ user: publicUser(rows[0]) });
});

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request);
  requireAdmin(user);
  const { id } = await context.params;
  const target = await getUserRole(id);

  if (!target) throw notFound("Пользователь не найден");
  if (Number(target.id) === Number(user.id)) {
    throw badRequest("Админ не может удалить сам себя");
  }
  if (isAdmin(target) && user.role !== "super_admin") {
    throw forbidden("Удалять админов может только супер-админ");
  }
  if (target.role === "super_admin") {
    const { rows } = await query("select count(*)::int as count from users where role = 'super_admin'");
    if (rows[0].count <= 1) {
      throw badRequest("Нельзя удалить последнего супер-админа");
    }
  }

  await query("delete from users where id = $1", [id]);
  return noContent();
});
