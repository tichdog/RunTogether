import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { badRequest } from "@/lib/server/http-error";
import { publicUser } from "@/lib/mappers/user";
import { json, readJson, route } from "@/lib/server/response";

export const PATCH = route(async request => {
  const user = await requireAuth(request);
  const body = await readJson(request);

  const firstName = String(body.firstName || body.first_name || user.first_name || "").trim();
  const lastName = String(body.lastName || body.last_name || user.last_name || "").trim();
  const gender = body.gender || user.gender || null;
  const phone = body.phone === "" ? null : (body.phone ?? user.phone);
  const fullName = String(body.fullName || body.name || `${firstName} ${lastName}`).trim();
  const privacy = body.privacy || body.privacySettings || {};

  if (!fullName || !firstName || !lastName) throw badRequest("Фамилия и имя обязательны");
  if (gender && !["male", "female", "other"].includes(gender)) throw badRequest("Некорректный пол");

  try {
    const { rows } = await query(
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
    return json({ user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === "23505") throw badRequest("Такой телефон уже используется");
    throw error;
  }
});
