import { requireAuth } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";
import { noContent, route } from "@/lib/server/response";
import { syncWorkoutStatus } from "@/lib/services/workouts";

export const DELETE = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  await transaction(async client => {
    await client.query(
      `update workout_participants
          set status = 'cancelled', responded_at = now()
        where workout_id = $1 and user_id = $2 and status in ('pending', 'confirmed')`,
      [id, user.id],
    );
    await syncWorkoutStatus(client, id);
  });
  return noContent();
});
