import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Btn, Card, Input } from '../components/ui'
import { T } from '../tokens'

function Toggle({ value, onChange, label, sub }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 42,
          height: 24,
          borderRadius: 999,
          border: 'none',
          background: value ? T.accent : T.border,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: value ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
          }}
        />
      </button>
    </div>
  )
}

export function Settings({ currentUser }) {
  const [settings, setSettings] = useState(null)
  const [message, setMessage] = useState('')
  const isSuperAdmin = currentUser?.role === 'super_admin'

  useEffect(() => {
    api
      .settings()
      .then((data) => setSettings(data.settings))
      .catch((err) => setMessage(err.message))
  }, [])

  const set = (key) => (value) => setSettings((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setMessage('')
    try {
      const data = await api.saveSettings(settings)
      setSettings(data.settings)
      setMessage('Настройки сохранены')
    } catch (err) {
      setMessage(err.message)
    }
  }

  if (!settings) return <div style={{ padding: 32 }}>Загрузка...</div>

  return (
    <div style={{ padding: '32px 36px', flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Настройки</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>
          Конфигурация системы из PostgreSQL
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
        <Card>
          <div style={sectionHeader}>Верификация</div>
          <Toggle
            label="Обязательная верификация для создания тренировок"
            sub="Неверифицированные пользователи не смогут быть организаторами"
            value={Boolean(settings.require_verified_to_create_workouts)}
            onChange={set('require_verified_to_create_workouts')}
          />
          <Toggle
            label="Подтверждение по email"
            value={Boolean(settings.require_email_verification)}
            onChange={set('require_email_verification')}
          />
          <Toggle
            label="Подтверждение по SMS"
            value={Boolean(settings.require_phone_verification)}
            onChange={set('require_phone_verification')}
          />
        </Card>

        <Card>
          <div style={sectionHeader}>Лимиты</div>
          <label style={numberRow}>
            <span>Лимит участников по умолчанию</span>
            <Input
              type="number"
              value={settings.default_participant_limit}
              onChange={(e) => set('default_participant_limit')(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <label style={numberRow}>
            <span>Жалоб до автоблокировки</span>
            <Input
              type="number"
              value={settings.auto_block_complaints_count}
              onChange={(e) => set('auto_block_complaints_count')(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <label style={numberRow}>
            <span>Дней на отзыв после тренировки</span>
            <Input
              type="number"
              value={settings.review_window_days}
              min={1}
              onChange={(e) => set('review_window_days')(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <label style={numberRow}>
            <span>
              Хранить архив тренировок, дней
              {!isSuperAdmin && (
                <small style={{ display: 'block', color: T.textMuted, marginTop: 3 }}>
                  Менять может только супер-админ
                </small>
              )}
            </span>
            <Input
              type="number"
              value={settings.workout_archive_retention_days}
              min={1}
              disabled={!isSuperAdmin}
              onChange={(e) => set('workout_archive_retention_days')(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
        </Card>

        {message && (
          <div style={{ color: message.includes('сохран') ? T.success : T.danger, fontSize: 13 }}>
            {message}
          </div>
        )}
        <Btn variant="primary" onClick={save} style={{ width: 180 }}>
          Сохранить
        </Btn>
      </div>
    </div>
  )
}

const sectionHeader = {
  fontSize: 14,
  fontWeight: 800,
  color: T.text,
  marginBottom: 4,
  paddingBottom: 12,
  borderBottom: `1px solid ${T.border}`,
}

const numberRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 0',
  borderBottom: `1px solid ${T.border}`,
  fontSize: 14,
  fontWeight: 600,
}
