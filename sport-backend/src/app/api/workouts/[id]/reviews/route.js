import { requireAuth } from "@/lib/server/auth";
import { query, transaction } from "@/lib/server/db";
import { badRequest, forbidden } from "@/lib/server/http-error";
import { publicUser } from "@/lib/mappers/user";
import { json, readJson, route } from "@/lib/server/response";
import { evaluateAchievements } from "@/lib/services/achievements";
import { syncWorkoutStatus } from "@/lib/services/workouts";

export const GET = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  await syncWorkoutStatus(query, id);

  const { rows: eligible } = await query(
    `select 1
       from workouts w
      where w.id = $1
        and w.status = 'completed'
        and (
          w.organizer_id = $2
          or exists (
            select 1
              from workout_participants wp
             where wp.workout_id = w.id
               and wp.user_id = $2
               and wp.status = 'confirmed'
          )
        )`,
    [id, user.id],
  );

  if (!eligible[0]) {
    return json({ reviewTargets: [] });
  }

  const { rows } = await query(
    `with target_users as (
       select w.organizer_id as id, true as is_organizer
         from workouts w
        where w.id = $1
       union
       select wp.user_id as id, false as is_organizer
         from workout_participants wp
        where wp.workout_id = $1 and wp.status = 'confirmed'
     )
     select u.*, s.organized_workouts, s.attended_workouts, s.total_distance_km,
            s.average_rating, s.complaints_count,
            (u.privacy_settings->>'hide_email')::boolean as hide_email,
            (u.privacy_settings->>'hide_phone')::boolean as hide_phone,
            tu.is_organizer,
            my_review.id as my_review_id,
            my_review.rating as my_review_rating,
            my_review.text as my_review_text
       from users u
       join target_users tu on tu.id = u.id
       left join user_training_stats s on s.user_id = u.id
     left join reviews my_review
       on my_review.workout_id = $1
      and my_review.reviewer_id = $2
      and my_review.reviewee_id = u.id
     where u.id <> $2
     order by tu.is_organizer desc, u.full_name`,
    [id, user.id],
  );

  return json({
    reviewTargets: rows.map(row => ({
      user: publicUser(row),
      isOrganizer: Boolean(row.is_organizer),
      review: row.my_review_id
        ? { id: row.my_review_id, rating: Number(row.my_review_rating), text: row.my_review_text }
        : null,
    })),
  });
});

export const POST = route(async (request, context) => {
  const user = await requireAuth(request);
  const { id } = await context.params;
  await syncWorkoutStatus(query, id);

  const body = await readJson(request);
  const rating = Number(body.rating);
  const revieweeId = Number(body.revieweeId || body.reviewee_id);
  if (!revieweeId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest("Укажите пользователя и оценку 1-5");
  }
  if (Number(user.id) === revieweeId) {
    throw badRequest("Нельзя оценить самого себя");
  }

  const review = await transaction(async client => {
    const { rows: eligibility } = await client.query(
      `select w.id,
              w.organizer_id = $2 as reviewer_is_organizer,
              w.organizer_id = $3 as reviewee_is_organizer,
              exists (
                select 1
                  from workout_participants wp
                 where wp.workout_id = w.id
                   and wp.user_id = $2
                   and wp.status = 'confirmed'
              ) as reviewer_is_participant,
              exists (
                select 1
                  from workout_participants wp
                 where wp.workout_id = w.id
                   and wp.user_id = $3
                   and wp.status = 'confirmed'
              ) as reviewee_is_participant
         from workouts w
        where w.id = $1 and w.status = 'completed'`,
      [id, user.id, revieweeId],
    );

    const rules = eligibility[0];
    const reviewerAllowed = rules?.reviewer_is_organizer || rules?.reviewer_is_participant;
    const revieweeAllowed = rules?.reviewee_is_organizer || rules?.reviewee_is_participant;
    if (!reviewerAllowed || !revieweeAllowed) {
      throw forbidden("Оценивать можно только тех, с кем вы были на завершенной тренировке");
    }

    const { rows: existing } = await client.query(
      `select id
         from reviews
        where workout_id = $1 and reviewer_id = $2 and reviewee_id = $3`,
      [id, user.id, revieweeId],
    );
    if (existing[0]) {
      throw badRequest("Этого пользователя вы уже оценили после этой тренировки");
    }

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
