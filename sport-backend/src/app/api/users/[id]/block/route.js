import { requireAdmin, requireAuth, isAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { publicUser } from "@/lib/mappers/user";
import { getUserRole } from "@/lib/repositories/users";
import { json, route } from "@/lib/server/response";

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request);
  requireAdmin(user);
  const { id } = await context.params;
  const target = await getUserRole(id);

  if (!target) throw notFound("Пользователь не найден");
  if (Number(target.id) === Number(user.id)) {
    throw badRequest("Нельзя заблокировать самого себя");
  }
  if (isAdmin(target) && user.role !== "super_admin") {
    throw forbidden("Блокировать админов может только супер-админ");
  }

  const { rows } = await query(
    "update users set account_status = 'blocked', updated_at = now() where id = $1 returning *",
    [id],
  );
  return json({ user: publicUser(rows[0], { viewer: user }) });
});
