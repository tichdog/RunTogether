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

const ADMIN_PATH_BY_PAGE = {
  "Обзор": "/admin",
  "Пользователи": "/admin/users",
  "Тренировки": "/admin/workouts",
  "Настройки": "/admin/settings",
};

const ADMIN_PAGE_BY_PATH = Object.fromEntries(
  Object.entries(ADMIN_PATH_BY_PAGE).map(([page, path]) => [path, page]),
);

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function adminUserIdFromPath(pathname) {
  const match = normalizePath(pathname).match(/^\/admin\/users\/(\d+)$/);
  return match?.[1] || null;
}

function adminPageFromPath(pathname) {
  if (adminUserIdFromPath(pathname)) return "Пользователи";
  return ADMIN_PAGE_BY_PATH[normalizePath(pathname)] || "Обзор";
}

function isKnownAdminPath(pathname) {
  const path = normalizePath(pathname);
  return Boolean(ADMIN_PAGE_BY_PATH[path] || adminUserIdFromPath(path));
}

export default function App() {
  const [active, setActive] = useState(() => adminPageFromPath(window.location.pathname));
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(() => adminUserIdFromPath(window.location.pathname));
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const page = adminPageFromPath(window.location.pathname);
      const userId = adminUserIdFromPath(window.location.pathname);
      setActive(page);
      setSelectedUserId(userId);
      if (!userId) setSelectedUser(null);
      if (page !== "Пользователи") {
        setSelectedUser(null);
        setSelectedUserId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!["admin", "super_admin"].includes(user?.role)) return;

    if (!isKnownAdminPath(window.location.pathname)) {
      window.history.replaceState({}, "", ADMIN_PATH_BY_PAGE[active]);
    }
  }, [active, user?.role]);

  useEffect(() => {
    if (!["admin", "super_admin"].includes(user?.role) || active !== "Пользователи" || !selectedUserId) return;

    let ignore = false;
    setSelectedUserLoading(true);

    api.user(selectedUserId)
      .then(data => {
        if (!ignore) setSelectedUser(data.user);
      })
      .catch(() => {
        if (!ignore) {
          setSelectedUser(null);
          setSelectedUserId(null);
          window.history.replaceState({}, "", ADMIN_PATH_BY_PAGE["Пользователи"]);
        }
      })
      .finally(() => {
        if (!ignore) setSelectedUserLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [active, selectedUserId, user?.role]);

  const handleSetActive = (page, { replace = false } = {}) => {
    setActive(page);
    window.history[replace ? "replaceState" : "pushState"]({}, "", ADMIN_PATH_BY_PAGE[page] || "/admin");
    setSelectedUser(null);
    setSelectedUserId(null);
  };

  const openAdminUser = (nextUser) => {
    setActive("Пользователи");
    setSelectedUser(nextUser);
    setSelectedUserId(String(nextUser.id));
    window.history.pushState({}, "", `/admin/users/${nextUser.id}`);
  };

  const openAdminUsersList = () => {
    setSelectedUser(null);
    setSelectedUserId(null);
    window.history.pushState({}, "", ADMIN_PATH_BY_PAGE["Пользователи"]);
  };

  const handleAdminUserChanged = (nextUser) => {
    setSelectedUser(nextUser);
    if (Number(nextUser.id) === Number(user?.id)) {
      setUser(nextUser);
    }
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
    <div className="app-shell" style={{
      display: "flex", height: "100vh", width: "100%",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: T.bg, color: T.text,
      boxSizing: "border-box", overflow: "hidden",
    }}>
      <Sidebar active={active} setActive={handleSetActive} user={user} onLogout={logout} />

      <main className="app-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", background: T.bg }}>
        {active === "Обзор" && <Overview setActive={handleSetActive} setSelectedUser={openAdminUser} />}
        {active === "Пользователи" && selectedUserLoading && !selectedUser && (
          <div style={{ padding: 32, fontFamily: "Inter, Segoe UI, sans-serif" }}>Загрузка пользователя...</div>
        )}
        {active === "Пользователи" && !selectedUser && !selectedUserLoading && <UsersList onSelect={openAdminUser} />}
        {active === "Пользователи" && selectedUser && (
          <UserDetail
            user={selectedUser}
            currentAdmin={user}
            onBack={openAdminUsersList}
            onChanged={handleAdminUserChanged}
            onDeleted={openAdminUsersList}
          />
        )}
        {active === "Тренировки" && <Workouts />}
        {active === "Настройки" && <Settings />}
      </main>
    </div>
  );
}
