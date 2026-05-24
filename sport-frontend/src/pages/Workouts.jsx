import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Btn, Card, EmptyState, Input, Select, StatusBadge } from "../components/ui";
import { T } from "../tokens";

const INITIAL_FORM = {
  title: "",
  startAt: "",
  meetingName: "",
  meetingAddress: "",
  routeName: "",
  distanceKm: 5,
  paceMinPerKm: 6,
  difficulty: "easy",
  participantLimit: 12,
};

export function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("time");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    api.workouts({ difficulty, sort })
      .then(data => setWorkouts(data.workouts))
      .catch(err => setMessage(err.message));
  }, [difficulty, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => workouts.filter(workout =>
    workout.title.toLowerCase().includes(search.toLowerCase()) ||
    workout.organizerName?.toLowerCase().includes(search.toLowerCase())
  ), [workouts, search]);

  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  const create = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await api.createWorkout({
        title: form.title,
        startAt: form.startAt,
        meetingPoint: { name: form.meetingName, address: form.meetingAddress },
        route: { name: form.routeName },
        distanceKm: Number(form.distanceKm),
        paceMinPerKm: Number(form.paceMinPerKm),
        difficulty: form.difficulty,
        participantLimit: Number(form.participantLimit),
      });
      setForm(INITIAL_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const join = async (id) => {
    setMessage("");
    try {
      await api.joinWorkout(id);
      setMessage("Заявка отправлена организатору");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const cancel = async (id) => {
    setMessage("");
    try {
      await api.cancelWorkout(id, "Отменено организатором");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div style={{ padding: "32px 36px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Тренировки</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{filtered.length} записей</p>
        </div>
        <Btn variant="primary" onClick={() => setShowForm(value => !value)}>
          {showForm ? "Скрыть форму" : "Создать"}
        </Btn>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={create} style={{ display: "grid", gridTemplateColumns: "1.2fr 180px 1fr 1fr", gap: 10 }}>
            <Input value={form.title} onChange={set("title")} placeholder="Название" required />
            <Input value={form.startAt} onChange={set("startAt")} type="datetime-local" required />
            <Input value={form.meetingName} onChange={set("meetingName")} placeholder="Точка сбора" required />
            <Input value={form.routeName} onChange={set("routeName")} placeholder="Маршрут" required />
            <Input value={form.meetingAddress} onChange={set("meetingAddress")} placeholder="Адрес" />
            <Input value={form.distanceKm} onChange={set("distanceKm")} type="number" placeholder="Км" required />
            <Input value={form.paceMinPerKm} onChange={set("paceMinPerKm")} type="number" placeholder="Темп" required />
            <Select value={form.difficulty} onChange={set("difficulty")}>
              <option value="easy">Легкая</option>
              <option value="medium">Средняя</option>
              <option value="hard">Сложная</option>
            </Select>
            <Input value={form.participantLimit} onChange={set("participantLimit")} type="number" placeholder="Лимит" required />
            <Btn type="submit" variant="primary">Сохранить</Btn>
          </form>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию или организатору" style={{ flex: 1 }} />
        <Select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
          <option value="">Любая сложность</option>
          <option value="easy">Легкая</option>
          <option value="medium">Средняя</option>
          <option value="hard">Сложная</option>
        </Select>
        <Select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="time">По времени</option>
          <option value="distance">По расстоянию</option>
        </Select>
      </div>

      {message && <div style={{ color: message.includes("отправ") ? T.success : T.danger, fontSize: 13, marginBottom: 12 }}>{message}</div>}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={headerGrid}>
          {["№", "Организатор", "Тренировка", "Дата", "Места", "Статус", ""].map(h => <div key={h}>{h}</div>)}
        </div>

        {filtered.map((workout, index) => (
          <div key={workout.id} style={rowGrid(index, filtered.length)}>
            <span style={{ fontSize: 12, color: T.textHint, fontWeight: 700 }}>{workout.id}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{workout.organizerName}</span>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{workout.title}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {workout.distanceKm} км · {workout.paceMinPerKm} мин/км · {difficultyLabel(workout.difficulty)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{new Date(workout.startAt).toLocaleDateString()}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{new Date(workout.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div style={{ fontSize: 13 }}>{workout.confirmedCount} / {workout.participantLimit}</div>
            <StatusBadge status={workout.status} />
            <div style={{ display: "flex", gap: 6 }}>
              <Btn onClick={() => join(workout.id)} disabled={!["planned", "open"].includes(workout.status)}>Заявка</Btn>
              <Btn danger onClick={() => cancel(workout.id)} disabled={["completed", "cancelled"].includes(workout.status)}>Отмена</Btn>
            </div>
          </div>
        ))}
        {!filtered.length && <EmptyState>Тренировки не найдены.</EmptyState>}
      </Card>
    </div>
  );
}

function difficultyLabel(value) {
  return { easy: "легкая", medium: "средняя", hard: "сложная" }[value] || value;
}

const headerGrid = {
  display: "grid",
  gridTemplateColumns: "64px 140px 1fr 130px 90px 130px 180px",
  padding: "10px 18px", fontSize: 11.5, color: T.textHint,
  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`,
};

function rowGrid(index, total) {
  return {
    display: "grid",
    gridTemplateColumns: "64px 140px 1fr 130px 90px 130px 180px",
    padding: "12px 18px", alignItems: "center",
    borderBottom: index < total - 1 ? `1px solid ${T.border}` : "none",
    gap: 8,
  };
}
