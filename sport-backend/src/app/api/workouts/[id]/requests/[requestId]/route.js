import { requireAuth } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { json, readJson, route } from "@/lib/server/response";
import { createNotification } from "@/lib/services/notifications";
import { getWorkoutRow, isOwnerOrAdmin } from "@/lib/repositories/workouts";
import { syncWorkoutStatus } from "@/lib/services/workouts";
import {
  cancelOverlappingPendingRequests,
  findParticipationConflict,
  lockParticipationForUser,
  participationConflictMessage,
} from "@/lib/services/participation-conflicts";

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

    let existingRequest;

    if (status === "confirmed") {
      const { rows: requestUsers } = await client.query(
        `select user_id
           from workout_participants
          where id = $1 and workout_id = $2`,
        [requestId, id],
      );
      if (!requestUsers[0]) throw notFound("Заявка не найдена");

      await lockParticipationForUser(client, requestUsers[0].user_id);

      const { rows: existingRequests } = await client.query(
        `select *
           from workout_participants
          where id = $1 and workout_id = $2
          for update`,
        [requestId, id],
      );
      existingRequest = existingRequests[0];
      if (!existingRequest) throw notFound("Заявка не найдена");

      if (existingRequest.status !== "confirmed" && Number(workout.confirmed_count) >= Number(workout.participant_limit)) {
        throw badRequest("Свободных мест нет");
      }

      const conflict = await findParticipationConflict(client, existingRequest.user_id, workout, {
        participationStatuses: ["confirmed"],
      });
      if (conflict) {
        throw badRequest(participationConflictMessage(conflict, "Участник"));
      }

      await cancelOverlappingPendingRequests(client, existingRequest.user_id, workout);
    } else {
      const { rows: existingRequests } = await client.query(
        `select *
           from workout_participants
          where id = $1 and workout_id = $2
          for update`,
        [requestId, id],
      );
      existingRequest = existingRequests[0];
      if (!existingRequest) throw notFound("Заявка не найдена");
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
