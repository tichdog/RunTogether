insert into users (email, phone, password_hash, first_name, last_name, gender, full_name, role, phone_verified, email_verified, verification_status)
values
  ('admin@sport.local', '+79990000001', '$2a$10$HNYX9PNnVvJLPh8zErBFw.TVdINQW5lcmyuMjm6SSUFWLDjjRDMAK', 'Иван', 'Иванов', 'male', 'Иван Иванов', 'super_admin', true, true, 'fully_verified'),
  ('alina@sport.local', '+79990000002', '$2a$10$HNYX9PNnVvJLPh8zErBFw.TVdINQW5lcmyuMjm6SSUFWLDjjRDMAK', 'Алина', 'Крылова', 'female', 'Алина Крылова', 'member', true, true, 'fully_verified'),
  ('mark@sport.local', '+79990000003', '$2a$10$HNYX9PNnVvJLPh8zErBFw.TVdINQW5lcmyuMjm6SSUFWLDjjRDMAK', 'Марк', 'Ильин', 'male', 'Марк Ильин', 'member', true, false, 'phone_verified')
on conflict (email) do nothing;

update users
   set role = 'super_admin'
 where email = 'admin@sport.local';

insert into workouts (
  organizer_id, title, description, start_at, duration_minutes, meeting_point_name,
  meeting_point_address, meeting_lat, meeting_lng, route_name, distance_km,
  pace_min_per_km, difficulty, participant_limit, status
)
select u.id, 'Утренняя пробежка 5 км', 'Легкий темп для знакомства с маршрутом',
       now() + interval '2 days', 60, 'Парк Горького', 'Главный вход',
       55.7298, 37.6019, 'Круг по набережной', 5.00, 5.50, 'easy', 12, 'open'
from users u
where u.email = 'alina@sport.local'
on conflict do nothing;

insert into workouts (
  organizer_id, title, description, start_at, duration_minutes, meeting_point_name,
  meeting_point_address, meeting_lat, meeting_lng, route_name, distance_km,
  pace_min_per_km, difficulty, participant_limit, status
)
select u.id, 'Вечерний кросс 10 км', 'Средний темп, ровная дистанция',
       now() + interval '4 days', 80, 'Лужники', 'Метро Спортивная',
       55.7158, 37.5538, 'Лужнецкая петля', 10.00, 6.00, 'medium', 20, 'open'
from users u
where u.email = 'mark@sport.local'
on conflict do nothing;
