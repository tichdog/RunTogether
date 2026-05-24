import { requireAdmin, requireAuth, isAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { publicUser } from "@/lib/mappers/user";
import { getUserRole, USER_SELECT } from "@/lib/repositories/users";
import { json, route } from "@/lib/server/response";
import { saveImageUpload } from "@/lib/server/uploads";

export const POST = route(async (request, context) => {
  const user = await requireAuth(request);
  requireAdmin(user);
  const { id } = await context.params;
  const target = await getUserRole(id);

  if (!target) throw notFound("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");
  if (Number(target.id) !== Number(user.id) && isAdmin(target) && user.role !== "super_admin") {
    throw forbidden("РђРІР°С‚Р°СЂС‹ Р°РґРјРёРЅРѕРІ РјРѕР¶РµС‚ РјРµРЅСЏС‚СЊ С‚РѕР»СЊРєРѕ СЃСѓРїРµСЂ-Р°РґРјРёРЅ");
  }

  const form = await request.formData();
  const avatarUrl = await saveImageUpload(form.get("avatar"));
  const { rowCount } = await query(
    "update users set avatar_url = $2, updated_at = now() where id = $1",
    [id, avatarUrl],
  );

  if (!rowCount) throw badRequest("РђРІР°С‚Р°СЂ РЅРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ");

  const { rows } = await query(`${USER_SELECT} where u.id = $1`, [id]);
  return json({ user: publicUser(rows[0]) });
});
