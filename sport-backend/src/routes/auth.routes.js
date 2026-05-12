import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { badRequest, HttpError } from "../utils/httpError.js";
import { clearSessionCookie, requireAuth, setSessionCookie, signSession } from "../middleware/auth.js";
import { publicUser } from "../utils/userMapper.js";

export const authRouter = Router();

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

authRouter.post("/register", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const gender = String(req.body.gender || "").trim();
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

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `insert into users (email, phone, password_hash, first_name, last_name, gender, full_name)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [email, phone, passwordHash, firstName, lastName, gender, fullName],
    );

    const token = signSession(rows[0]);
    setSessionCookie(res, token);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === "23505") return next(new HttpError(409, "Пользователь с такой почтой или телефоном уже существует"));
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const login = String(req.body.login || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!login || !password) throw badRequest("Укажите логин и пароль");

    const { rows } = await query(
      `select * from users where lower(email) = $1 or phone = $2 limit 1`,
      [login, req.body.login],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, "Неверный логин или пароль");
    }
    if (user.account_status === "blocked") {
      throw new HttpError(403, "Пользователь заблокирован");
    }

    const token = signSession(user);
    setSessionCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await query(
    `select u.*, s.organized_workouts, s.attended_workouts, s.total_distance_km,
            s.average_rating, s.complaints_count
       from users u
       left join user_training_stats s on s.user_id = u.id
      where u.id = $1`,
    [req.user.id],
  );
  res.json({ user: publicUser(rows[0]) });
});
