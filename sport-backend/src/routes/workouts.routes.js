import { Router } from "express";
import { transaction, query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../utils/httpError.js";
import { getSettings } from "../services/settings.js";
import { createNotification, notifyWorkoutParticipants } from "../services/notifications.js";
import { evaluateAchievements } from "../services/achievements.js";
import { syncWorkoutStatus, workoutPayload } from "../services/workouts.js";

export const workoutsRouter = Router();

workoutsRouter.use(requireAuth);

function isOwnerOrAdmin(req, workout) {
  return req.user.role === "admin" || Number(workout.organizer_id) === Number(req.user.id);
}

function parseWorkoutBody(body) {
  const title = String(body.title || "").trim();
  const startAt = body.startAt || body.start_at;
  const meetingPoint = body.meetingPoint || {};
  const route = body.route || {};
  const difficulty = body.difficulty;
  const participantLimit = Number(body.participantLimit || body.participant_limit);
  const distanceKm = Number(body.distanceKm || body.distance_km);
  const paceMinPerKm = Number(body.paceMinPerKm || body.pace_min_per_km);

  if (!title || !startAt || !meetingPoint.name || !route.name || !participantLimit || !distanceKm || !paceMinPerKm) {
    throw badRequest("Заполните дату, точку сбора, маршрут, темп, дистанцию, сложность и лимит участников");
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    throw badRequest("Некорректная сложность");
  }

  return {
    title,
    description: body.description || null,
    startAt,
    durationMinutes: Number(body.durationMinutes || body.duration_minutes || 60),
    meetingPoint,
    route,
    distanceKm,
    paceMinPerKm,
    difficulty,
    participantLimit,
  };
}

async function getWorkoutRow(client, workoutId, lock = false) {
  const { rows } = await client.query(
    `select w.*,
            u.full_name as organizer_name,
            (select count(*)
               from workout_participants wp
              where wp.workout_id = w.id and wp.status = 'confirmed') as confirmed_count
       from workouts w
       join users u on u.id = w.organizer_id
      where w.id = $1
      ${lock ? "for update of w" : ""}`,
    [workoutId],
  );
  return rows[0];
}

workoutsRouter.get("/", async (req, res, next) => {
  try {
    const lat = req.query.lat == null ? null : Number(req.query.lat);
    const lng = req.query.lng == null ? null : Number(req.query.lng);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const radiusKm = hasGeo && req.query.radiusKm != null ? Number(req.query.radiusKm) : null;
    const sort = req.query.sort === "distance" && hasGeo ? "distance" : "time";

    const distanceExpr = hasGeo
      ? `(6371 * acos(least(1, greatest(-1,
           cos(radians($8::numeric)) * cos(radians(w.meeting_lat)) *
           cos(radians(w.meeting_lng) - radians($9::numeric)) +
           sin(radians($8::numeric)) * sin(radians(w.meeting_lat))
         ))))`
      : "null";

    const params = [
      req.query.dateFrom || null,
      req.query.dateTo || null,
      req.query.distanceMin || null,
      req.query.distanceMax || null,
      req.query.paceMax || null,
      req.query.difficulty || null,
      radiusKm,
    ];

    if (hasGeo) {
      params.push(lat, lng);
    }

    const { rows } = await query(
      `select w.*, u.full_name as organizer_name,
              count(wp.id) filter (where wp.status = 'confirmed') as confirmed_count,
              ${distanceExpr} as distance_from_user_km
         from workouts w
         join users u on u.id = w.organizer_id
         left join workout_participants wp on wp.workout_id = w.id
        where ($1::timestamptz is null or w.start_at >= $1)
          and ($2::timestamptz is null or w.start_at <= $2)
          and ($3::numeric is null or w.distance_km >= $3)
          and ($4::numeric is null or w.distance_km <= $4)
          and ($5::numeric is null or w.pace_min_per_km <= $5)
          and ($6::text is null or w.difficulty = $6)
          and ($7::numeric is null or ${distanceExpr} <= $7)
        group by w.id, u.full_name
        order by ${sort === "distance" ? "distance_from_user_km nulls last, w.start_at" : "w.start_at"}
        limit 100`,
      params,
    );

    await Promise.all(rows.map(row => syncWorkoutStatus(query, row.id)));
    res.json({ workouts: rows.map(workoutPayload) });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.post("/", async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (settings.require_verified_to_create_workouts && !req.user.phone_verified) {
      throw forbidden("Создание тренировок доступно только пользователям с подтвержденным телефоном");
    }

    const data = parseWorkoutBody(req.body);
    const { rows } = await query(
      `insert into workouts (
        organizer_id, title, description, start_at, duration_minutes, meeting_point_name,
        meeting_point_address, meeting_lat, meeting_lng, route_name, route_geojson,
        distance_km, pace_min_per_km, difficulty, participant_limit, status
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,'planned')
      returning *`,
      [
        req.user.id,
        data.title,
        data.description,
        data.startAt,
        data.durationMinutes,
        data.meetingPoint.name,
        data.meetingPoint.address || null,
        data.meetingPoint.lat || null,
        data.meetingPoint.lng || null,
        data.route.name,
        JSON.stringify(data.route.geojson || null),
        data.distanceKm,
        data.paceMinPerKm,
        data.difficulty,
        data.participantLimit,
      ],
    );

    await query(
      `insert into activity_feed (type, actor_id, workout_id, metadata)
       values ('workout_created', $1, $2, $3::jsonb)`,
      [req.user.id, rows[0].id, JSON.stringify({ title: rows[0].title })],
    );

    res.status(201).json({ workout: workoutPayload({ ...rows[0], organizer_name: req.user.full_name, confirmed_count: 0 }) });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.get("/:id", async (req, res, next) => {
  try {
    await syncWorkoutStatus(query, req.params.id);
    const { rows } = await query(
      `select w.*, u.full_name as organizer_name,
              count(wp.id) filter (where wp.status = 'confirmed') as confirmed_count
         from workouts w
         join users u on u.id = w.organizer_id
         left join workout_participants wp on wp.workout_id = w.id
        where w.id = $1
        group by w.id, u.full_name`,
      [req.params.id],
    );
    if (!rows[0]) throw notFound("Тренировка не найдена");
    res.json({ workout: workoutPayload(rows[0]) });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = parseWorkoutBody(req.body);
    const updated = await transaction(async client => {
      const workout = await getWorkoutRow(client, req.params.id, true);
      if (!workout) throw notFound("Тренировка не найдена");
      if (!isOwnerOrAdmin(req, workout)) throw forbidden();
      if (new Date(workout.start_at) <= new Date()) throw badRequest("Тренировку можно редактировать только до начала");
      if (workout.status === "cancelled") throw badRequest("Отмененную тренировку нельзя редактировать");

      const { rows } = await client.query(
        `update workouts
            set title = $2, description = $3, start_at = $4, duration_minutes = $5,
                meeting_point_name = $6, meeting_point_address = $7, meeting_lat = $8,
                meeting_lng = $9, route_name = $10, route_geojson = $11::jsonb,
                distance_km = $12, pace_min_per_km = $13, difficulty = $14,
                participant_limit = $15, updated_at = now()
          where id = $1
          returning *`,
        [
          req.params.id,
          data.title,
          data.description,
          data.startAt,
          data.durationMinutes,
          data.meetingPoint.name,
          data.meetingPoint.address || null,
          data.meetingPoint.lat || null,
          data.meetingPoint.lng || null,
          data.route.name,
          JSON.stringify(data.route.geojson || null),
          data.distanceKm,
          data.paceMinPerKm,
          data.difficulty,
          data.participantLimit,
        ],
      );

      await notifyWorkoutParticipants(client, req.params.id, {
        type: "workout_changed",
        title: "Тренировка изменена",
        message: data.title,
      });
      return rows[0];
    });

    res.json({ workout: workoutPayload(updated) });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const cancelled = await transaction(async client => {
      const workout = await getWorkoutRow(client, req.params.id, true);
      if (!workout) throw notFound("Тренировка не найдена");
      if (!isOwnerOrAdmin(req, workout)) throw forbidden();
      if (workout.status === "completed") throw badRequest("Завершенную тренировку нельзя отменить");

      const { rows } = await client.query(
        `update workouts
            set status = 'cancelled', cancellation_reason = $2, cancelled_at = now(), updated_at = now()
          where id = $1
          returning *`,
        [req.params.id, req.body.reason || null],
      );

      await notifyWorkoutParticipants(client, req.params.id, {
        type: "workout_cancelled",
        title: "Тренировка отменена",
        message: workout.title,
      });
      return rows[0];
    });
    res.json({ workout: workoutPayload(cancelled) });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.post("/:id/requests", async (req, res, next) => {
  try {
    const participant = await transaction(async client => {
      const workout = await getWorkoutRow(client, req.params.id, true);
      if (!workout) throw notFound("Тренировка не найдена");
      if (Number(workout.organizer_id) === Number(req.user.id)) throw badRequest("Организатор уже участвует в тренировке");
      if (!["open", "planned"].includes(workout.status)) throw badRequest("Набор закрыт");
      if (Number(workout.confirmed_count) >= Number(workout.participant_limit)) throw badRequest("Свободных мест нет");

      const { rows } = await client.query(
        `insert into workout_participants (workout_id, user_id, status)
         values ($1, $2, 'pending')
         on conflict (workout_id, user_id)
         do update set status = 'pending', requested_at = now(), responded_at = null
         returning *`,
        [req.params.id, req.user.id],
      );

      await createNotification(client, {
        userId: workout.organizer_id,
        type: "participation_request",
        title: "Новая заявка на тренировку",
        message: workout.title,
        payload: { workoutId: workout.id, requestId: rows[0].id, userId: req.user.id },
      });
      return rows[0];
    });
    res.status(201).json({ request: participant });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.get("/:id/requests", async (req, res, next) => {
  try {
    const { rows: workouts } = await query("select * from workouts where id = $1", [req.params.id]);
    if (!workouts[0]) throw notFound("Тренировка не найдена");
    if (!isOwnerOrAdmin(req, workouts[0])) throw forbidden();

    const { rows } = await query(
      `select wp.*, u.full_name, u.email
         from workout_participants wp
         join users u on u.id = wp.user_id
        where wp.workout_id = $1
        order by wp.requested_at desc`,
      [req.params.id],
    );
    res.json({ requests: rows });
  } catch (error) {
    next(error);
  }
});

workoutsRouter.patch("/:id/requests/:requestId", async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["confirmed", "declined"].includes(status)) throw badRequest("Статус должен быть confirmed или declined");

    const result = await transaction(async client => {
      const workout = await getWorkoutRow(client, req.params.id, true);
      if (!workout) throw notFound("Тренировка не найдена");
      if (!isOwnerOrAdmin(req, workout)) throw forbidden();
      if (status === "confirmed" && Number(workout.confirmed_count) >= Number(workout.participant_limit)) {
        throw badRequest("Свободных мест нет");
      }

      const { rows } = await client.query(
        `update workout_participants
            set status = $3, responded_at = now()
          where id = $1 and workout_id = $2
          returning *`,
        [req.params.requestId, req.params.id, status],
      );
      if (!rows[0]) throw notFound("Заявка не найдена");

      await createNotification(client, {
        userId: rows[0].user_id,
        type: "participation_response",
        title: status === "confirmed" ? "Заявка подтверждена" : "Заявка отклонена",
        message: workout.title,
        payload: { workoutId: workout.id, status },
      });

      const synced = await syncWorkoutStatus(client, req.params.id);
      return { request: rows[0], workout: synced };
    });

    req.app.get("io")?.to(`workout:${req.params.id}`).emit("workout:capacity", {
      workoutId: Number(req.params.id),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

workoutsRouter.delete("/:id/participation", async (req, res, next) => {
  try {
    await transaction(async client => {
      await client.query(
        `update workout_participants
            set status = 'cancelled', responded_at = now()
          where workout_id = $1 and user_id = $2 and status in ('pending', 'confirmed')`,
        [req.params.id, req.user.id],
      );
      await syncWorkoutStatus(client, req.params.id);
    });
    req.app.get("io")?.to(`workout:${req.params.id}`).emit("workout:capacity", {
      workoutId: Number(req.params.id),
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

workoutsRouter.post("/:id/reviews", async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    const revieweeId = Number(req.body.revieweeId || req.body.reviewee_id);
    if (!revieweeId || rating < 1 || rating > 5) throw badRequest("Укажите пользователя и оценку 1-5");

    const review = await transaction(async client => {
      const { rows: allowed } = await client.query(
        `select 1
           from workout_participants a
           join workout_participants b on b.workout_id = a.workout_id
           join workouts w on w.id = a.workout_id
          where a.workout_id = $1 and a.user_id = $2 and a.status = 'confirmed'
            and b.user_id = $3 and b.status = 'confirmed'
            and w.status = 'completed'`,
        [req.params.id, req.user.id, revieweeId],
      );
      if (!allowed[0]) throw forbidden("Оценивать можно только участников завершенной тренировки");

      const { rows } = await client.query(
        `insert into reviews (workout_id, reviewer_id, reviewee_id, rating, text)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [req.params.id, req.user.id, revieweeId, rating, req.body.text || null],
      );
      await evaluateAchievements(client, revieweeId);
      return rows[0];
    });

    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
});
