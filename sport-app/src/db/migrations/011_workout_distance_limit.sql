alter table workouts
  drop constraint if exists workouts_distance_km_check;

alter table workouts
  add constraint workouts_distance_km_check check (distance_km > 0 and distance_km <= 250) not valid;
