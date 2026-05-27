import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import '../styles/auth.css'

const NAME_RE = /^\p{L}{2,15}$/u
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u
const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path className="eye-slash" d="M4 4l16 16" />}
    </svg>
  )
}

function passwordRules(password) {
  return [
    { key: 'length', label: 'Не менее 8 символов', ok: password.length >= 8 },
    { key: 'upper', label: 'Есть прописная буква', ok: /[A-ZА-ЯЁ]/.test(password) },
    { key: 'lower', label: 'Есть строчная буква', ok: /[a-zа-яё]/.test(password) },
    { key: 'digit', label: 'Есть цифра', ok: /\d/.test(password) },
    { key: 'symbol', label: 'Есть символ', ok: /[^A-Za-zА-Яа-яЁё0-9]/.test(password) },
  ]
}

export function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    login: '',
    email: '',
    firstName: '',
    lastName: '',
    gender: 'male',
    password: '',
    passwordConfirm: '',
    acceptRules: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailCheck, setEmailCheck] = useState({ status: 'idle', email: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const rules = useMemo(() => passwordRules(form.password), [form.password])
  const passwordIsStrong = rules.every((rule) => rule.ok)
  const passwordsMatch = form.password.length > 0 && form.password === form.passwordConfirm
  const normalizedLogin = form.login.trim().toLowerCase()
  const normalizedEmail = form.email.trim().toLowerCase()
  const loginIsEmailLike = /[A-Za-z@]/.test(normalizedLogin)
  const loginEmailError =
    mode === 'login' && normalizedLogin && loginIsEmailLike && !EMAIL_RE.test(normalizedLogin)
      ? 'Введите корректный email.'
      : ''

  const fieldErrors = useMemo(
    () => ({
      firstName:
        form.firstName && !NAME_RE.test(form.firstName.trim())
          ? 'Имя: только буквы, от 2 до 15 символов.'
          : '',
      lastName:
        form.lastName && !LAST_NAME_RE.test(form.lastName.trim())
          ? 'Фамилия: буквы от 2 до 15 символов. Двойная фамилия пишется через дефис.'
          : '',
      email: form.email && !EMAIL_RE.test(form.email.trim()) ? 'Введите корректный email.' : '',
    }),
    [form.firstName, form.lastName, form.email]
  )

  useEffect(() => {
    if (mode !== 'register' || !normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      setEmailCheck({ status: 'idle', email: '' })
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setEmailCheck({ status: 'checking', email: normalizedEmail })

      try {
        const result = await api.checkEmail(normalizedEmail, { signal: controller.signal })
        setEmailCheck({
          status: result.available ? 'available' : 'taken',
          email: result.email || normalizedEmail,
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          setEmailCheck({ status: 'error', email: normalizedEmail })
        }
      }
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [mode, normalizedEmail])

  const emailIsAvailable = emailCheck.status === 'available' && emailCheck.email === normalizedEmail
  const emailHint =
    fieldErrors.email ||
    (emailCheck.status === 'checking' ? 'Проверяем email...' : '') ||
    (emailCheck.status === 'taken' ? 'Пользователь с такой почтой уже существует.' : '') ||
    (emailCheck.status === 'available' ? 'Email свободен.' : '') ||
    (emailCheck.status === 'error' ? 'Не удалось проверить email. Попробуйте еще раз.' : '')
  const emailHintTone =
    fieldErrors.email || emailCheck.status === 'taken' || emailCheck.status === 'error'
      ? 'error'
      : emailCheck.status === 'available'
        ? 'success'
        : 'pending'

  const registerIsValid =
    NAME_RE.test(form.firstName.trim()) &&
    LAST_NAME_RE.test(form.lastName.trim()) &&
    EMAIL_RE.test(form.email.trim()) &&
    emailIsAvailable &&
    ['male', 'female'].includes(form.gender) &&
    passwordIsStrong &&
    passwordsMatch &&
    form.acceptRules

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    if (mode === 'register' && !registerIsValid) {
      setError('Проверьте поля регистрации и выполните все требования.')
      return
    }
    if (mode === 'login' && loginEmailError) {
      setError(loginEmailError)
      return
    }

    setLoading(true)
    try {
      const result =
        mode === 'login'
          ? await api.login({ login: form.login, password: form.password })
          : await api.register({
              email: form.email.trim(),
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              gender: form.gender,
              password: form.password,
            })
      onAuth(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const preventPasswordCopy = (event) => {
    event.preventDefault()
  }

  const switchMode = () => {
    setError('')
    setMode((prev) => (prev === 'login' ? 'register' : 'login'))
    setForm((prev) => ({
      ...prev,
      password: '',
      passwordConfirm: '',
      acceptRules: false,
    }))
    setShowPassword(false)
    setShowPasswordConfirm(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Авторизация">
        <div className="auth-brand">
          <span className="auth-logo">R</span>
          <div>
            <h1>RunTogether</h1>
            <p>{mode === 'login' ? 'Вход в аккаунт' : 'Регистрация участника'}</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === 'login' ? (
            <label>
              <span>Email или телефон</span>
              <input value={form.login} onChange={set('login')} autoComplete="username" required />
              {loginEmailError && <small className="field-hint error">{loginEmailError}</small>}
            </label>
          ) : (
            <>
              <div className="auth-grid">
                <label>
                  <span>Имя</span>
                  <input
                    value={form.firstName}
                    onChange={set('firstName')}
                    autoComplete="given-name"
                    required
                  />
                  {fieldErrors.firstName && (
                    <small className="field-hint error">{fieldErrors.firstName}</small>
                  )}
                </label>
                <label>
                  <span>Фамилия</span>
                  <input
                    value={form.lastName}
                    onChange={set('lastName')}
                    autoComplete="family-name"
                    required
                  />
                  {fieldErrors.lastName && (
                    <small className="field-hint error">{fieldErrors.lastName}</small>
                  )}
                </label>
              </div>

              <fieldset className="gender-group">
                <legend>Пол</legend>
                <label>
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={form.gender === 'male'}
                    onChange={set('gender')}
                  />
                  Мужской
                </label>
                <label>
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={form.gender === 'female'}
                    onChange={set('gender')}
                  />
                  Женский
                </label>
              </fieldset>

              <label>
                <span>Email</span>
                <input
                  value={form.email}
                  onChange={set('email')}
                  type="email"
                  autoComplete="email"
                  required
                />
                {emailHint && <small className={`field-hint ${emailHintTone}`}>{emailHint}</small>}
              </label>
            </>
          )}

          <label>
            <span>Пароль</span>
            <div className="password-field">
              <input
                value={form.password}
                onChange={set('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onCopy={preventPasswordCopy}
                onCut={preventPasswordCopy}
                onContextMenu={preventPasswordCopy}
                onDragStart={preventPasswordCopy}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <>
              <div className="password-checklist" aria-live="polite">
                {rules.map((rule) => (
                  <div key={rule.key} className={rule.ok ? 'rule ok' : 'rule'}>
                    <span />
                    {rule.label}
                  </div>
                ))}
              </div>

              <label>
                <span>Подтверждение пароля</span>
                <div className="password-field">
                  <input
                    value={form.passwordConfirm}
                    onChange={set('passwordConfirm')}
                    type={showPasswordConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    onCopy={preventPasswordCopy}
                    onCut={preventPasswordCopy}
                    onContextMenu={preventPasswordCopy}
                    onDragStart={preventPasswordCopy}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPasswordConfirm((prev) => !prev)}
                    aria-label={showPasswordConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                    title={showPasswordConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    <EyeIcon visible={showPasswordConfirm} />
                  </button>
                </div>
                {form.passwordConfirm && !passwordsMatch && (
                  <small className="field-hint error">Пароли не совпадают.</small>
                )}
              </label>

              <label className="rules-checkbox">
                <input type="checkbox" checked={form.acceptRules} onChange={set('acceptRules')} />
                <span>Принимаю правила сервиса и согласен на обработку данных</span>
              </label>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={
              loading || Boolean(loginEmailError) || (mode === 'register' && !registerIsValid)
            }
          >
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={switchMode}>
          {mode === 'login' ? 'Создать аккаунт участника' : 'Уже есть аккаунт'}
        </button>
      </section>
    </main>
  )
}
