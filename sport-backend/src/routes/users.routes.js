import { Router } from "express";
import { query } from "../config/db.js";
import { requireAdmin, requireAuth, requireSelfOrAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { publicUser } from "../utils/userMapper.js";

export const usersRouter = Router();

const USER_SELECT = `
  select u.*, s.organized_workouts, s.attended_workouts, s.total_distance_km,
         s.average_rating, s.complaints_count,
         (u.privacy_settings->>'hide_email')::boolean as hide_email,
         (u.privacy_settings->>'hide_phone')::boolean as hide_phone
    from users u
    left join user_training_stats s on s.user_id = u.id
`;

usersRouter.use(requireAuth);

usersRouter.get("/", requireAdmin, async (req, res, next) => {
  try {
    const search = `%${String(req.query.search || "").trim()}%`;
    const role = req.query.role;
    const status = req.query.status;
    const { rows } = await query(
      `${USER_SELECT}
       where ($1 = '%%' or u.full_name ilike $1 or u.email ilike $1 or u.phone ilike $1)
         and ($2::text is null or u.role = $2)
         and ($3::text is null or u.account_status = $3)
       order by u.created_at desc
       limit 100`,
      [search, role || null, status || null],
    );
    res.json({ users: rows.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", requireSelfOrAdmin("id"), async (req, res, next) => {
  try {
    const { rows } = await query(`${USER_SELECT} where u.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound("Пользователь не найден");
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/me", async (req, res, next) => {
  try {
    const firstName = String(req.body.firstName || req.body.first_name || req.user.first_name || "").trim();
    const lastName = String(req.body.lastName || req.body.last_name || req.user.last_name || "").trim();
    const gender = req.body.gender || req.user.gender || null;
    const phone = req.body.phone === "" ? null : (req.body.phone ?? req.user.phone);
    const fullName = String(req.body.fullName || req.body.name || `${firstName} ${lastName}`).trim();
    const privacy = req.body.privacy || req.body.privacySettings || {};
    if (!fullName || !firstName || !lastName) throw badRequest("Фамилия и имя обязательны");
    if (gender && !["male", "female", "other"].includes(gender)) throw badRequest("Некорректный пол");

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
      [req.user.id, firstName, lastName, gender, phone, fullName, JSON.stringify(privacy)],
    );
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === "23505") return next(badRequest("Такой телефон уже используется"));
    next(error);
  }
});

usersRouter.post("/me/avatar", upload.single("avatar"), async (req, res, next) => {
  try {
    const avatarUrl = `/uploads/${req.file.filename}`;
    const { rows } = await query(
      "update users set avatar_url = $2, updated_at = now() where id = $1 returning *",
      [req.user.id, avatarUrl],
    );
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const role = req.body.role;
    if (!["member", "admin"].includes(role)) throw badRequest("Некорректная роль");
    const { rows } = await query(
      "update users set role = $2, updated_at = now() where id = $1 returning *",
      [req.params.id, role],
    );
    if (!rows[0]) throw notFound("Пользователь не найден");
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/:id/block", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      "update users set account_status = 'blocked', updated_at = now() where id = $1 returning *",
      [req.params.id],
    );
    if (!rows[0]) throw notFound("Пользователь не найден");
    res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id/history", requireSelfOrAdmin("id"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `select date_trunc('month', w.start_at) as month,
              count(*) as workouts_count,
              coalesce(sum(w.distance_km), 0) as distance_km
         from workout_participants wp
         join workouts w on w.id = wp.workout_id
        where wp.user_id = $1 and wp.status = 'confirmed' and w.status = 'completed'
        group by 1
        order by 1 desc`,
      [req.params.id],
    );
    res.json({ history: rows });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id/achievements", requireSelfOrAdmin("id"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `select a.*, ua.earned_at
         from user_achievements ua
         join achievements a on a.id = ua.achievement_id
        where ua.user_id = $1
        order by ua.earned_at desc`,
      [req.params.id],
    );
    res.json({ achievements: rows });
  } catch (error) {
    next(error);
  }
});
