import http from "node:http";
import cron from "node-cron";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool, query } from "./config/db.js";
import { createNotification } from "./services/notifications.js";
import { syncWorkoutStatus } from "./services/workouts.js";

const app = createApp();
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: env.clientOrigins,
    credentials: true,
  },
});
app.set("io", io);

io.on("connection", socket => {
  socket.on("workout:join", workoutId => {
    socket.join(`workout:${workoutId}`);
  });
});

async function createReminderNotifications() {
  const { rows } = await query(
    `select w.id, w.title, w.start_at, wp.user_id
       from workouts w
       join workout_participants wp on wp.workout_id = w.id and wp.status = 'confirmed'
      where w.status in ('open', 'full')
        and w.start_at between now() and now() + interval '24 hours'
        and not exists (
          select 1 from notifications n
           where n.user_id = wp.user_id
             and n.type = 'workout_reminder'
             and n.payload->>'workoutId' = w.id::text
             and n.payload->>'window' = case
               when w.start_at <= now() + interval '1 hour' then '1h'
               else '24h'
             end
        )`,
  );

  for (const row of rows) {
    const window = new Date(row.start_at).getTime() <= Date.now() + 60 * 60 * 1000 ? "1h" : "24h";
    await createNotification(pool, {
      userId: row.user_id,
      type: "workout_reminder",
      title: window === "1h" ? "Тренировка через час" : "Тренировка завтра",
      message: row.title,
      payload: { workoutId: row.id, window },
      scheduledFor: row.start_at,
    });
  }
}

async function syncActiveWorkoutStatuses() {
  const { rows } = await query("select id from workouts where status not in ('cancelled', 'completed')");
  for (const row of rows) {
    await syncWorkoutStatus(pool, row.id);
  }
}

cron.schedule("* * * * *", () => {
  syncActiveWorkoutStatuses().catch(console.error);
  createReminderNotifications().catch(console.error);
});

server.listen(env.port, () => {
  console.log(`Sport backend listening on http://localhost:${env.port}`);
});
