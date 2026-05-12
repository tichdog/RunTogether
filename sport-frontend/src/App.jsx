import { useEffect, useState } from "react";
import { api } from "./api/client";
import { Sidebar } from "./components/layout/Sidebar";
import { Overview } from "./pages/Overview";
import { UsersList } from "./pages/UsersList";
import { UserDetail } from "./pages/UserDetail";
import { Workouts } from "./pages/Workouts";
import { Settings } from "./pages/Settings";
import { Auth } from "./pages/Auth";
import { UserApp } from "./pages/UserApp";
import { T } from "./tokens";

export default function App() {
  const [active, setActive] = useState("Обзор");
  const [selectedUser, setSelectedUser] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  const handleSetActive = (page) => {
    setActive(page);
    if (page !== "Пользователи") setSelectedUser(null);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  if (booting) {
    return <div style={{ padding: 32, fontFamily: "Inter, Segoe UI, sans-serif" }}>Загрузка...</div>;
  }

  if (!user) {
    return <Auth onAuth={setUser} />;
  }

  if (!["admin", "super_admin"].includes(user.role)) {
    return <UserApp user={user} onLogout={logout} />;
  }

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100%",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: T.bg, color: T.text,
      boxSizing: "border-box", overflow: "hidden",
    }}>
      <Sidebar active={active} setActive={handleSetActive} user={user} onLogout={logout} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", background: T.bg }}>
        {active === "Обзор" && <Overview setActive={handleSetActive} setSelectedUser={setSelectedUser} />}
        {active === "Пользователи" && !selectedUser && <UsersList onSelect={setSelectedUser} />}
        {active === "Пользователи" && selectedUser && (
          <UserDetail
            user={selectedUser}
            currentAdmin={user}
            onBack={() => setSelectedUser(null)}
            onChanged={setSelectedUser}
            onDeleted={() => setSelectedUser(null)}
          />
        )}
        {active === "Тренировки" && <Workouts />}
        {active === "Настройки" && <Settings />}
      </main>
    </div>
  );
}
