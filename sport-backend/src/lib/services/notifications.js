import { query } from "../server/db";

export async function createNotification(clientOrPool, { userId, type, title, message, payload = {}, scheduledFor = null }) {
  const runner = clientOrPool?.query ? clientOrPool : null;
  const sql = `insert into notifications (user_id, type, title, message, payload, scheduled_for)
               values ($1, $2, $3, $4, $5::jsonb, $6)
               returning *`;
  const params = [userId, type, title, message, JSON.stringify(payload), scheduledFor];
  const result = runner ? await runner.query(sql, params) : await query(sql, params);
  return result.rows[0];
}

export async function notifyWorkoutParticipants(client, workoutId, notification) {
  const { rows } = await client.query(
    `select user_id
       from workout_participants
      where workout_id = $1 and status = 'confirmed'`,
    [workoutId],
  );

  for (const row of rows) {
    await createNotification(client, {
      userId: row.user_id,
      payload: { workoutId, ...(notification.payload || {}) },
      ...notification,
    });
  }
}
