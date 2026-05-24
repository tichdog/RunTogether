import bcrypt from "bcryptjs";
import { query } from "@/lib/server/db";
import { HttpError, badRequest } from "@/lib/server/http-error";
import { setSessionCookie, signSession } from "@/lib/server/auth";
import { publicUser } from "@/lib/mappers/user";
import { json, readJson, route } from "@/lib/server/response";

export const POST = route(async request => {
  const body = await readJson(request);
  const login = String(body.login || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!login || !password) throw badRequest("Укажите логин и пароль");

  const { rows } = await query(
    "select * from users where lower(email) = $1 or phone = $2 limit 1",
    [login, body.login],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, "Неверный логин или пароль");
  }
  if (user.account_status === "blocked") {
    throw new HttpError(403, "Пользователь заблокирован");
  }

  const response = json({ user: publicUser(user) });
  setSessionCookie(response, signSession(user));
  return response;
});
