import { query } from "../server/db";

export const USER_SELECT = `
  select u.*, s.organized_workouts, s.attended_workouts, s.total_distance_km,
         s.average_rating, s.complaints_count,
         (u.privacy_settings->>'hide_email')::boolean as hide_email,
         (u.privacy_settings->>'hide_phone')::boolean as hide_phone
    from users u
    left join user_training_stats s on s.user_id = u.id
`;

export async function getUserRole(id) {
  const { rows } = await query("select id, role from users where id = $1", [id]);
  return rows[0];
}
