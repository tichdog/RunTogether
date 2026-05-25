import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Avatar, Badge, Btn, Card, EmptyState, SectionTitle, StatusBadge } from "../components/ui";
import { ReportUserButton } from "../components/ReportUserButton";
import { ROLE_COLORS, ROLE_LABELS, T } from "../tokens";

const STAT_ACCENTS = [T.accent, T.success, T.warning, T.danger];

export function Overview({ setActive, setSelectedUser, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.users().then(data => setUsers(data.users)),
      api.workouts().then(data => setWorkouts(data.workouts)),
      api.activities().then(data => setActivities(data.activities)),
      api.reports().then(data => setReports(data.reports)).catch(() => setReports([])),
    ]).catch(err => setError(err.message));
  }, []);

  const stats = useMemo(() => ([
    { label: "Пользователей", val: users.length, sub: "зарегистрировано" },
    { label: "Тренировок", val: workouts.length, sub: `${workouts.filter(w => w.status === "open").length} с открытым набором` },
    { label: "Жалоб", val: reports.length, sub: "в истории модерации" },
    { label: "Завершено", val: workouts.filter(w => w.status === "completed").length, sub: "тренировок" },
  ]), [users, workouts, reports]);

  return (
    <div style={{ padding: "32px 36px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Обзор системы</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
          Реальные данные из PostgreSQL через NodeJS API.
        </p>
      </div>

      {error && <div style={{ color: T.danger, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {stats.map((s, i) => (
          <Card key={s.label} style={{ padding: "18px 20px", borderTop: `3px solid ${STAT_ACCENTS[i]}` }}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8, fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text }}>{s.val}</div>
            <div style={{ fontSize: 12, color: T.textHint, marginTop: 6 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>Последние пользователи</div>
            <Btn onClick={() => setActive("Пользователи")} style={{ fontSize: 12 }}>Все пользователи</Btn>
          </div>

          {users.slice(0, 5).map(user => (
            <div key={user.id} style={{
              display: "grid", gridTemplateColumns: "1fr 120px 110px 90px",
              gap: 8, alignItems: "center", padding: "10px 0",
              borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Avatar initials={user.initials} src={user.avatarUrl} size={30} />
                <button
                  onClick={() => { setActive("Пользователи"); setSelectedUser(user); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.text, padding: 0 }}
                >
                  {user.name}
                </button>
              </div>
              <Badge text={ROLE_LABELS[user.role]} colors={ROLE_COLORS[user.role]} />
              <StatusBadge status={user.status} />
              <ReportUserButton user={user} currentUserId={currentUserId} compact />
            </div>
          ))}
          {!users.length && <EmptyState>Пользователей пока нет.</EmptyState>}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionTitle>Лента активности</SectionTitle>
          {activities.slice(0, 6).map(item => (
            <Card key={item.id} style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{activityTitle(item)}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                {item.actor_name || "Система"} · {new Date(item.created_at).toLocaleString()}
              </div>
            </Card>
          ))}
          {!activities.length && <Card style={{ padding: 12, color: T.textMuted, fontSize: 13 }}>Активности пока нет.</Card>}
        </div>
      </div>
    </div>
  );
}

function activityTitle(item) {
  if (item.type === "workout_created") return `Создана тренировка: ${item.workout_title || item.metadata?.title || ""}`;
  if (item.type === "achievement_earned") return `Получено достижение: ${item.metadata?.title || ""}`;
  return item.type;
}
