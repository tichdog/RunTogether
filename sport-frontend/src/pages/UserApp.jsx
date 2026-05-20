import { useMemo, useState } from "react";
import "../styles/user-app.css";

const demoUser = {
  firstName: "Алина",
  lastName: "К",
  name: "Алина К",
  initials: "А",
};

const workoutsSeed = [
  {
    id: 1,
    title: "Парк",
    subtitle: "Парк - Сб 12:00",
    date: "Сегодня, 10:00",
    distance: "3.2 км",
    pace: "6-7 км/ч",
    paceShort: "6-7",
    level: "Средний",
    places: "3/10 мест",
    organizer: "Aaa User",
    organizerInitial: "A",
    rating: "4.7",
    status: "open",
  },
  {
    id: 2,
    title: "Парк",
    subtitle: "Парк - Вс 16:00",
    date: "Сегодня, 10:00",
    distance: "3.2 км",
    pace: "6-7 км/ч",
    paceShort: "6-7",
    level: "Легкий",
    places: "5/10 мест",
    organizer: "A User",
    organizerInitial: "A",
    rating: "4.7",
    status: "open",
  },
  {
    id: 3,
    title: "Набережная",
    subtitle: "Набережная - Завтра 08:00",
    date: "Завтра, 08:00",
    distance: "7.4 км",
    pace: "5-6 км/ч",
    paceShort: "5-6",
    level: "Сложный",
    places: "8/12 мест",
    organizer: "Мария Л",
    organizerInitial: "М",
    rating: "4.9",
    status: "open",
  },
];

const requestSeed = [
  { id: 1, name: "Анна М", meta: "10 тренировок, рейтинг 4.8", status: "pending" },
  { id: 2, name: "Игорь С", meta: "3 тренировки, рейтинг 4.5", status: "pending" },
  { id: 3, name: "Оля Р", meta: "18 тренировок, рейтинг 4.9", status: "confirmed" },
];

const screenTitles = {
  login: "Вход",
  register: "Регистрация",
  recover: "Восстановление",
  home: "Главная",
  workouts: "Тренировки",
  detail: "Инфо тренировки",
  tracking: "Процесс тренировки",
  rating: "Оценка",
  create: "Создание тренировки",
  route: "Создание маршрута",
  organizer: "Вы организатор",
  requests: "Заявки",
  chat: "Чат",
  profile: "Профиль",
};

