import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../config/db.js";
import { HttpError, forbidden } from "../utils/httpError.js";

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function setSessionCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
  });
}

export async function requireAuth(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.[env.cookieName] || bearer;

    if (!token) {
      throw new HttpError(401, "Нужна авторизация");
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const { rows } = await query(
      `select id, email, phone, full_name, role, account_status, phone_verified, email_verified,
              verification_status, avatar_url, privacy_settings, created_at
         from users
        where id = $1`,
      [payload.sub],
    );

    const user = rows[0];
    if (!user || user.account_status === "blocked") {
      throw new HttpError(401, "Сессия недействительна");
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error.status ? error : new HttpError(401, "Сессия недействительна"));
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(forbidden("Доступно только администратору"));
  }
  return next();
}

export function requireSelfOrAdmin(paramName = "id") {
  return (req, res, next) => {
    if (req.user?.role === "admin" || Number(req.params[paramName]) === Number(req.user?.id)) {
      return next();
    }
    return next(forbidden());
  };
}
