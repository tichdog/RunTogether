import { requireAuth } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { createNotification } from "@/lib/services/notifications";
import { getWorkoutRow, isOwnerOrAdmin } from "@/lib/repositories/workouts";
import { syncWorkoutStatus } from "@/lib/services/workouts";

export const PATCH = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id, requestId } = await context.params;
  const body = await readJson(request);
  const status = body.status;
  if (!["confirmed", "declined"].includes(status)) {
    throw badRequest("Статус должен быть confirmed или declined");
  }

  const result = await transaction(async client => {
    const workout = await getWorkoutRow(client, id, true);
    if (!workout) throw notFound("Тренировка не найдена");
    if (!isOwnerOrAdmin(user, workout)) throw forbidden();
    if (status === "confirmed" && Number(workout.confirmed_count) >= Number(workout.participant_limit)) {
      throw badRequest("Свободных мест нет");
    }

    const { rows } = await client.query(
      `update workout_participants
          set status = $3, responded_at = now()
        where id = $1 and workout_id = $2
        returning *`,
      [requestId, id, status],
    );
    if (!rows[0]) throw notFound("Заявка не найдена");

    await createNotification(client, {
      userId: rows[0].user_id,
      type: "participation_response",
      title: status === "confirmed" ? "Заявка подтверждена" : "Заявка отклонена",
      message: workout.title,
      payload: { workoutId: workout.id, status },
    });

    const synced = await syncWorkoutStatus(client, id);
    return { request: rows[0], workout: synced };
  });

  return json(result);
});