export function UserApp({ user, onLogout }) {
  const [screen, setScreen] = useState(user ? "home" : "login");
  const [activeTab, setActiveTab] = useState("home");
  const [selectedWorkout, setSelectedWorkout] = useState(workoutsSeed[0]);
  const [joined, setJoined] = useState(false);
  const [requests, setRequests] = useState(requestSeed);
  const [createdWorkout, setCreatedWorkout] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [routePoints, setRoutePoints] = useState([
    { x: 14, y: 22 },
    { x: 28, y: 70 },
    { x: 84, y: 62 },
  ]);

  const currentUser = user || demoUser;
  const selected = selectedWorkout || workoutsSeed[0];
  const isAuthScreen = ["login", "register", "recover"].includes(screen);
  const hasContextTopbar = !["home", "workouts", "profile", "tracking", "rating", "chat", "organizer", "requests"].includes(screen);
  const showBottomNav = !["login", "register", "recover", "tracking", "rating", "chat"].includes(screen);

  const openWorkout = (workout) => {
    setSelectedWorkout(workout);
    setScreen("detail");
  };

  const goTab = (tab) => {
    setActiveTab(tab);
    setScreen(tab);
  };

  const signIn = () => {
    setAuthMode("login");
    setScreen("home");
    setActiveTab("home");
  };

  const signOut = () => {
    onLogout?.();
    setScreen("login");
    setActiveTab("home");
    setJoined(false);
  };

  const publishWorkout = () => {
    setCreatedWorkout(true);
    setSelectedWorkout(workoutsSeed[0]);
    setScreen("organizer");
    setActiveTab("create");
  };

  const updateRequest = (id, status) => {
    setRequests(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const handleTopbarBack = () => {
    if (screen === "route") {
      setScreen("create");
      return;
    }
    if (screen === "detail") {
      goTab(activeTab === "workouts" ? "workouts" : "home");
      return;
    }
    goTab("home");
  };

  const addRoutePoint = () => {
    const next = [
      { x: 18, y: 18 },
      { x: 30, y: 68 },
      { x: 86, y: 60 },
      { x: 66, y: 28 },
    ];
    setRoutePoints(prev => prev.length >= next.length ? next.slice(0, 3) : next.slice(0, prev.length + 1));
  };

  const renderScreen = () => {
    if (screen === "login" || screen === "register" || screen === "recover") {
      return (
        <AuthMock
          mode={authMode}
          setMode={(mode) => {
            setAuthMode(mode);
            setScreen(mode);
          }}
          onSubmit={signIn}
        />
      );
    }

    if (screen === "home") {
      return <HomeScreen user={currentUser} onOpen={openWorkout} onCreate={() => goTab("create")} onProfile={() => goTab("profile")} />;
    }

    if (screen === "workouts") {
      return <WorkoutsScreen workouts={workoutsSeed} onOpen={openWorkout} />;
    }

    if (screen === "detail") {
      return <WorkoutDetail workout={selected} joined={joined} onJoin={() => setJoined(true)} onChat={() => setScreen("chat")} onTrack={() => setScreen("tracking")} />;
    }

    if (screen === "tracking") {
      return <TrackingScreen workout={selected} onFinish={() => setScreen("rating")} />;
    }

    if (screen === "rating") {
      return <RatingScreen onDone={() => goTab("home")} />;
    }

    if (screen === "create") {
      return <CreateWorkoutScreen onNext={() => setScreen("route")} />;
    }

    if (screen === "route") {
      return <RouteScreen points={routePoints} addPoint={addRoutePoint} onPublish={publishWorkout} />;
    }

    if (screen === "organizer") {
      return <OrganizerScreen workout={selected} created={createdWorkout} onRequests={() => setScreen("requests")} onChat={() => setScreen("chat")} />;
    }

    if (screen === "requests") {
      return <RequestsScreen requests={requests} onBack={() => setScreen("organizer")} onUpdate={updateRequest} />;
    }

    if (screen === "chat") {
      return <ChatScreen workout={selected} onBack={() => setScreen(activeTab === "create" ? "organizer" : "detail")} />;
    }

    if (screen === "profile") {
      return <ProfileScreen user={currentUser} onLogout={signOut} />;
    }

    return null;
  };

  return (
    <div className="rt-stage">
      {!isAuthScreen && (
        <nav className="desktop-navbar">
          <div className="navbar-brand">
            <strong>RunTogether</strong>
          </div>
          <div className="navbar-items">
            <button
              className={`navbar-item ${activeTab === "home" ? "active" : ""}`}
              onClick={() => goTab("home")}
              type="button"
            >
              <Icon name="home" />
              <span>Главная</span>
            </button>
            <button
              className={`navbar-item ${activeTab === "workouts" ? "active" : ""}`}
              onClick={() => goTab("workouts")}
              type="button"
            >
              <Icon name="runner" />
              <span>Тренировки</span>
            </button>
            <button
              className={`navbar-item ${activeTab === "create" ? "active" : ""}`}
              onClick={() => goTab("create")}
              type="button"
            >
              <Icon name="plus" />
              <span>Создать</span>
            </button>
            <button
              className={`navbar-item ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => goTab("profile")}
              type="button"
            >
              <Icon name="users" />
              <span>Профиль</span>
            </button>
          </div>
          <div className="navbar-bottom">
            <div className="navbar-user">
              <span className="navbar-user-name">{currentUser.name}</span>
              <span className="navbar-user-role">Пользователь</span>
            </div>
            <button
              className="primary-wide"
              onClick={signOut}
              type="button"
              style={{ width: "100%", minHeight: 38, fontSize: 12 }}
            >
              Выйти
            </button>
          </div>
        </nav>
      )}
      <div className={`${!isAuthScreen ? "phone-wrapper" : ""}`}>
        <div className="rt-phone" data-screen={screen}>
          {!isAuthScreen && hasContextTopbar && (
            <header className="rt-topbar">
              <button className="icon-btn" type="button" aria-label="Назад" onClick={handleTopbarBack}>
                <Icon name="arrow" />
              </button>
              <span>{screenTitles[screen]}</span>
              <button className="avatar-btn" type="button" onClick={() => goTab("profile")} aria-label="Профиль">
                {currentUser.initials || "A"}
              </button>
            </header>
          )}

          <main className="rt-screen">{renderScreen()}</main>

          {showBottomNav && (
            <BottomNav active={activeTab} onChange={goTab} />
          )}
        </div>
      </div>
    </div>
  );
}

function AuthMock({ mode, setMode, onSubmit }) {
  const isLogin = mode === "login";
  const isRegister = mode === "register";

  return (
    <section className="auth-mock">
      <div className="auth-orb">R</div>
      <h1>RunTogether</h1>
      <p>{isLogin ? "Вход" : isRegister ? "Создать аккаунт" : "Восстановить пароль"}</p>

      <form className="mock-form" onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}>
        {isRegister && (
          <div className="field-row">
            <label>
              <span>Имя</span>
              <input defaultValue="Алина" />
            </label>
            <label>
              <span>Фамилия</span>
              <input defaultValue="К" />
            </label>
          </div>
        )}
        <label>
          <span>Email</span>
          <input type="email" defaultValue="runner@mail.ru" />
        </label>
        {!mode.includes("recover") && (
          <label>
            <span>Пароль</span>
            <input type="password" defaultValue="runner123" />
          </label>
        )}
        {isRegister && (
          <label className="check-line">
            <input type="checkbox" defaultChecked />
            <span>Скрывать телефон и email в публичном профиле</span>
          </label>
        )}
        <button className="primary-wide" type="submit">
          {isLogin ? "Войти" : isRegister ? "Зарегистрироваться" : "Отправить ссылку"}
        </button>
      </form>

      <div className="auth-links">
        <button type="button" onClick={() => setMode(isLogin ? "register" : "login")}>
          {isLogin ? "Регистрация" : "Уже есть аккаунт"}
        </button>
        <button type="button" onClick={() => setMode("recover")}>Забыли пароль?</button>
      </div>
    </section>
  );
}

function HomeScreen({ user, onOpen, onCreate, onProfile }) {
  return (
    <section className="content-pad home-screen">
      <div className="home-head">
        <div>
          <p>Добро пожаловать!</p>
          <strong>{user.name}</strong>
        </div>
        <button className="home-avatar" type="button" onClick={onProfile}>{user.initials || "A"}</button>
      </div>

      <StatsRow />

      <div className="section-title">Тренировки</div>
      <WorkoutCard workout={workoutsSeed[0]} onOpen={() => onOpen(workoutsSeed[0])} />
      <WorkoutCard workout={workoutsSeed[1]} onOpen={() => onOpen(workoutsSeed[1])} compact />

      <button className="secondary-wide" type="button" onClick={onCreate}>Создать тренировку</button>
    </section>
  );
}

function WorkoutsScreen({ workouts, onOpen }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("Все");

  const filtered = useMemo(() => workouts.filter(workout => {
    const matchesText = workout.subtitle.toLowerCase().includes(query.trim().toLowerCase());
    const matchesLevel = level === "Все" || workout.level === level;
    return matchesText && matchesLevel;
  }), [query, level, workouts]);

  return (
    <section className="content-pad workouts-screen">
      <div className="filter-row">
        <label className="search-field">
          <Icon name="search" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск" />
        </label>
        <button className="filter-btn" type="button" aria-label="Фильтр">
          <Icon name="filter" />
        </button>
      </div>
      <div className="chip-row">
        {["Все", "Легкий", "Средний", "Сложный"].map(item => (
          <button className={level === item ? "chip active" : "chip"} type="button" key={item} onClick={() => setLevel(item)}>
            {item}
          </button>
        ))}
      </div>
      {filtered.map(workout => (
        <WorkoutCard key={workout.id} workout={workout} onOpen={() => onOpen(workout)} />
      ))}
      {!filtered.length && <div className="empty-state">Тренировки не найдены</div>}
    </section>
  );
}

function WorkoutDetail({ workout, joined, onJoin, onChat, onTrack }) {
  return (
    <section className="detail-screen">
      <RouteMap variant="loop" />
      <div className="detail-body">
        <div className="detail-title">
          <h1>{workout.title}</h1>
          <strong>{workout.places}</strong>
        </div>
        <InfoGrid workout={workout} />
        <Participants />
        <Organizer workout={workout} />
        <div className="action-grid">
          <button className="soft-action" type="button" onClick={onChat}>
            <Icon name="chat" />
            Чат
          </button>
          <button className={joined ? "soft-action confirmed" : "primary-action"} type="button" onClick={joined ? onTrack : onJoin}>
            {joined ? "Начать" : "Подать заявку"}
          </button>
        </div>
      </div>
    </section>
  );
}

function TrackingScreen({ workout, onFinish }) {
  const [paused, setPaused] = useState(false);

  return (
    <section className="tracking-screen">
      <RouteMap variant="track" />
      <div className="tracking-panel">
        <div className="distance-main">
          <strong>2.2</strong>
          <span>километров</span>
        </div>
        <div className="tracking-metrics">
          <Metric value="30:00" label="Время" />
          <Metric value={workout.distance} label="Дистанция" />
          <Metric value={workout.paceShort} label="Темп/км" />
        </div>
        <Organizer workout={workout} small />
        <div className="tracking-actions">
          <button className="round-control" type="button" onClick={() => setPaused(prev => !prev)} aria-label={paused ? "Продолжить" : "Пауза"}>
            <Icon name={paused ? "play" : "pause"} />
          </button>
          <button className="primary-action" type="button" onClick={onFinish}>Завершить</button>
        </div>
      </div>
    </section>
  );
}

function RatingScreen({ onDone }) {
  const [organizerStars, setOrganizerStars] = useState(0);
  const [workoutStars, setWorkoutStars] = useState(0);

  return (
    <section className="content-pad rating-screen">
      <h1>Оцените тренировку</h1>
      <RatingLine label="Организатор" value={organizerStars} onChange={setOrganizerStars} />
      <RatingLine label="Тренировка" value={workoutStars} onChange={setWorkoutStars} />
      <label className="comment-field">
        <span>Комментарий</span>
        <textarea rows={5} />
      </label>
      <button className="soft-action menu-action" type="button" onClick={onDone}>В меню</button>
    </section>
  );
}

function CreateWorkoutScreen({ onNext }) {
  return (
    <section className="content-pad create-screen">
      <form className="create-form" onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}>
        <label className="wide">
          <span>Название</span>
          <input defaultValue="Парк" />
        </label>
        <label>
          <span>Дата</span>
          <input defaultValue="10 марта" />
        </label>
        <label>
          <span>Время</span>
          <input defaultValue="12:00" />
        </label>
        <label>
          <span>Темп</span>
          <input defaultValue="6 км/ч" />
        </label>
        <label>
          <span>Уровень</span>
          <select defaultValue="Средний">
            <option>Легкий</option>
            <option>Средний</option>
            <option>Сложный</option>
          </select>
        </label>
        <label>
          <span>Лимит человек</span>
          <input defaultValue="10" />
        </label>
        <label>
          <span>Сложность</span>
          <input defaultValue="3/5" />
        </label>
        <label className="wide">
          <span>Комментарий</span>
          <textarea rows={4} />
        </label>
        <button className="soft-action form-next" type="submit">Маршрут</button>
      </form>
    </section>
  );
}

function RouteScreen({ points, addPoint, onPublish }) {
  return (
    <section className="content-pad create-screen">
      <div className="route-editor">
        <div className="map-editor" role="button" tabIndex={0} onClick={addPoint} onKeyDown={event => event.key === "Enter" && addPoint()}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <polyline points={points.map(point => `${point.x},${point.y}`).join(" ")} />
            {points.map(point => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" />)}
          </svg>
        </div>
        <label className="wide">
          <span>Комментарий</span>
          <textarea rows={4} />
        </label>
        <button className="soft-action form-next" type="button" onClick={onPublish}>Опубликовать</button>
      </div>
    </section>
  );
}

function OrganizerScreen({ workout, created, onRequests, onChat }) {
  return (
    <section className="detail-screen">
      <div className="organizer-ribbon">Вы организатор</div>
      <RouteMap variant="loop" />
      <div className="detail-body">
        {created && <div className="success-note">Тренировка опубликована</div>}
        <div className="detail-title">
          <h1>{workout.title}</h1>
          <strong>{workout.places}</strong>
        </div>
        <InfoGrid workout={workout} />
        <Participants />
        <Organizer workout={workout} />
        <div className="action-grid organizer-actions">
          <button className="soft-action" type="button" onClick={onChat}>
            <Icon name="chat" />
            Чат
          </button>
          <button className="soft-action" type="button" onClick={onRequests}>
            <Icon name="users" />
            Заявки
          </button>
          <button className="soft-action" type="button">
            <Icon name="edit" />
            Изменить
          </button>
          <button className="danger-action" type="button">Отменить</button>
        </div>
      </div>
    </section>
  );
}

function RequestsScreen({ requests, onBack, onUpdate }) {
  return (
    <section className="content-pad requests-screen">
      <button className="plain-back" type="button" onClick={onBack}>
        <Icon name="arrow" />
        Назад
      </button>
      <h1>Заявки</h1>
      {requests.map(item => (
        <article className="request-card" key={item.id}>
          <div className="mini-avatar">{item.name[0]}</div>
          <div>
            <strong>{item.name}</strong>
            <span>{item.meta}</span>
            <em className={`request-status ${item.status}`}>{requestLabel(item.status)}</em>
          </div>
          {item.status === "pending" && (
            <div className="request-actions">
              <button type="button" onClick={() => onUpdate(item.id, "confirmed")}>Да</button>
              <button type="button" onClick={() => onUpdate(item.id, "declined")}>Нет</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function ChatScreen({ workout, onBack }) {
  const [messages, setMessages] = useState([
    { id: 1, author: "user1", text: "На месте. Не вижу вас", mine: false },
    { id: 2, author: "user2", text: "Подождите меня, пожалуйста! 1 мин", mine: false },
    { id: 3, author: "Вы", text: "Мы у скамейки, ждем всех и начинаем", mine: true },
  ]);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), author: "Вы", text: text.trim(), mine: true }]);
    setText("");
  };

  return (
    <section className="chat-screen">
      <header className="chat-head">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Назад">
          <Icon name="arrow" />
        </button>
        <div>
          <h1>{workout.title}</h1>
          <span>Кол-во участников - дата время</span>
        </div>
      </header>
      <div className="message-list">
        {messages.map(message => (
          <article className={message.mine ? "message mine" : "message"} key={message.id}>
            {!message.mine && <span>{message.author}</span>}
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      <form className="chat-form" onSubmit={(event) => {
        event.preventDefault();
        send();
      }}>
        <input value={text} onChange={event => setText(event.target.value)} />
        <button type="submit" aria-label="Отправить">
          <Icon name="send" />
        </button>
      </form>
    </section>
  );
}

function ProfileScreen({ user, onLogout }) {
  return (
    <section className="content-pad profile-screen">
      <div className="profile-avatar">{user.initials || "A"}</div>
      <StatsRow />
      <ProfileLink label="Достижения" value="3 значка" />
      <ProfileLink label="История тренировок" value="10 записей" />
      <ProfileLink label="Настройки" value="Приватность" />
      <ProfileLink label="Отзывы и рейтинг" value="10.0" />
      <ProfileLink label="Оставить жалобу" value="" />
      <button className="danger-action logout-action" type="button" onClick={onLogout}>Выйти</button>
    </section>
  );
}

function WorkoutCard({ workout, onOpen, compact = false }) {
  return (
    <article className={compact ? "workout-card compact" : "workout-card"} onClick={onOpen}>
      <div className="card-main">
        <h2>{workout.subtitle}</h2>
        <div className="card-meta">
          <span><Icon name="clock" /> {workout.date}</span>
          <span><Icon name="route" /> {workout.distance}</span>
          <span><Icon name="bolt" /> {workout.pace}</span>
        </div>
      </div>
      <div className="card-footer">
        <div className="mini-avatar">{workout.organizerInitial}</div>
        <span>{workout.organizer}</span>
        <strong><Icon name="star" /> {workout.rating}</strong>
      </div>
    </article>
  );
}

function BottomNav({ active, onChange }) {
  const items = [
    ["home", "home", "Главная"],
    ["workouts", "runner", "Бег"],
    ["create", "plus", "Создать"],
    ["profile", "users", "Профиль"],
  ];

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map(([id, icon, label]) => (
        <button className={active === id ? "active" : ""} type="button" key={id} onClick={() => onChange(id)} aria-label={label}>
          <Icon name={icon} />
        </button>
      ))}
    </nav>
  );
}

function StatsRow() {
  return (
    <div className="stats-row">
      <Stat value="10" label="Тренировок" />
      <Stat value="100" label="Км всего" />
      <Stat value="10.0" label="Рейтинг" />
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function InfoGrid({ workout }) {
  return (
    <div className="info-grid">
      <Info label="Дата" value={workout.date} />
      <Info label="Дистанция" value={workout.distance} />
      <Info label="Темп" value={workout.pace} />
      <Info label="Уровень" value={workout.level} />
    </div>
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

function Participants() {
  return (
    <section className="mini-section">
      <h2>Участники</h2>
      <div className="participant-stack">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function Organizer({ workout, small = false }) {
  return (
    <section className={small ? "organizer small" : "organizer"}>
      <h2>Организатор</h2>
      <div>
        <div className="large-avatar">{workout.organizerInitial}</div>
        <p>
          <strong>{workout.organizer}</strong>
          <span><Icon name="star" /> {workout.rating} 10 тренировок</span>
        </p>
      </div>
    </section>
  );
}

function Metric({ value, label }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RatingLine({ label, value, onChange }) {
  return (
    <div className="rating-line">
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map(star => (
          <button className={value >= star ? "active" : ""} type="button" key={star} onClick={() => onChange(star)}>
            <Icon name="star" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileLink({ label, value }) {
  return (
    <button className="profile-link" type="button">
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function RouteMap({ variant }) {
  return (
    <div className={`route-map ${variant}`}>
      <svg viewBox="0 0 320 220" aria-hidden="true">
        {variant === "track" ? (
          <>
            <path className="map-path" d="M34 128 C80 180 114 112 157 95 C206 77 210 150 256 134 C284 125 292 101 320 94" />
            <path className="map-flag" d="M56 130 L48 82 L78 98 L54 104" />
          </>
        ) : (
          <>
            <path className="map-outline" d="M38 174 C50 90 95 18 118 30 C139 42 145 62 155 80 C171 109 196 95 217 90 C243 82 272 115 278 149 C284 183 233 166 201 166 C155 166 120 128 92 130 C66 132 67 173 38 174 Z" />
            <path className="map-path" d="M36 170 C75 152 82 103 124 94 C164 85 172 129 218 132 C247 134 255 128 276 130" />
            <path className="map-flag" d="M50 160 L44 124 L68 137 L48 140" />
          </>
        )}
      </svg>
    </div>
  );
}

function requestLabel(status) {
  return {
    pending: "Ожидает",
    confirmed: "Подтвержден",
    declined: "Отклонен",
  }[status] || status;
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
    arrow: <path d="M15 18l-6-6 6-6M9 12h12" />,
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>,
    runner: <><circle cx="13" cy="4" r="2" /><path d="M9 21l3-7-4-2-2 4" /><path d="M14 8l-2 6 5 2" /><path d="M10 8l4 2 3-2" /></>,
    plus: <><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    filter: <><path d="M3 5h18M6 12h12M10 19h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    route: <><path d="M4 17c5-8 8 4 16-6" /><circle cx="4" cy="17" r="2" /><circle cx="20" cy="11" r="2" /></>,
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-7z" />,
    star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9z" />,
    pause: <><path d="M9 5v14" /><path d="M15 5v14" /></>,
    play: <path d="M8 5v14l11-7z" />,
    send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  };

  return <svg className="rt-icon" {...common}>{icons[name]}</svg>;
}
