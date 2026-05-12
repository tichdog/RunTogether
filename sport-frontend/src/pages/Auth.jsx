import { useState } from "react";
import { api } from "../api/client";
import "../styles/auth.css";

export function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    login: "admin@sport.local",
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    gender: "male",
    password: "Admin12345!",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = mode === "login"
        ? await api.login({ login: form.login, password: form.password })
        : await api.register({
            email: form.email,
            phone: form.phone || null,
            firstName: form.firstName,
            lastName: form.lastName,
            gender: form.gender,
            password: form.password,
          });
      onAuth(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Авторизация">
        <div className="auth-brand">
          <span className="auth-logo">R</span>
          <div>
            <h1>RunTogether</h1>
            <p>{mode === "login" ? "Вход в аккаунт" : "Регистрация участника"}</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "login" ? (
            <label>
              <span>Email или телефон</span>
              <input value={form.login} onChange={set("login")} autoComplete="username" required />
            </label>
          ) : (
            <>
              <div className="auth-grid">
                <label>
                  <span>Фамилия</span>
                  <input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" required />
                </label>
                <label>
                  <span>Имя</span>
                  <input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" required />
                </label>
              </div>
              <label>
                <span>Пол</span>
                <select value={form.gender} onChange={set("gender")} required>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="other">Другой</option>
                </select>
              </label>
              <label>
                <span>Почта</span>
                <input value={form.email} onChange={set("email")} type="email" autoComplete="email" required />
              </label>
              <label>
                <span>Телефон</span>
                <input value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="Необязательно" />
              </label>
            </>
          )}

          <label>
            <span>Пароль</span>
            <input value={form.password} onChange={set("password")} type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Создать аккаунт участника" : "Уже есть аккаунт"}
        </button>
      </section>
    </main>
  );
}
