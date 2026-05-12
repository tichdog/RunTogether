import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import "../styles/user-app.css";

const INITIAL_WORKOUT = {
  title: "",
  startAt: "",
  meetingName: "",
  meetingAddress: "",
  routeName: "",
  distanceKm: 5,
  paceMinPerKm: 6,
  difficulty: "easy",
  participantLimit: 10,
};

export function UserApp({ user, onLogout }) {
  const [localUser, setLocalUser] = useState(user);
  const [activeTab, setActiveTab] = useState("home");
  const [workouts, setWorkouts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [message, setMessage] = useState("");
  const [workoutForm, setWorkoutForm] = useState(INITIAL_WORKOUT);
  const [profileForm, setProfileForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    gender: user.gender || "male",
    phone: user.phone || "",
    hideEmail: Boolean(user.privacy?.hide_email),
    hidePhone: Boolean(user.privacy?.hide_phone),
  });

  const loadWorkouts = () => {
    api.workouts({ difficulty })
      .then(data => setWorkouts(data.workouts))
      .catch(err => setMessage(err.message));
  };

  useEffect(() => {
    loadWorkouts();
  }, [difficulty]);

  useEffect(() => {
    api.notifications()
      .then(data => setNotifications(data.notifications))
      .catch(() => setNotifications([]));
  }, []);

  const filteredWorkouts = useMemo(() => {
    const text = query.trim().toLowerCase();
    return workouts.filter(workout => {
      const matchesText = !text ||
        workout.title.toLowerCase().includes(text) ||
        workout.organizerName?.toLowerCase().includes(text) ||
        workout.meetingPoint?.name?.toLowerCase().includes(text);
      return matchesText;
    });
  }, [workouts, query]);

  const upcoming = filteredWorkouts.filter(workout => ["planned", "open", "full"].includes(workout.status));
  const featuredWorkout = upcoming[0] || filteredWorkouts[0];

  const stats = [
    { label: "Посещено", value: localUser.stats?.attendedWorkouts || 0 },
    { label: "Км всего", value: localUser.stats?.distance || 0 },
    { label: "Рейтинг", value: localUser.stats?.rating || "0.0" },
  ];

  const joinWorkout = async (workout) => {
    setMessage("");
    try {
      await api.joinWorkout(workout.id);
      setMessage("Заявка отправлена организатору");
      loadWorkouts();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const createWorkout = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await api.createWorkout({
        title: workoutForm.title,
        startAt: workoutForm.startAt,
        meetingPoint: {
          name: workoutForm.meetingName,
          address: workoutForm.meetingAddress,
        },
        route: { name: workoutForm.routeName },
        distanceKm: Number(workoutForm.distanceKm),
        paceMinPerKm: Number(workoutForm.paceMinPerKm),
        difficulty: workoutForm.difficulty,
        participantLimit: Number(workoutForm.participantLimit),
      });
      setWorkoutForm(INITIAL_WORKOUT);
      setActiveTab("workouts");
      setMessage("Тренировка создана");
      loadWorkouts();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await api.updateMe({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        gender: profileForm.gender,
        phone: profileForm.phone,
        privacy: {
          hide_email: profileForm.hideEmail,
          hide_phone: profileForm.hidePhone,
        },
      });
      setLocalUser(data.user);
      setMessage("Профиль сохранен");
    } catch (err) {
      setMessage(err.message);
    }
  };

  const setWorkout = key => event => setWorkoutForm(prev => ({ ...prev, [key]: event.target.value }));
  const setProfile = key => event => setProfileForm(prev => ({ ...prev, [key]: event.target.value }));
  const toggleProfile = key => event => setProfileForm(prev => ({ ...prev, [key]: event.target.checked }));

  return (
    <div className="client-app">
      <aside className="client-sidebar" aria-label="Разделы приложения">
        <div className="client-brand">
          <span>R</span>
          <strong>RunTogether</strong>
        </div>
        <ClientNav activeTab={activeTab} setActiveTab={setActiveTab} />
        <button className="client-logout" type="button" onClick={onLogout}>Выйти</button>
      </aside>

      <main className="client-main">
        <header className="client-header">
          <div>
            <p className="client-kicker">Совместные тренировки</p>
            <h1>{pageTitle(activeTab, selectedWorkout)}</h1>
          </div>
          <button className="client-avatar" type="button" onClick={() => setActiveTab("profile")} aria-label="Открыть профиль">
            {initials(localUser)}
          </button>
        </header>

        {message && (
          <div className={message.includes("сохран") || message.includes("создан") || message.includes("отправ") ? "client-alert success" : "client-alert"}>
            {message}
          </div>
        )}

        {selectedWorkout ? (
          <WorkoutDetail workout={selectedWorkout} onBack={() => setSelectedWorkout(null)} onJoin={joinWorkout} />
        ) : (
          <>
            {activeTab === "home" && (
              <HomeView
                user={localUser}
                stats={stats}
                featuredWorkout={featuredWorkout}
                workouts={upcoming}
                notifications={notifications}
                onOpenWorkout={setSelectedWorkout}
                onCreate={() => setActiveTab("create")}
              />
            )}

            {activeTab === "workouts" && (
              <WorkoutsView
                workouts={filteredWorkouts}
                query={query}
                setQuery={setQuery}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                onOpenWorkout={setSelectedWorkout}
                onJoin={joinWorkout}
              />
            )}

            {activeTab === "create" && (
              <CreateWorkoutView
                form={workoutForm}
                setField={setWorkout}
                onSubmit={createWorkout}
              />
            )}

            {activeTab === "profile" && (
              <ProfileView
                user={localUser}
                form={profileForm}
                setField={setProfile}
                toggleField={toggleProfile}
                onSubmit={saveProfile}
                notifications={notifications}
              />
            )}
          </>
        )}
      </main>

      <nav className="client-bottom-nav" aria-label="Мобильная навигация">
        <ClientNav activeTab={activeTab} setActiveTab={setActiveTab} compact />
      </nav>
    </div>
  );
}

