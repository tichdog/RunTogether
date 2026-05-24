import { requireAuth } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";
import { badRequest, forbidden } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { evaluateAchievements } from "@/lib/services/achievements";

export const POST = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  const body = await readJson(request);
  const rating = Number(body.rating);
  const revieweeId = Number(body.revieweeId || body.reviewee_id);
  if (!revieweeId || rating < 1 || rating > 5) {
    throw badRequest("Укажите пользователя и оценку 1-5");
  }

  const review = await transaction(async client => {
    const { rows: allowed } = await client.query(
      `select 1
         from workout_participants a
         join workout_participants b on b.workout_id = a.workout_id
         join workouts w on w.id = a.workout_id
        where a.workout_id = $1 and a.user_id = $2 and a.status = 'confirmed'
          and b.user_id = $3 and b.status = 'confirmed'
          and w.status = 'completed'`,
      [id, user.id, revieweeId],
    );
    if (!allowed[0]) throw forbidden("Оценивать можно только участников завершенной тренировки");

    const { rows } = await client.query(
      `insert into reviews (workout_id, reviewer_id, reviewee_id, rating, text)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [id, user.id, revieweeId, rating, body.text || null],
    );
    await evaluateAchievements(client, revieweeId);
    return rows[0];
  });

  return json({ review }, 201);
});
