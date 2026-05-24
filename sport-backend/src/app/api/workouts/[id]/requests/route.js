import { requireAuth } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { badRequest, forbidden, notFound } from "@/lib/server/http-error";
import { json, route } from "@/lib/server/response";
import { createNotification } from "@/lib/services/notifications";
import { getWorkoutRow, isOwnerOrAdmin } from "@/lib/repositories/workouts";
import {
  findParticipationConflict,
  lockParticipationForUser,
  participationConflictMessage,
} from "@/lib/services/participation-conflicts";

export const POST = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  const participant = await transaction(async client => {
    const workout = await getWorkoutRow(client, id, true);
    if (!workout) throw notFound("Тренировка не найдена");
    if (Number(workout.organizer_id) === Number(user.id)) throw badRequest("Организатор уже участвует в тренировке");
    if (!["open", "planned"].includes(workout.status)) throw badRequest("Набор закрыт");
    if (Number(workout.confirmed_count) >= Number(workout.participant_limit)) throw badRequest("Свободных мест нет");

    await lockParticipationForUser(client, user.id);

    const { rows: currentRequests } = await client.query(
      `select status
         from workout_participants
        where workout_id = $1 and user_id = $2
        for update`,
      [id, user.id],
    );
    if (currentRequests[0]?.status === "confirmed") {
      throw badRequest("Вы уже участвуете в этой тренировке");
    }
    if (currentRequests[0]?.status === "pending") {
      throw badRequest("Заявка уже на рассмотрении");
    }

    const conflict = await findParticipationConflict(client, user.id, workout);
    if (conflict) {
      throw badRequest(participationConflictMessage(conflict));
    }

    const { rows } = await client.query(
      `insert into workout_participants (workout_id, user_id, status)
       values ($1, $2, 'pending')
       on conflict (workout_id, user_id)
       do update set status = 'pending', requested_at = now(), responded_at = null
       returning *`,
      [id, user.id],
    );

    await createNotification(client, {
      userId: workout.organizer_id,
      type: "participation_request",
      title: "Новая заявка на тренировку",
      message: workout.title,
      payload: { workoutId: workout.id, requestId: rows[0].id, userId: user.id },
    });
    return rows[0];
  });
  return json({ request: participant }, 201);
});

export const GET = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  const { rows: workouts } = await query("select * from workouts where id = $1", [id]);
  if (!workouts[0]) throw notFound("Тренировка не найдена");
  if (!isOwnerOrAdmin(user, workouts[0])) throw forbidden();

  const { rows } = await query(
    `select wp.*, u.full_name, u.email
       from workout_participants wp
       join users u on u.id = wp.user_id
      where wp.workout_id = $1
      order by wp.requested_at desc`,
    [id],
  );
  return json({ requests: rows });
});
