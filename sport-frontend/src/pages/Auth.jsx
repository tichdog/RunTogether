import { useMemo, useState } from "react";
import { api } from "../api/client";
import "../styles/auth.css";

const NAME_RE = /^\p{L}{2,15}$/u;
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u;
const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function passwordRules(password) {
  return [
    { key: "length", label: "Не менее 8 символов", ok: password.length >= 8 },
    { key: "upper", label: "Есть прописная буква", ok: /[A-ZА-ЯЁ]/.test(password) },
    { key: "lower", label: "Есть строчная буква", ok: /[a-zа-яё]/.test(password) },
    { key: "digit", label: "Есть цифра", ok: /\d/.test(password) },
    { key: "symbol", label: "Есть символ", ok: /[^A-Za-zА-Яа-яЁё0-9]/.test(password) },
  ];
}

export function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    login: "admin@sport.local",
    email: "",
    firstName: "",
    lastName: "",
    gender: "male",
    password: "",
    passwordConfirm: "",
    acceptRules: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = useMemo(() => passwordRules(form.password), [form.password]);
  const passwordIsStrong = rules.every(rule => rule.ok);
  const passwordsMatch = form.password.length > 0 && form.password === form.passwordConfirm;

  const fieldErrors = useMemo(() => ({
    firstName: form.firstName && !NAME_RE.test(form.firstName.trim())
      ? "Имя: только буквы, от 2 до 15 символов."
      : "",
    lastName: form.lastName && !LAST_NAME_RE.test(form.lastName.trim())
      ? "Фамилия: буквы от 2 до 15 символов. Двойная фамилия пишется через дефис."
      : "",
    email: form.email && !EMAIL_RE.test(form.email.trim())
      ? "Введите корректный email."
      : "",
  }), [form.firstName, form.lastName, form.email]);

  const registerIsValid =
    NAME_RE.test(form.firstName.trim()) &&
    LAST_NAME_RE.test(form.lastName.trim()) &&
    EMAIL_RE.test(form.email.trim()) &&
    ["male", "female"].includes(form.gender) &&
    passwordIsStrong &&
    passwordsMatch &&
    form.acceptRules;

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (mode === "register" && !registerIsValid) {
      setError("Проверьте поля регистрации и выполните все требования.");
      return;
    }

    setLoading(true);
    try {
      const result = mode === "login"
        ? await api.login({ login: form.login, password: form.password })
        : await api.register({
            email: form.email.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
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

  const set = key => event => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const switchMode = () => {
    setError("");
    setMode(prev => prev === "login" ? "register" : "login");
    setForm(prev => ({
      ...prev,
      password: "",
      passwordConfirm: "",
      acceptRules: false,
    }));
  };

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

        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === "login" ? (
            <label>
              <span>Email или телефон</span>
              <input value={form.login} onChange={set("login")} autoComplete="username" required />
            </label>
          ) : (
            <>
              <div className="auth-grid">
                <label>
                  <span>Имя</span>
                  <input value={form.firstName} onChange={set("firstName")} autoComplete="given-name" required />
                  {fieldErrors.firstName && <small className="field-hint error">{fieldErrors.firstName}</small>}
                </label>
                <label>
                  <span>Фамилия</span>
                  <input value={form.lastName} onChange={set("lastName")} autoComplete="family-name" required />
                  {fieldErrors.lastName && <small className="field-hint error">{fieldErrors.lastName}</small>}
                </label>
              </div>

              <fieldset className="gender-group">
                <legend>Пол</legend>
                <label>
                  <input type="radio" name="gender" value="male" checked={form.gender === "male"} onChange={set("gender")} />
                  Мужской
                </label>
                <label>
                  <input type="radio" name="gender" value="female" checked={form.gender === "female"} onChange={set("gender")} />
                  Женский
                </label>
              </fieldset>

              <label>
                <span>Email</span>
                <input value={form.email} onChange={set("email")} type="email" autoComplete="email" required />
                {fieldErrors.email && <small className="field-hint error">{fieldErrors.email}</small>}
              </label>
            </>
          )}

          <label>
            <span>Пароль</span>
            <input
              value={form.password}
              onChange={set("password")}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {mode === "register" && (
            <>
              <div className="password-checklist" aria-live="polite">
                {rules.map(rule => (
                  <div key={rule.key} className={rule.ok ? "rule ok" : "rule"}>
                    <span />
                    {rule.label}
                  </div>
                ))}
              </div>

              <label>
                <span>Подтверждение пароля</span>
                <input
                  value={form.passwordConfirm}
                  onChange={set("passwordConfirm")}
                  type="password"
                  autoComplete="new-password"
                  required
                />
                {form.passwordConfirm && !passwordsMatch && (
                  <small className="field-hint error">Пароли не совпадают.</small>
                )}
              </label>

              <label className="rules-checkbox">
                <input type="checkbox" checked={form.acceptRules} onChange={set("acceptRules")} />
                <span>Принимаю правила сервиса и согласен на обработку данных</span>
              </label>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading || (mode === "register" && !registerIsValid)}
          >
            {loading ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={switchMode}>
          {mode === "login" ? "Создать аккаунт участника" : "Уже есть аккаунт"}
        </button>
      </section>
    </main>
  );
}
