import { query } from "../server/db";

export const USER_SELECT = `
  select u.*, s.organized_workouts, s.attended_workouts, s.total_distance_km,
         s.average_rating, s.complaints_count,
         (u.privacy_settings->>'hide_email')::boolean as hide_email,
         (u.privacy_settings->>'hide_phone')::boolean as hide_phone,
         coalesce(user_achievements_list.achievements, '[]'::json) as achievements
    from users u
    left join user_training_stats s on s.user_id = u.id
    left join lateral (
      select json_agg(
               json_build_object(
                 'id', a.id,
                 'code', a.code,
                 'title', a.title,
                 'description', a.description,
                 'icon', a.icon,
                 'condition', a.condition,
                 'earnedAt', ua.earned_at
               )
               order by ua.earned_at desc
             ) as achievements
        from user_achievements ua
        join achievements a on a.id = ua.achievement_id
       where ua.user_id = u.id
    ) user_achievements_list on true
`;

export async function getUserRole(id) {
  const { rows } = await query("select id, role from users where id = $1", [id]);
  return rows[0];
}
