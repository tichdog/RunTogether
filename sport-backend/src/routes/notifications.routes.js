import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select * from notifications
        where user_id = $1
        order by created_at desc
        limit 100`,
      [req.user.id],
    );
    res.json({ notifications: rows });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const { rows } = await query(
      `update notifications set read_at = now()
        where id = $1 and user_id = $2
        returning *`,
      [req.params.id, req.user.id],
    );
    res.json({ notification: rows[0] || null });
  } catch (error) {
    next(error);
  }
});
