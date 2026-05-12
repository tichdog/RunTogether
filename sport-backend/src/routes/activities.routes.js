import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth);

activitiesRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select af.*, actor.full_name as actor_name, target.full_name as target_name, w.title as workout_title
         from activity_feed af
         left join users actor on actor.id = af.actor_id
         left join users target on target.id = af.target_user_id
         left join workouts w on w.id = af.workout_id
        order by af.created_at desc
        limit 100`,
    );
    res.json({ activities: rows });
  } catch (error) {
    next(error);
  }
});
