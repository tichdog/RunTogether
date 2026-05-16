import jwt from "jsonwebtoken";
import { env } from "./env";
import { query } from "./db";
import { forbidden, HttpError } from "./http-error";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export function isAdmin(user) {
  return ADMIN_ROLES.has(user?.role);
}

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}

export function setSessionCookie(response, token) {
  response.cookies.set(env.cookieName, token, cookieOptions());
}

export function clearSessionCookie(response) {
  response.cookies.set(env.cookieName, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
}

export async function requireAuth(request) {
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ")
    ? request.headers.get("authorization").slice(7)
    : null;
  const token = request.cookies.get(env.cookieName)?.value || bearer;

  if (!token) {
    throw new HttpError(401, "Нужна авторизация");
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const { rows } = await query(
      `select id, email, phone, first_name, last_name, gender, full_name, role, account_status, phone_verified, email_verified,
              verification_status, avatar_url, privacy_settings, created_at
         from users
        where id = $1`,
      [payload.sub],
    );

    const user = rows[0];
    if (!user || user.account_status === "blocked") {
      throw new HttpError(401, "Сессия недействительна");
    }

    return user;
  } catch (error) {
    if (error.status) throw error;
    throw new HttpError(401, "Сессия недействительна");
  }
}

export function requireAdmin(user) {
  if (!isAdmin(user)) {
    throw forbidden("Доступно только администратору");
  }
}

export function requireSelfOrAdmin(user, id) {
  if (isAdmin(user) || Number(id) === Number(user?.id)) {
    return;
  }
  throw forbidden();
}
