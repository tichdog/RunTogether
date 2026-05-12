import { T } from "../../tokens";
import { Btn } from "../ui";

const NAV_ITEMS = [
  { id: "Обзор", icon: "□" },
  { id: "Пользователи", icon: "○" },
  { id: "Тренировки", icon: "◇" },
  { id: "Настройки", icon: "⚙" },
];

export function Sidebar({ active, setActive, user, onLogout }) {
  return (
    <aside style={{
      width: 220, background: T.sidebar, color: T.sidebarText,
      display: "flex", flexDirection: "column", flexShrink: 0,
      height: "100vh",
    }}>
      <div style={{ padding: "20px", borderBottom: "1px solid #2D2C28" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: T.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 800,
          }}>
            R
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>RunTogether</div>
            <div style={{ fontSize: 11, color: T.sidebarMuted, marginTop: 1 }}>Панель проекта</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {NAV_ITEMS.map(({ id, icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px", border: "none",
                borderRadius: T.radiusSm,
                background: isActive ? T.sidebarActive : "transparent",
                color: isActive ? "#FFFFFF" : T.sidebarMuted,
                cursor: "pointer", fontSize: 13, fontWeight: isActive ? 700 : 500,
                textAlign: "left", fontFamily: "inherit", marginBottom: 4,
              }}
            >
              <span style={{ width: 18, textAlign: "center" }}>{icon}</span>
              {id}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "14px 16px", borderTop: "1px solid #2D2C28" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.sidebarText }}>{user?.name}</div>
        <div style={{ fontSize: 11, color: T.sidebarMuted, marginBottom: 10 }}>
          {user?.role === "admin" ? "Администратор" : "Участник"}
        </div>
        <Btn onClick={onLogout} variant="ghost" style={{ width: "100%", color: T.sidebarText, borderColor: "#3B3A36" }}>
          Выйти
        </Btn>
      </div>
    </aside>
  );
}
