import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Avatar, Badge, Card, EmptyState, Input, Select, StatusBadge } from "../components/ui";
import { ROLE_COLORS, ROLE_LABELS, STATUS_LABELS, T } from "../tokens";

export function UsersList({ onSelect }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.users().then(data => setUsers(data.users)).catch(err => setError(err.message));
  }, []);

  const filtered = useMemo(() => users.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) &&
    (!roleFilter || user.role === roleFilter) &&
    (!statusFilter || user.status === statusFilter)
  ), [users, search, roleFilter, statusFilter]);

  return (
    <div style={{ padding: "32px 36px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Пользователи</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{filtered.length} записей</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени" style={{ flex: 1 }} />
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Все роли</option>
          <option value="member">Участник</option>
          <option value="admin">Администратор</option>
          <option value="super_admin">Супер-админ</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="active">Активен</option>
          <option value="blocked">Блок</option>
        </Select>
      </div>

      {error && <div style={{ color: T.danger, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={headerGrid}>
          {["№", "Пользователь", "Email", "Роль", "Статус", "Верификация"].map(h => <div key={h}>{h}</div>)}
        </div>

        {filtered.map((user, i) => (
          <div key={user.id} onClick={() => onSelect(user)} style={rowGrid(i, filtered.length)}>
            <span style={{ fontSize: 12, color: T.textHint, fontWeight: 700 }}>{user.id}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Avatar initials={user.initials} src={user.avatarUrl} size={28} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{user.name}</span>
            </div>
            <span style={{ fontSize: 13, color: T.textMuted }}>{user.email || "скрыто"}</span>
            <Badge text={ROLE_LABELS[user.role]} colors={ROLE_COLORS[user.role]} />
            <StatusBadge status={user.status} />
            <span style={{ fontSize: 12, color: user.phoneVerified ? T.success : T.textHint, fontWeight: 600 }}>
              {STATUS_LABELS[user.verified] || user.verified}
            </span>
          </div>
        ))}
        {!filtered.length && <EmptyState>Пользователи не найдены.</EmptyState>}
      </Card>
    </div>
  );
}

const headerGrid = {
  display: "grid",
  gridTemplateColumns: "64px 1fr 1.4fr 120px 110px 140px",
  padding: "10px 18px", fontSize: 11.5, color: T.textHint,
  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`,
};

function rowGrid(index, total) {
  return {
    display: "grid",
    gridTemplateColumns: "64px 1fr 1.4fr 120px 110px 140px",
    padding: "11px 18px", alignItems: "center", cursor: "pointer",
    borderBottom: index < total - 1 ? `1px solid ${T.border}` : "none",
  };
}
