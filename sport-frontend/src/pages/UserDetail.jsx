import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Avatar, Badge, Btn, Card, SectionTitle, StatusBadge } from "../components/ui";
import { ROLE_COLORS, ROLE_LABELS, STATUS_LABELS, T } from "../tokens";

export function UserDetail({ user, currentAdmin, onBack, onChanged, onDeleted }) {
  const [current, setCurrent] = useState(user);
  const [role, setRole] = useState(user.role);
  const [history, setHistory] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrent(user);
    setRole(user.role);
    api.history(user.id).then(data => setHistory(data.history)).catch(() => setHistory([]));
    api.achievements(user.id).then(data => setAchievements(data.achievements)).catch(() => setAchievements([]));
  }, [user]);

  const saveRole = async () => {
    setError("");
    try {
      const data = await api.updateRole(current.id, role);
      setCurrent(data.user);
      onChanged?.(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const block = async () => {
    setError("");
    try {
      const data = await api.blockUser(current.id);
      setCurrent(data.user);
      onChanged?.(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    setError("");
    try {
      await api.deleteUser(current.id);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const isSelf = Number(current.id) === Number(currentAdmin?.id);
  const targetIsAdmin = ["admin", "super_admin"].includes(current.role);
  const canManageTargetAdmin = currentAdmin?.role === "super_admin";
  const canDelete = !isSelf && (!targetIsAdmin || canManageTargetAdmin);
  const canBlock = canDelete;
  const canChangeRole = !isSelf && (!targetIsAdmin || canManageTargetAdmin);

  const statCards = [
    ["Проведено", current.stats?.organizedWorkouts || 0, T.accent],
    ["Посещено", current.stats?.attendedWorkouts || 0, T.success],
    ["Дистанция", `${current.stats?.distance || 0} км`, T.warning],
    ["Рейтинг", current.stats?.rating || "нет", T.text],
  ];

  return (
    <div style={{ padding: "32px 36px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
        <Btn onClick={onBack}>Назад</Btn>
        <div style={{ fontSize: 13, color: T.textMuted }}>
          Пользователи / <strong style={{ color: T.text }}>{current.name}</strong>
        </div>
      </div>

      {error && <div style={{ color: T.danger, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <Avatar initials={current.initials} src={current.avatarUrl} size={48} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{current.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <Badge text={ROLE_LABELS[current.role]} colors={ROLE_COLORS[current.role]} />
                  <StatusBadge status={current.status} />
                </div>
              </div>
            </div>

            {[
              ["ID", current.id],
              ["Почта", current.email || "скрыто"],
              ["Телефон", current.phone || "скрыто"],
              ["Верификация", STATUS_LABELS[current.verified] || current.verified],
              ["Подтвержден телефон", current.phoneVerified ? "Да" : "Нет"],
              ["Регистрация", new Date(current.registered).toLocaleDateString()],
            ].map(([key, value]) => (
              <div key={key} style={{
                display: "flex", justifyContent: "space-between",
                padding: "10px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13,
              }}>
                <span style={{ color: T.textMuted }}>{key}</span>
                <span style={{ fontWeight: 700, color: T.text }}>{value}</span>
              </div>
            ))}
          </Card>

          <Card>
            <SectionTitle>История по месяцам</SectionTitle>
            {history.map(item => (
              <div key={item.month} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                <span>{new Date(item.month).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</span>
                <strong>{item.workouts_count} тренировок · {Number(item.distance_km).toFixed(1)} км</strong>
              </div>
            ))}
            {!history.length && <div style={{ color: T.textMuted, fontSize: 13 }}>Истории пока нет.</div>}
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card>
            <SectionTitle>Статистика</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {statCards.map(([key, value, color]) => (
                <div key={key} style={{ background: T.surfaceAlt, borderRadius: T.radius, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: T.textHint, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{key}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Роль пользователя</SectionTitle>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ width: "100%", padding: 9, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, marginBottom: 10 }}>
              <option value="member">Участник</option>
              <option value="admin">Администратор</option>
              {(currentAdmin?.role === "super_admin" || role === "super_admin") && (
                <option value="super_admin" disabled={currentAdmin?.role !== "super_admin"}>Супер-админ</option>
              )}
            </select>
            <Btn variant="primary" onClick={saveRole} disabled={!canChangeRole} style={{ width: "100%" }}>Сохранить роль</Btn>
            {!canChangeRole && (
              <div style={{ marginTop: 8, color: T.textMuted, fontSize: 12 }}>
                Свою роль менять нельзя. Админов может менять только супер-админ.
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Достижения</SectionTitle>
            {achievements.map(item => (
              <div key={item.id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{item.description}</div>
              </div>
            ))}
            {!achievements.length && <div style={{ color: T.textMuted, fontSize: 13 }}>Пока нет достижений.</div>}
          </Card>

          <Card>
            <SectionTitle>Модерация</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn danger onClick={block} disabled={!canBlock} style={{ width: "100%" }}>Заблокировать</Btn>
              <Btn danger onClick={remove} disabled={!canDelete} style={{ width: "100%" }}>Удалить пользователя</Btn>
            </div>
            {!canDelete && (
              <div style={{ marginTop: 8, color: T.textMuted, fontSize: 12 }}>
                Админ не может удалить сам себя. Других админов может удалить только супер-админ.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