function ClientNav({ activeTab, setActiveTab, compact = false }) {
  const items = [
    ["home", "Главная"],
    ["workouts", "Тренировки"],
    ["create", "Создать"],
    ["profile", "Профиль"],
  ];

  return (
    <div className={compact ? "client-nav compact" : "client-nav"}>
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={activeTab === id ? "active" : ""}
          onClick={() => setActiveTab(id)}
        >
          <span className="nav-mark" />
          {label}
        </button>
      ))}
    </div>
  );
}

function HomeView({ user, stats, featuredWorkout, workouts, notifications, onOpenWorkout, onCreate }) {
  return (
    <div className="client-grid">
      <section className="client-hero">
        <div>
          <p>Привет, {user.firstName || user.name}</p>
          <h2>Найди ближайшую тренировку или собери свою группу</h2>
        </div>
        <button type="button" onClick={onCreate}>Создать тренировку</button>
      </section>

      <section className="client-stats">
        {stats.map(stat => (
          <article key={stat.label} className="client-stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </section>

      <section className="client-panel main-panel">
        <div className="panel-head">
          <div>
            <p>Рекомендация</p>
            <h2>Ближайшая тренировка</h2>
          </div>
        </div>
        {featuredWorkout ? (
          <WorkoutCard workout={featuredWorkout} onOpen={onOpenWorkout} highlight />
        ) : (
          <EmptyBlock text="Пока нет тренировок с открытым набором." />
        )}
      </section>

      <section className="client-panel">
        <div className="panel-head">
          <div>
            <p>Лента</p>
            <h2>Скоро стартуют</h2>
          </div>
        </div>
        <div className="compact-list">
          {workouts.slice(0, 4).map(workout => (
            <button key={workout.id} type="button" onClick={() => onOpenWorkout(workout)}>
              <span>{workout.title}</span>
              <small>{formatDate(workout.startAt)}</small>
            </button>
          ))}
          {!workouts.length && <EmptyBlock text="Нет ближайших тренировок." />}
        </div>
      </section>

      <section className="client-panel">
        <div className="panel-head">
          <div>
            <p>Система</p>
            <h2>Уведомления</h2>
          </div>
        </div>
        <div className="notification-list">
          {notifications.slice(0, 4).map(item => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.message}</span>
            </article>
          ))}
          {!notifications.length && <EmptyBlock text="Новых уведомлений нет." />}
        </div>
      </section>
    </div>
  );
}

function WorkoutsView({ workouts, query, setQuery, difficulty, setDifficulty, onOpenWorkout, onJoin }) {
  return (
    <section className="client-panel full-panel">
      <div className="filters-row">
        <label>
          <span>Поиск</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, место, организатор" />
        </label>
        <label>
          <span>Сложность</span>
          <select value={difficulty} onChange={event => setDifficulty(event.target.value)}>
            <option value="">Любая</option>
            <option value="easy">Легкая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
        </label>
      </div>

      <div className="workout-list">
        {workouts.map(workout => (
          <WorkoutCard key={workout.id} workout={workout} onOpen={onOpenWorkout} onJoin={onJoin} />
        ))}
        {!workouts.length && <EmptyBlock text="Тренировки не найдены." />}
      </div>
    </section>
  );
}

function CreateWorkoutView({ form, setField, onSubmit }) {
  return (
    <section className="client-panel full-panel">
      <form className="client-form" onSubmit={onSubmit}>
        <div className="form-grid two">
          <label>
            <span>Название</span>
            <input value={form.title} onChange={setField("title")} placeholder="Например, утренний кросс" required />
          </label>
          <label>
            <span>Дата и время</span>
            <input value={form.startAt} onChange={setField("startAt")} type="datetime-local" required />
          </label>
        </div>

        <div className="form-grid two">
          <label>
            <span>Точка сбора</span>
            <input value={form.meetingName} onChange={setField("meetingName")} placeholder="Парк, стадион, метро" required />
          </label>
          <label>
            <span>Адрес</span>
            <input value={form.meetingAddress} onChange={setField("meetingAddress")} placeholder="Необязательно" />
          </label>
        </div>

        <label>
          <span>Маршрут</span>
          <input value={form.routeName} onChange={setField("routeName")} placeholder="Короткое описание маршрута" required />
        </label>

        <div className="form-grid four">
          <label>
            <span>Дистанция, км</span>
            <input value={form.distanceKm} onChange={setField("distanceKm")} type="number" min="1" step="0.1" required />
          </label>
          <label>
            <span>Темп, мин/км</span>
            <input value={form.paceMinPerKm} onChange={setField("paceMinPerKm")} type="number" min="1" step="0.1" required />
          </label>
          <label>
            <span>Сложность</span>
            <select value={form.difficulty} onChange={setField("difficulty")}>
              <option value="easy">Легкая</option>
              <option value="medium">Средняя</option>
              <option value="hard">Сложная</option>
            </select>
          </label>
          <label>
            <span>Лимит</span>
            <input value={form.participantLimit} onChange={setField("participantLimit")} type="number" min="1" required />
          </label>
        </div>

        <button className="primary-action" type="submit">Опубликовать тренировку</button>
      </form>
    </section>
  );
}

function ProfileView({ user, form, setField, toggleField, onSubmit, notifications }) {
  return (
    <div className="profile-layout">
      <section className="client-panel">
        <div className="profile-head">
          <div className="profile-avatar">{initials(user)}</div>
          <div>
            <h2>{user.name}</h2>
            <p>{user.phoneVerified ? "Телефон подтвержден" : "Телефон не подтвержден"}</p>
          </div>
        </div>

        <form className="client-form" onSubmit={onSubmit}>
          <div className="form-grid two">
            <label>
              <span>Фамилия</span>
              <input value={form.lastName} onChange={setField("lastName")} required />
            </label>
            <label>
              <span>Имя</span>
              <input value={form.firstName} onChange={setField("firstName")} required />
            </label>
          </div>
          <div className="form-grid two">
            <label>
              <span>Пол</span>
              <select value={form.gender} onChange={setField("gender")}>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
                <option value="other">Другой</option>
              </select>
            </label>
            <label>
              <span>Телефон</span>
              <input value={form.phone} onChange={setField("phone")} placeholder="Необязательно" />
            </label>
          </div>

          <div className="privacy-box">
            <label>
              <input type="checkbox" checked={form.hideEmail} onChange={toggleField("hideEmail")} />
              Скрывать почту в профиле
            </label>
            <label>
              <input type="checkbox" checked={form.hidePhone} onChange={toggleField("hidePhone")} />
              Скрывать телефон в профиле
            </label>
          </div>

          <button className="primary-action" type="submit">Сохранить профиль</button>
        </form>
      </section>

      <section className="client-panel">
        <div className="panel-head">
          <div>
            <p>Профиль</p>
            <h2>Статистика</h2>
          </div>
        </div>
        <div className="profile-stats">
          <div><strong>{user.stats?.organizedWorkouts || 0}</strong><span>Проведено</span></div>
          <div><strong>{user.stats?.attendedWorkouts || 0}</strong><span>Посещено</span></div>
          <div><strong>{user.stats?.distance || 0}</strong><span>Км всего</span></div>
          <div><strong>{user.stats?.rating || "0.0"}</strong><span>Рейтинг</span></div>
        </div>
      </section>

      <section className="client-panel">
        <div className="panel-head">
          <div>
            <p>Последнее</p>
            <h2>Уведомления</h2>
          </div>
        </div>
        <div className="notification-list">
          {notifications.slice(0, 6).map(item => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.message}</span>
            </article>
          ))}
          {!notifications.length && <EmptyBlock text="Новых уведомлений нет." />}
        </div>
      </section>
    </div>
  );
}

