import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { INPUT_LIMITS } from '@/lib/input-limits'

const DEFAULT_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'
const DUMMY_TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY
const TURNSTILE_LOAD_TIMEOUT_MS = 10000
const NAME_RE = /^\p{L}{2,15}$/u
const LAST_NAME_RE = /^(?=.{2,20}$)\p{L}{2,20}(?:-\p{L}{2,20})?$/u
const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

let turnstileScriptPromise = null

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Turnstile script load timed out'))
      }, TURNSTILE_LOAD_TIMEOUT_MS)
      const finish = (callback) => {
        window.clearTimeout(timeoutId)
        callback()
      }
      const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
      if (existingScript) {
        existingScript.addEventListener('load', () => finish(resolve), { once: true })
        existingScript.addEventListener('error', () => finish(reject), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT_URL
      script.async = true
      script.defer = true
      script.onload = () => finish(resolve)
      script.onerror = () => finish(() => reject(new Error('Turnstile script failed to load')))
      document.head.appendChild(script)
    })
  }

  return turnstileScriptPromise.catch((error) => {
    turnstileScriptPromise = null
    throw error
  })
}

function TurnstileWidget({ siteKey, onVerify, onReset, resetKey }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    const isDummySiteKey = siteKey === DEFAULT_TURNSTILE_SITE_KEY
    onReset()
    setStatus('loading')
    if (isDummySiteKey) {
      setStatus('verified')
      onVerify(DUMMY_TURNSTILE_TOKEN)
    }
    const loadingTimeoutId = isDummySiteKey
      ? null
      : window.setTimeout(() => {
          if (!cancelled) {
            setStatus('error')
            onReset()
          }
        }, TURNSTILE_LOAD_TIMEOUT_MS)

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return

        if (loadingTimeoutId) window.clearTimeout(loadingTimeoutId)
        setStatus('ready')
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'register',
          callback: (token) => {
            setStatus('verified')
            onVerify(token)
          },
          'expired-callback': () => {
            setStatus('expired')
            onReset()
          },
          'error-callback': () => {
            setStatus('error')
            onReset()
          },
        })
      })
      .catch(() => {
        if (loadingTimeoutId) window.clearTimeout(loadingTimeoutId)
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      if (loadingTimeoutId) window.clearTimeout(loadingTimeoutId)
      if (window.turnstile && widgetIdRef.current != null) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [siteKey, onVerify, onReset, resetKey])

  return (
    <div className="turnstile-field">
      <div ref={containerRef} className="turnstile-widget" />
      {status === 'loading' && <small className="field-hint pending">Загрузка проверки...</small>}
      {status === 'expired' && (
        <small className="field-hint error">Проверка истекла. Повторите ее.</small>
      )}
      {status === 'error' && (
        <small className="field-hint error">Не удалось загрузить проверку Turnstile.</small>
      )}
    </div>
  )
}

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
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const handleTurnstileVerify = useCallback((token) => {
    setTurnstileToken(token)
  }, [])

  const resetTurnstileToken = useCallback(() => {
    setTurnstileToken('')
  }, [])

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
          ? 'Фамилия: буквы от 2 до 20 символов. Двойная фамилия пишется через дефис.'
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
    form.acceptRules &&
    Boolean(turnstileToken)

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
              turnstileToken,
            })
      onAuth(result.user)
    } catch (err) {
      setError(err.message)
      if (mode === 'register') {
        setTurnstileToken('')
        setTurnstileResetKey((key) => key + 1)
      }
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
    setTurnstileToken('')
    setTurnstileResetKey((key) => key + 1)
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
              <input
                value={form.login}
                onChange={set('login')}
                autoComplete="username"
                maxLength={INPUT_LIMITS.login}
                required
              />
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
                    maxLength={INPUT_LIMITS.firstName}
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
                    maxLength={INPUT_LIMITS.lastName}
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
                  maxLength={INPUT_LIMITS.email}
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
                maxLength={INPUT_LIMITS.password}
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
                    maxLength={INPUT_LIMITS.password}
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

              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                onVerify={handleTurnstileVerify}
                onReset={resetTurnstileToken}
                resetKey={turnstileResetKey}
              />
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
