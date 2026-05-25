import bcrypt from "bcryptjs";
import { query } from "@/lib/server/db";
import { badRequest, HttpError } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { publicUser } from "@/lib/mappers/user";
import { setSessionCookie, signSession } from "@/lib/server/auth";

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

function normalizePhone(phone) {
  const value = phone ? String(phone).trim() : "";
  return value || null;
}

const NAME_RE = /^\p{L}{2,15}$/u;
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u;
const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const STRONG_PASSWORD_RE = /^(?=.*[a-zа-яё])(?=.*[A-ZА-ЯЁ])(?=.*\d)(?=.*[^A-Za-zА-Яа-яЁё0-9]).{8,}$/;

export const POST = route(async request => {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const password = String(body.password || "");
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const gender = String(body.gender || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (!NAME_RE.test(firstName)) {
    throw badRequest("Имя должно содержать только буквы, от 2 до 15 символов");
  }
  if (!LAST_NAME_RE.test(lastName)) {
    throw badRequest("Фамилия должна содержать буквы от 2 до 15 символов. Двойная фамилия пишется через дефис");
  }
  if (!email || !EMAIL_RE.test(email)) {
    throw badRequest("Некорректный email");
  }
  if (!["male", "female"].includes(gender)) {
    throw badRequest("Укажите пол");
  }
  if (!STRONG_PASSWORD_RE.test(password)) {
    throw badRequest("Пароль должен быть от 8 символов и содержать прописные, строчные буквы, цифры и символы");
  }

  const existing = await query(
    `select email, phone from users
      where lower(email) = $1 or ($2::text is not null and phone = $2)
      limit 1`,
    [email, phone],
  );
  if (existing.rows[0]?.email?.toLowerCase() === email) {
    throw new HttpError(409, "Пользователь с такой почтой уже существует");
  }
  if (phone && existing.rows[0]?.phone === phone) {
    throw new HttpError(409, "Пользователь с таким телефоном уже существует");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `insert into users (email, phone, password_hash, first_name, last_name, gender, full_name)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [email, phone, passwordHash, firstName, lastName, gender, fullName],
    );

    const response = json({ user: publicUser(rows[0], { viewer: rows[0] }) }, 201);
    setSessionCookie(response, signSession(rows[0]));
    return response;
  } catch (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "Пользователь с такой почтой или телефоном уже существует");
    }
    throw error;
  }
});
