import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Avatar, Badge, Card, EmptyState, Input, Select, StatusBadge } from "../components/ui";
import { ReportUserButton } from "../components/ReportUserButton";
import { ROLE_COLORS, ROLE_LABELS, STATUS_LABELS, T } from "../tokens";

export function UsersList({ onSelect, currentUserId }) {
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
    <div className="page users-list-page" style={{ padding: "32px 36px", flex: 1, overflowY: "auto", minWidth: 0 }}>
      <div className="users-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Пользователи</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{filtered.length} записей</p>
        </div>
      </div>

      <div className="users-filter-row" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
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
        <div className="users-list-header" style={headerGrid}>
          {["№", "Пользователь", "Email", "Роль", "Рейтинг", "Статус", "Верификация", ""].map(h => <div key={h}>{h}</div>)}
        </div>

        {filtered.map((user, i) => (
          <div key={user.id} className="user-row" onClick={() => onSelect(user)} style={rowGrid(i, filtered.length)}>
            <span className="user-cell user-cell-id" style={{ fontSize: 12, color: T.textHint, fontWeight: 700 }}>{user.id}</span>
            <div className="user-cell user-cell-user" style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Avatar initials={user.initials} src={user.avatarUrl} size={28} />
              <span className="user-name" style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{user.name}</span>
            </div>
            <span className="user-cell user-cell-email" style={{ fontSize: 13, color: T.textMuted }}>{user.email || "скрыто"}</span>
            <div className="user-cell user-cell-role"><Badge text={ROLE_LABELS[user.role]} colors={ROLE_COLORS[user.role]} /></div>
            <span className="user-cell user-cell-rating" style={{ fontSize: 13, color: T.warning, fontWeight: 800 }}>
              {user.stats?.rating ? `★ ${Number(user.stats.rating).toFixed(1)}` : "—"}
            </span>
            <div className="user-cell user-cell-status">
              <StatusBadge status={user.status} />
            </div>
            <span className="user-cell user-cell-verified" style={{ fontSize: 12, color: user.phoneVerified ? T.success : T.textHint, fontWeight: 600 }}>
              {STATUS_LABELS[user.verified] || user.verified}
            </span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <ReportUserButton user={user} currentUserId={currentUserId} compact />
            </div>
          </div>
        ))}
        {!filtered.length && <EmptyState>Пользователи не найдены.</EmptyState>}
      </Card>
    </div>
  );
}

const headerGrid = {
  display: "grid",
  gridTemplateColumns: "56px minmax(150px, 1.1fr) minmax(160px, 1.35fr) minmax(126px, 0.75fr) 86px minmax(132px, 0.75fr) minmax(160px, 0.9fr) 90px",
  gap: 10,
  padding: "10px 18px", fontSize: 11.5, color: T.textHint,
  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
  background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`,
};

function rowGrid(index, total) {
  return {
    display: "grid",
    gridTemplateColumns: "56px minmax(150px, 1.1fr) minmax(160px, 1.35fr) minmax(126px, 0.75fr) 86px minmax(132px, 0.75fr) minmax(160px, 0.9fr) 90px",
    gap: 10,
    padding: "11px 18px", alignItems: "center", cursor: "pointer",
    borderBottom: index < total - 1 ? `1px solid ${T.border}` : "none",
  };
}