function WorkoutCard({ workout, onOpen, onJoin, highlight = false }) {
  return (
    <article className={highlight ? "workout-card highlight" : "workout-card"}>
      <button className="workout-card-main" type="button" onClick={() => onOpen(workout)}>
        <div className="workout-card-top">
          <div>
            <h3>{workout.title}</h3>
            <p>{workout.meetingPoint?.name || "Место сбора"} · {workout.route?.name || "Маршрут"}</p>
          </div>
          <span className={`status-pill ${workout.status}`}>{statusLabel(workout.status)}</span>
        </div>

        <div className="workout-meta">
          <span>{formatDate(workout.startAt)}</span>
          <span>{workout.distanceKm} км</span>
          <span>{workout.paceMinPerKm} мин/км</span>
          <span>{difficultyLabel(workout.difficulty)}</span>
        </div>

        <div className="workout-progress" aria-label={`Свободно ${workout.freePlaces} мест`}>
          <span className={`progress-fill p-${capacityStep(workout)}`} />
        </div>
      </button>

      <div className="workout-card-footer">
        <div>
          <strong>{workout.organizerName}</strong>
          <span>{workout.confirmedCount}/{workout.participantLimit} мест занято</span>
        </div>
        {onJoin && (
          <button type="button" onClick={() => onJoin(workout)} disabled={!["planned", "open"].includes(workout.status)}>
            Заявка
          </button>
        )}
      </div>
    </article>
  );
}

