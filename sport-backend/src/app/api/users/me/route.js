import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { badRequest } from "@/lib/server/http-error";
import { publicUser } from "@/lib/mappers/user";
import { USER_SELECT } from "@/lib/repositories/users";
import { json, readJson, route } from "@/lib/server/response";

const NAME_RE = /^\p{L}{2,15}$/u;
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u;

export const PATCH = route(async request => {
  const user = await requireAuth(request);
  const body = await readJson(request);

  const firstName = String(body.firstName || body.first_name || user.first_name || "").trim();
  const lastName = String(body.lastName || body.last_name || user.last_name || "").trim();
  const gender = String(body.gender || user.gender || "").trim();
  const phone = body.phone === "" ? null : (body.phone ?? user.phone);
  const fullName = `${firstName} ${lastName}`.trim();
  const privacy = body.privacy || body.privacySettings || {};

  if (!NAME_RE.test(firstName)) {
    throw badRequest("Имя должно содержать только буквы, от 2 до 15 символов");
  }
  if (!LAST_NAME_RE.test(lastName)) {
    throw badRequest("Фамилия должна содержать буквы от 2 до 15 символов. Двойная фамилия пишется через дефис");
  }
  if (!["male", "female"].includes(gender)) throw badRequest("Некорректный пол");

  try {
    await query(
      `update users
          set first_name = $2,
              last_name = $3,
              gender = $4,
              phone = $5,
              full_name = $6,
              privacy_settings = privacy_settings || $7::jsonb,
              updated_at = now()
        where id = $1
        returning *`,
      [user.id, firstName, lastName, gender, phone, fullName, JSON.stringify(privacy)],
    );
    const { rows } = await query(`${USER_SELECT} where u.id = $1`, [user.id]);
    return json({ user: publicUser(rows[0], { viewer: user }) });
  } catch (error) {
    if (error.code === "23505") throw badRequest("Такой телефон уже используется");
    throw error;
  }
});
