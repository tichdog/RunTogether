import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { publicUser } from "@/lib/mappers/user";
import { json, route } from "@/lib/server/response";

export const GET = route(async request => {
  const user = await requireAuth(request);
  const { rows } = await query(
    `select u.*, s.organized_workouts, s.attended_workouts, s.total_distance_km,
            s.average_rating, s.complaints_count
       from users u
       left join user_training_stats s on s.user_id = u.id
      where u.id = $1`,
    [user.id],
  );
  return json({ user: publicUser(rows[0], { viewer: user }) });
});
