export const MOCK_USERS = Array.from({ length: 23 }, (_, i) => ({
  id: 1001 + i,
  name: ["Алина К", "Марк И", "Иванов Иван", "Ольга С", "Дмитрий П", "Наташа Р", "Кирилл В", "Анна М", "Сергей К", "Лена Б"][i % 10],
  email: `user${1001 + i}@mail.ru`,
  role: ["Runner", "Pacer", "Moder", "Runner", "Runner", "Pacer", "Runner", "Moder", "Runner", "Pacer"][i % 10],
  status: i === 1 ? "Бан" : "Активен",
  verified: i % 3 !== 2,
  avatar: ["#E11D48", "#7C3AED", "#0891B2", "#EA580C", "#16A34A", "#DC2626", "#2563EB", "#C2410C", "#475569", "#92400E"][i % 10],
  initials: ["АК", "МИ", "ИИ", "ОС", "ДП", "НР", "КВ", "АМ", "СК", "ЛБ"][i % 10],
  phone: "+7 999 000 11 22",
  registered: "12.03.2024",
  stats: { workouts: 23, distance: 186, rating: 4.6, complaints: 0 },
}));

export const MOCK_WORKOUTS = Array.from({ length: 18 }, (_, i) => ({
  id: 9122 + i,
  organizer: ["Алина К", "Марк И", "Ольга С", "Дмитрий П"][i % 4],
  name: ["Утренняя пробежка 5 км 5:30 мин/км", "Вечерний кросс 10 км", "Интервальная тренировка", "Длинный бег 15 км"][i % 4],
  date: `${String(12 + (i % 18)).padStart(2, "0")}.05.2025`,
  time: ["07:00", "18:30", "08:00", "19:00"][i % 4],
  participants: `${5 + i * 2} / ${20 + i}`,
  status: ["Набор открыт", "Активна", "Завершена", "Набор открыт"][i % 4],
}));

export const OVERVIEW_STATS = [
  { label: "Пользователей", val: "100 000", sub: "+200 за неделю" },
  { label: "Тренировок",    val: "500",     sub: "20 активных" },
  { label: "Жалоб (новых)", val: "20",      sub: "Ожидание модерации" },
  { label: "Заблокировано", val: "20",      sub: "пользователей" },
];