function WorkoutDetail({ workout, onBack, onJoin }) {
  return (
    <section className="workout-detail">
      <button className="back-button" type="button" onClick={onBack}>Назад к списку</button>

      <div className="detail-map" aria-hidden="true">
        <svg viewBox="0 0 520 280" role="img">
          <path className="map-land" d="M36 205C65 92 120 22 165 38c42 15 55 82 89 101 29 16 71 5 98-18 35-29 83 34 91 83 7 45-55 15-101 24-67 14-122-59-184-32-40 17-68 72-122 9z" />
          <path className="map-route" d="M54 213c55-17 69-91 119-104 66-17 91 75 157 66 45-6 69-39 102-10" />
          <circle cx="54" cy="213" r="8" />
          <circle cx="432" cy="165" r="8" />
        </svg>
      </div>

      <div className="detail-content">
        <div className="detail-head">
          <div>
            <p>{workout.meetingPoint?.name || "Точка сбора"}</p>
            <h2>{workout.title}</h2>
          </div>
          <strong>{workout.confirmedCount}/{workout.participantLimit} мест</strong>
        </div>

        <div className="detail-grid">
          <Info label="Дата" value={formatDate(workout.startAt)} />
          <Info label="Дистанция" value={`${workout.distanceKm} км`} />
          <Info label="Темп" value={`${workout.paceMinPerKm} мин/км`} />
          <Info label="Уровень" value={difficultyLabel(workout.difficulty)} />
        </div>

        <div className="detail-section">
          <h3>Организатор</h3>
          <div className="organizer-row">
            <div className="mini-avatar">{workout.organizerName?.[0] || "R"}</div>
            <div>
              <strong>{workout.organizerName}</strong>
              <span>Рейтинг будет рассчитан после отзывов</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>Участники</h3>
          <div className="participant-strip">
            {Array.from({ length: Math.min(5, Math.max(1, workout.confirmedCount || 1)) }).map((_, index) => (
              <span key={index}>{index + 1}</span>
            ))}
          </div>
        </div>

        <div className="detail-actions">
          <button type="button">Открыть чат</button>
          <button type="button" onClick={() => onJoin(workout)} disabled={!["planned", "open"].includes(workout.status)}>
            Отправить заявку
          </button>
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyBlock({ text }) {
  return <div className="empty-block">{text}</div>;
}

function pageTitle(activeTab, selectedWorkout) {
  if (selectedWorkout) return "Информация о тренировке";
  return {
    home: "Главная",
    workouts: "Тренировки",
    create: "Новая тренировка",
    profile: "Профиль",
  }[activeTab] || "RunTogether";
}

function initials(user) {
  return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.trim() || user.initials || "RT";
}

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function difficultyLabel(value) {
  return { easy: "Легкая", medium: "Средняя", hard: "Сложная" }[value] || value;
}

function statusLabel(value) {
  return {
    planned: "Планируется",
    open: "Набор открыт",
    full: "Набор закрыт",
    in_progress: "В процессе",
    completed: "Завершена",
    cancelled: "Отменена",
  }[value] || value;
}

function capacityStep(workout) {
  if (!workout.participantLimit) return 0;
  const percent = Math.min(100, Math.round((workout.confirmedCount / workout.participantLimit) * 100));
  return Math.round(percent / 10) * 10;
}
