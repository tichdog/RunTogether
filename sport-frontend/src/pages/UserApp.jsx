import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import "../styles/user-app.css";

const EMPTY_FILTERS = {
  query: "",
  difficulty: "",
  sort: "time",
};

function defaultWorkoutForm() {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);

  return {
    title: "",
    description: "",
    startAt: toLocalInputValue(start),
    durationMinutes: 60,
    meetingName: "",
    meetingAddress: "",
    routeName: "",
    distanceKm: 5,
    paceMinPerKm: 6,
    difficulty: "easy",
    participantLimit: 10,
  };
}

export function UserApp({ user, onLogout }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [activeTab, setActiveTab] = useState("home");
  const [screen, setScreen] = useState("home");
  const [workouts, setWorkouts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [form, setForm] = useState(defaultWorkoutForm);
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [mode, setMode] = useState("create");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const selectedWorkout = useMemo(
    () => workouts.find(workout => Number(workout.id) === Number(selectedId)) || null,
    [selectedId, workouts],
  );

  const myWorkouts = useMemo(
    () => workouts.filter(workout => Number(workout.organizerId) === Number(currentUser.id)),
    [currentUser.id, workouts],
  );

  const visibleWorkouts = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return workouts.filter(workout => {
      const matchesQuery = !query || [
        workout.title,
        workout.organizerName,
        workout.meetingPoint?.name,
        workout.route?.name,
      ].filter(Boolean).some(value => value.toLowerCase().includes(query));
      const matchesDifficulty = !filters.difficulty || workout.difficulty === filters.difficulty;
      return matchesQuery && matchesDifficulty;
    });
  }, [filters, workouts]);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.workouts({
        difficulty: filters.difficulty,
        sort: filters.sort,
      });
      setWorkouts(data.workouts || []);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [filters.difficulty, filters.sort]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  useEffect(() => {
    setCurrentUser(user);
    setProfile(profileFromUser(user));
  }, [user]);

  const openWorkout = (workout) => {
    setSelectedId(workout.id);
    setScreen(Number(workout.organizerId) === Number(currentUser.id) ? "organizer" : "detail");
  };

  const goTab = (tab) => {
    setActiveTab(tab);
    setScreen(tab);
    setMessage(null);
    if (tab === "create") {
      setMode("create");
      setForm(defaultWorkoutForm());
    }
  };

  const saveWorkout = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = workoutPayload(form);
      const result = mode === "edit" && selectedWorkout
        ? await api.updateWorkout(selectedWorkout.id, payload)
        : await api.createWorkout(payload);
      await loadWorkouts();
      setWorkouts(prev => {
        const next = prev.filter(workout => Number(workout.id) !== Number(result.workout.id));
        return [result.workout, ...next];
      });
      setSelectedId(result.workout.id);
      setScreen("organizer");
      setActiveTab("create");
      setMessage({ type: "success", text: mode === "edit" ? "Тренировка обновлена" : "Тренировка опубликована" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const editWorkout = () => {
    if (!selectedWorkout) return;
    setMode("edit");
    setForm(formFromWorkout(selectedWorkout));
    setScreen("create");
    setActiveTab("create");
  };

  const cancelWorkout = async () => {
    if (!selectedWorkout) return;
    const reason = window.prompt("Причина отмены", "Отменено организатором");
    if (reason === null) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.cancelWorkout(selectedWorkout.id, reason);
      await loadWorkouts();
      setMessage({ type: "success", text: "Тренировка отменена" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const joinWorkout = async (workout) => {
    setSaving(true);
    setMessage(null);
    try {
      await api.joinWorkout(workout.id);
      await loadWorkouts();
      setMessage({ type: "success", text: "Заявка отправлена организатору" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const leaveWorkout = async (workout) => {
    setSaving(true);
    setMessage(null);
    try {
      await api.cancelParticipation(workout.id);
      await loadWorkouts();
      setMessage({ type: "success", text: "Участие отменено" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const openRequests = async () => {
    if (!selectedWorkout) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await api.workoutRequests(selectedWorkout.id);
      setRequests(data.requests || []);
      setScreen("requests");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const respondToRequest = async (requestId, status) => {
    if (!selectedWorkout) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.respondRequest(selectedWorkout.id, requestId, status);
      const data = await api.workoutRequests(selectedWorkout.id);
      setRequests(data.requests || []);
      await loadWorkouts();
      setMessage({ type: "success", text: status === "confirmed" ? "Заявка подтверждена" : "Заявка отклонена" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.updateMe({
        firstName: profile.firstName,
        lastName: profile.lastName,
        gender: profile.gender,
        phone: profile.phone,
        privacy: {
          hide_email: profile.hideEmail,
          hide_phone: profile.hidePhone,
        },
      });
      setCurrentUser(result.user);
      setProfile(profileFromUser(result.user));
      setMessage({ type: "success", text: "Профиль сохранен" });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rt-app">
      <aside className="rt-sidebar">
        <div className="rt-brand">
          <span>R</span>
          <strong>RunTogether</strong>
        </div>
        <NavItems active={activeTab} onChange={goTab} />
        <div className="rt-sidebar-user">
          <Avatar user={currentUser} />
          <div>
            <strong>{currentUser.name}</strong>
            <span>Участник</span>
          </div>
          <button type="button" onClick={onLogout} aria-label="Выйти">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="rt-main">
        <TopBar title={titleFor(screen, activeTab, mode)} user={currentUser} onProfile={() => goTab("profile")} />
        {message && <StatusMessage message={message} />}

        {screen === "home" && (
          <HomeScreen
            user={currentUser}
            workouts={visibleWorkouts}
            myWorkouts={myWorkouts}
            loading={loading}
            onOpen={openWorkout}
            onCreate={() => goTab("create")}
          />
        )}

        {screen === "workouts" && (
          <WorkoutsScreen
            workouts={visibleWorkouts}
            userId={currentUser.id}
            filters={filters}
            setFilters={setFilters}
            loading={loading}
            saving={saving}
            onOpen={openWorkout}
            onJoin={joinWorkout}
            onLeave={leaveWorkout}
          />
        )}

        {screen === "detail" && selectedWorkout && (
          <WorkoutDetail
            workout={selectedWorkout}
            saving={saving}
            onJoin={joinWorkout}
            onLeave={leaveWorkout}
            onBack={() => goTab("workouts")}
          />
        )}

        {screen === "create" && (
          <WorkoutForm
            mode={mode}
            form={form}
            setForm={setForm}
            saving={saving}
            onSubmit={saveWorkout}
          />
        )}

        {screen === "organizer" && selectedWorkout && (
          <OrganizerScreen
            workout={selectedWorkout}
            saving={saving}
            onEdit={editWorkout}
            onCancel={cancelWorkout}
            onRequests={openRequests}
            onBack={() => goTab("home")}
          />
        )}

        {screen === "requests" && selectedWorkout && (
          <RequestsScreen
            workout={selectedWorkout}
            requests={requests}
            saving={saving}
            onBack={() => setScreen("organizer")}
            onRespond={respondToRequest}
          />
        )}

        {screen === "profile" && (
          <ProfileScreen
            user={currentUser}
            profile={profile}
            setProfile={setProfile}
            saving={saving}
            onSubmit={saveProfile}
            onLogout={onLogout}
          />
        )}
      </main>

      <nav className="rt-bottom-nav" aria-label="Основная навигация">
        <NavItems active={activeTab} onChange={goTab} compact />
      </nav>
    </div>
  );
}

function HomeScreen({ user, workouts, myWorkouts, loading, onOpen, onCreate }) {
  const nextWorkouts = workouts
    .filter(workout => Number(workout.organizerId) !== Number(user.id) && isJoinableStatus(workout.status))
    .slice(0, 3);
  const nextOrganizerWorkout = myWorkouts.find(workout => !["completed", "cancelled"].includes(workout.status));

  return (
    <section className="rt-page">
      <div className="rt-hero">
        <div>
          <span>Сегодня хороший день для пробежки</span>
          <h1>{user.firstName || user.name}, подберите тренировку рядом или соберите свою группу</h1>
        </div>
        <button className="rt-primary" type="button" onClick={onCreate}>
          <Icon name="plus" />
          Создать тренировку
        </button>
      </div>

      <StatsGrid stats={user.stats} />

      <div className="rt-columns">
        <section>
          <SectionHead title="Ближайшие тренировки" caption={loading ? "Загружаем..." : `${nextWorkouts.length} доступно`} />
          <WorkoutList workouts={nextWorkouts} onOpen={onOpen} empty="Пока нет доступных тренировок" />
        </section>

        <section>
          <SectionHead title="Вы организатор" caption={`${myWorkouts.length} создано`} />
          {nextOrganizerWorkout ? (
            <WorkoutCard workout={nextOrganizerWorkout} onOpen={() => onOpen(nextOrganizerWorkout)} />
          ) : (
            <EmptyState title="Создайте первую тренировку" text="Укажите место, маршрут и лимит участников, а заявки будут приходить сюда." />
          )}
        </section>
      </div>
    </section>
  );
}

function WorkoutsScreen({ workouts, userId, filters, setFilters, loading, saving, onOpen, onJoin, onLeave }) {
  return (
    <section className="rt-page">
      <div className="rt-toolbar">
        <label className="rt-search">
          <Icon name="search" />
          <input
            value={filters.query}
            onChange={event => setFilters(prev => ({ ...prev, query: event.target.value }))}
            placeholder="Поиск по названию, месту или организатору"
          />
        </label>
        <select value={filters.difficulty} onChange={event => setFilters(prev => ({ ...prev, difficulty: event.target.value }))}>
          <option value="">Любая сложность</option>
          <option value="easy">Легкая</option>
          <option value="medium">Средняя</option>
          <option value="hard">Сложная</option>
        </select>
        <select value={filters.sort} onChange={event => setFilters(prev => ({ ...prev, sort: event.target.value }))}>
          <option value="time">По времени</option>
          <option value="distance">По расстоянию</option>
        </select>
      </div>

      <SectionHead title="Тренировки" caption={loading ? "Загружаем..." : `${workouts.length} найдено`} />
      <WorkoutList
        workouts={workouts}
        userId={userId}
        onOpen={onOpen}
        saving={saving}
        onJoin={onJoin}
        onLeave={onLeave}
        empty="Тренировки не найдены"
      />
    </section>
  );
}

function WorkoutDetail({ workout, saving, onJoin, onLeave, onBack }) {
  const canJoin = isJoinableStatus(workout.status) && !["pending", "confirmed"].includes(workout.participantStatus);
  const canLeave = ["pending", "confirmed"].includes(workout.participantStatus);

  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />
        Ко всем тренировкам
      </button>
      <WorkoutHeader workout={workout} />
      <div className="rt-detail-grid">
        <InfoPanel workout={workout} />
        <div className="rt-panel">
          <SectionHead title="Участие" caption={participantLabel(workout.participantStatus) || statusLabel(workout.status)} />
          <p className="rt-muted">
            Организатор рассмотрит заявку и подтвердит участие. Если планы изменятся, заявку можно отменить.
          </p>
          <div className="rt-actions">
            {canJoin && (
              <button className="rt-primary" type="button" disabled={saving} onClick={() => onJoin(workout)}>
                Подать заявку
              </button>
            )}
            {canLeave && (
              <button className="rt-secondary" type="button" disabled={saving} onClick={() => onLeave(workout)}>
                Отменить участие
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrganizerScreen({ workout, saving, onEdit, onCancel, onRequests, onBack }) {
  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />
        На главную
      </button>
      <WorkoutHeader workout={workout} organizer />
      <div className="rt-detail-grid">
        <InfoPanel workout={workout} />
        <div className="rt-panel">
          <SectionHead title="Управление" caption="Заявки и состояние тренировки" />
          <div className="rt-actions vertical">
            <button className="rt-primary" type="button" disabled={saving} onClick={onRequests}>
              <Icon name="users" />
              Заявки участников
            </button>
            <button className="rt-secondary" type="button" disabled={saving || !canEditWorkout(workout)} onClick={onEdit}>
              <Icon name="edit" />
              Редактировать
            </button>
            <button className="rt-danger" type="button" disabled={saving || workout.status === "completed" || workout.status === "cancelled"} onClick={onCancel}>
              Отменить тренировку
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RequestsScreen({ workout, requests, saving, onBack, onRespond }) {
  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />
        К тренировке
      </button>
      <SectionHead title={`Заявки: ${workout.title}`} caption={`${requests.length} всего`} />
      <div className="rt-request-list">
        {requests.map(request => (
          <article className="rt-request" key={request.id}>
            <div className="rt-mini-avatar">{initials(request.full_name || request.email)}</div>
            <div>
              <strong>{request.full_name || request.email}</strong>
              <span>{request.email}</span>
              <em>{participantLabel(request.status)}</em>
            </div>
            {request.status === "pending" && (
              <div className="rt-request-actions">
                <button type="button" disabled={saving} onClick={() => onRespond(request.id, "confirmed")}>Принять</button>
                <button type="button" disabled={saving} onClick={() => onRespond(request.id, "declined")}>Отклонить</button>
              </div>
            )}
          </article>
        ))}
        {!requests.length && <EmptyState title="Заявок пока нет" text="Когда участники отправят заявки, они появятся здесь." />}
      </div>
    </section>
  );
}

function WorkoutForm({ mode, form, setForm, saving, onSubmit }) {
  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  return (
    <section className="rt-page">
      <form className="rt-form rt-panel" onSubmit={onSubmit}>
        <label className="wide">
          <span>Название</span>
          <input value={form.title} onChange={set("title")} maxLength={80} required />
        </label>
        <label>
          <span>Дата и время</span>
          <input value={form.startAt} onChange={set("startAt")} type="datetime-local" required />
        </label>
        <label>
          <span>Длительность, мин</span>
          <input value={form.durationMinutes} onChange={set("durationMinutes")} type="number" min="15" step="5" required />
        </label>
        <label>
          <span>Сложность</span>
          <select value={form.difficulty} onChange={set("difficulty")} required>
            <option value="easy">Легкая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
        </label>
        <label>
          <span>Точка сбора</span>
          <input value={form.meetingName} onChange={set("meetingName")} maxLength={120} required />
        </label>
        <label>
          <span>Адрес</span>
          <input value={form.meetingAddress} onChange={set("meetingAddress")} maxLength={160} />
        </label>
        <label>
          <span>Маршрут</span>
          <input value={form.routeName} onChange={set("routeName")} maxLength={120} required />
        </label>
        <label>
          <span>Дистанция, км</span>
          <input value={form.distanceKm} onChange={set("distanceKm")} type="number" min="0.5" step="0.1" required />
        </label>
        <label>
          <span>Темп, мин/км</span>
          <input value={form.paceMinPerKm} onChange={set("paceMinPerKm")} type="number" min="3" step="0.1" required />
        </label>
        <label>
          <span>Лимит участников</span>
          <input value={form.participantLimit} onChange={set("participantLimit")} type="number" min="1" max="200" required />
        </label>
        <label className="wide">
          <span>Комментарий</span>
          <textarea value={form.description} onChange={set("description")} rows={4} maxLength={600} />
        </label>
        <div className="rt-form-actions wide">
          <button className="rt-primary" type="submit" disabled={saving}>
            {mode === "edit" ? "Сохранить изменения" : "Опубликовать тренировку"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ProfileScreen({ user, profile, setProfile, saving, onSubmit, onLogout }) {
  const set = key => event => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  return (
    <section className="rt-page">
      <div className="rt-profile-head">
        <Avatar user={user} large />
        <div>
          <h1>{user.name}</h1>
          <span>{user.email || "Email скрыт"}</span>
        </div>
      </div>
      <StatsGrid stats={user.stats} />
      <form className="rt-form rt-panel" onSubmit={onSubmit}>
        <label>
          <span>Имя</span>
          <input value={profile.firstName} onChange={set("firstName")} required />
        </label>
        <label>
          <span>Фамилия</span>
          <input value={profile.lastName} onChange={set("lastName")} required />
        </label>
        <label>
          <span>Пол</span>
          <select value={profile.gender || "other"} onChange={set("gender")}>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="other">Другой</option>
          </select>
        </label>
        <label>
          <span>Телефон</span>
          <input value={profile.phone} onChange={set("phone")} placeholder="+7..." />
        </label>
        <label className="rt-checkbox wide">
          <input type="checkbox" checked={profile.hideEmail} onChange={set("hideEmail")} />
          <span>Скрывать email в публичном профиле</span>
        </label>
        <label className="rt-checkbox wide">
          <input type="checkbox" checked={profile.hidePhone} onChange={set("hidePhone")} />
          <span>Скрывать телефон в публичном профиле</span>
        </label>
        <div className="rt-form-actions wide">
          <button className="rt-primary" type="submit" disabled={saving}>Сохранить профиль</button>
          <button className="rt-secondary" type="button" onClick={onLogout}>Выйти</button>
        </div>
      </form>
    </section>
  );
}

function WorkoutList({ workouts, userId, onOpen, saving, onJoin, onLeave, empty }) {
  if (!workouts.length) {
    return <EmptyState title={empty} text="Попробуйте изменить фильтры или создать тренировку самостоятельно." />;
  }

  return (
    <div className="rt-workout-list">
      {workouts.map(workout => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          userId={userId}
          saving={saving}
          onOpen={() => onOpen(workout)}
          onJoin={onJoin ? () => onJoin(workout) : null}
          onLeave={onLeave ? () => onLeave(workout) : null}
        />
      ))}
    </div>
  );
}

function WorkoutCard({ workout, userId, saving, onOpen, onJoin, onLeave }) {
  const isOrganizer = userId && Number(workout.organizerId) === Number(userId);
  const canJoin = onJoin && !isOrganizer && isJoinableStatus(workout.status) && !["pending", "confirmed"].includes(workout.participantStatus);
  const canLeave = onLeave && ["pending", "confirmed"].includes(workout.participantStatus);

  return (
    <article className="rt-workout-card">
      <button className="rt-card-main" type="button" onClick={onOpen}>
        <div>
          <span className="rt-pill">{difficultyLabel(workout.difficulty)}</span>
          <h2>{workout.title}</h2>
          <p>{workout.meetingPoint?.name || workout.route?.name || "Маршрут"}</p>
        </div>
        <StatusBadge status={workout.status} participantStatus={workout.participantStatus} />
      </button>
      <div className="rt-card-meta">
        <Meta icon="clock" value={formatDate(workout.startAt)} />
        <Meta icon="route" value={`${workout.distanceKm} км`} />
        <Meta icon="bolt" value={`${workout.paceMinPerKm} мин/км`} />
        <Meta icon="users" value={`${workout.confirmedCount}/${workout.participantLimit}`} />
      </div>
      <div className="rt-card-footer">
        <span>{workout.organizerName}</span>
        <div>
          {canJoin && <button type="button" disabled={saving} onClick={onJoin}>Заявка</button>}
          {canLeave && <button type="button" disabled={saving} onClick={onLeave}>Отменить</button>}
          <button type="button" onClick={onOpen}>Подробнее</button>
        </div>
      </div>
    </article>
  );
}

function WorkoutHeader({ workout, organizer }) {
  return (
    <div className="rt-workout-header">
      <div>
        <span>{organizer ? "Вы организатор" : workout.organizerName}</span>
        <h1>{workout.title}</h1>
        <p>{workout.description || workout.route?.name || "Маршрут будет уточнен организатором"}</p>
      </div>
      <StatusBadge status={workout.status} participantStatus={workout.participantStatus} />
    </div>
  );
}

function InfoPanel({ workout }) {
  return (
    <div className="rt-panel">
      <SectionHead title="Детали" caption={workout.meetingPoint?.name} />
      <div className="rt-info-grid">
        <Info label="Дата" value={formatDate(workout.startAt)} />
        <Info label="Длительность" value={`${workout.durationMinutes} мин`} />
        <Info label="Дистанция" value={`${workout.distanceKm} км`} />
        <Info label="Темп" value={`${workout.paceMinPerKm} мин/км`} />
        <Info label="Сложность" value={difficultyLabel(workout.difficulty)} />
        <Info label="Места" value={`${workout.freePlaces} свободно из ${workout.participantLimit}`} />
        <Info label="Сбор" value={workout.meetingPoint?.address || workout.meetingPoint?.name || "Не указан"} />
        <Info label="Маршрут" value={workout.route?.name || "Не указан"} />
      </div>
    </div>
  );
}

function StatsGrid({ stats = {} }) {
  return (
    <div className="rt-stats">
      <Stat value={stats.attendedWorkouts || 0} label="тренировок" />
      <Stat value={Number(stats.distance || 0).toFixed(1)} label="км всего" />
      <Stat value={stats.rating || "—"} label="рейтинг" />
      <Stat value={stats.organizedWorkouts || 0} label="организовано" />
    </div>
  );
}

function NavItems({ active, onChange, compact = false }) {
  const items = [
    ["home", "home", "Главная"],
    ["workouts", "runner", "Тренировки"],
    ["create", "plus", "Создать"],
    ["profile", "user", "Профиль"],
  ];

  return (
    <div className={compact ? "rt-nav compact" : "rt-nav"}>
      {items.map(([id, icon, label]) => (
        <button className={active === id ? "active" : ""} type="button" key={id} onClick={() => onChange(id)} aria-label={label}>
          <Icon name={icon} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function TopBar({ title, user, onProfile }) {
  return (
    <header className="rt-top">
      <div>
        <span>RunTogether</span>
        <h1>{title}</h1>
      </div>
      <button type="button" onClick={onProfile} aria-label="Профиль">
        <Avatar user={user} />
      </button>
    </header>
  );
}

function StatusMessage({ message }) {
  return <div className={`rt-message ${message.type}`}>{message.text}</div>;
}

function SectionHead({ title, caption }) {
  return (
    <div className="rt-section-head">
      <h2>{title}</h2>
      {caption && <span>{caption}</span>}
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rt-empty">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rt-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Meta({ icon, value }) {
  return (
    <span>
      <Icon name={icon} />
      {value}
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status, participantStatus }) {
  const ownStatus = participantStatus === "cancelled" ? "" : participantStatus;
  const text = participantLabel(ownStatus) || statusLabel(status);
  return <span className={`rt-status ${ownStatus || status}`}>{text}</span>;
}

function Avatar({ user, large = false }) {
  return <span className={large ? "rt-avatar large" : "rt-avatar"}>{user.initials || initials(user.name)}</span>;
}

function workoutPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    startAt: new Date(form.startAt).toISOString(),
    durationMinutes: Number(form.durationMinutes),
    meetingPoint: {
      name: form.meetingName.trim(),
      address: form.meetingAddress.trim() || null,
    },
    route: {
      name: form.routeName.trim(),
      geojson: null,
    },
    distanceKm: Number(form.distanceKm),
    paceMinPerKm: Number(form.paceMinPerKm),
    difficulty: form.difficulty,
    participantLimit: Number(form.participantLimit),
  };
}

function formFromWorkout(workout) {
  return {
    title: workout.title || "",
    description: workout.description || "",
    startAt: toLocalInputValue(new Date(workout.startAt)),
    durationMinutes: workout.durationMinutes || 60,
    meetingName: workout.meetingPoint?.name || "",
    meetingAddress: workout.meetingPoint?.address || "",
    routeName: workout.route?.name || "",
    distanceKm: workout.distanceKm || 5,
    paceMinPerKm: workout.paceMinPerKm || 6,
    difficulty: workout.difficulty || "easy",
    participantLimit: workout.participantLimit || 10,
  };
}

function profileFromUser(user) {
  return {
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    gender: user.gender || "other",
    phone: user.phone || "",
    hideEmail: Boolean(user.privacy?.hide_email),
    hidePhone: Boolean(user.privacy?.hide_phone),
  };
}

function toLocalInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(value = "U") {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "U";
}

function statusLabel(status) {
  return {
    planned: "Запланирована",
    open: "Открыта",
    full: "Мест нет",
    in_progress: "Идет",
    completed: "Завершена",
    cancelled: "Отменена",
  }[status] || status;
}

function participantLabel(status) {
  return {
    pending: "Заявка на рассмотрении",
    confirmed: "Вы участвуете",
    declined: "Заявка отклонена",
    cancelled: "Участие отменено",
  }[status] || "";
}

function difficultyLabel(value) {
  return {
    easy: "Легкая",
    medium: "Средняя",
    hard: "Сложная",
  }[value] || value;
}

function titleFor(screen, activeTab, mode) {
  if (screen === "create") return mode === "edit" ? "Редактирование тренировки" : "Создание тренировки";
  return {
    home: "Главная",
    workouts: "Тренировки",
    detail: "Карточка тренировки",
    organizer: "Панель организатора",
    requests: "Заявки",
    profile: "Профиль",
  }[screen] || {
    home: "Главная",
    workouts: "Тренировки",
    create: "Создать",
    profile: "Профиль",
  }[activeTab] || "RunTogether";
}

function isJoinableStatus(status) {
  return ["planned", "open"].includes(status);
}

function canEditWorkout(workout) {
  return isJoinableStatus(workout.status) && new Date(workout.startAt) > new Date();
}

function Icon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    arrow: <><path d="M15 18l-6-6 6-6" /><path d="M9 12h12" /></>,
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>,
    runner: <><circle cx="13" cy="4" r="2" /><path d="M9 21l3-7-4-2-2 4" /><path d="M14 8l-2 6 5 2" /><path d="M10 8l4 2 3-2" /></>,
    plus: <><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    route: <><path d="M4 17c5-8 8 4 16-6" /><circle cx="4" cy="17" r="2" /><circle cx="20" cy="11" r="2" /></>,
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-7z" />,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></>,
  };

  return <svg className="rt-icon" {...common}>{icons[name]}</svg>;
}
