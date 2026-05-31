import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Btn, Card, Input, SectionTitle, Select } from '../components/ui'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { T } from '../tokens'

const CONDITION_LABELS = {
  completed_workouts: 'Завершенные тренировки',
  distance_km: 'Суммарная дистанция',
  morning_workouts: 'Утренние тренировки',
  organized_workouts: 'Организованные тренировки',
}

const CONDITION_UNITS = {
  completed_workouts: 'трен.',
  distance_km: 'км',
  morning_workouts: 'трен.',
  organized_workouts: 'трен.',
}

const ICONS = ['medal', 'trophy', 'route', 'sunrise', 'star', 'zap', 'flame', 'crown']

const EMPTY_FORM = {
  code: '',
  title: '',
  description: '',
  icon: 'medal',
  iconImage: null,
  conditionType: 'completed_workouts',
  conditionValue: 1,
}

export function Achievements() {
  const [achievements, setAchievements] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [iconPreviewUrl, setIconPreviewUrl] = useState('')

  const editing = useMemo(
    () => achievements.find((item) => Number(item.id) === Number(editingId)) || null,
    [achievements, editingId]
  )

  const loadAchievements = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.adminAchievements()
      setAchievements(data.achievements || [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAchievements()
  }, [loadAchievements])

  useEffect(() => {
    if (!form.iconImage) {
      setIconPreviewUrl('')
      return undefined
    }

    const url = URL.createObjectURL(form.iconImage)
    setIconPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [form.iconImage])

  const set = (key) => (event) => {
    const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setIconChoice = (event) => {
    setForm((prev) => ({ ...prev, icon: event.target.value, iconImage: null }))
  }

  const setIconImage = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setForm((prev) => ({ ...prev, icon: '', iconImage: file }))
    }
    event.target.value = ''
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const edit = (achievement) => {
    setEditingId(achievement.id)
    setMessage('')
    setForm({
      code: achievement.code || '',
      title: achievement.title || '',
      description: achievement.description || '',
      icon: achievement.icon || 'medal',
      iconImage: null,
      conditionType: achievement.condition?.type || 'completed_workouts',
      conditionValue: achievement.condition?.value || 1,
    })
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    const payload = {
      code: form.code.trim() || undefined,
      title: form.title,
      description: form.description,
      icon: form.icon,
      iconImage: form.iconImage,
      condition: {
        type: form.conditionType,
        value: Number(form.conditionValue),
      },
    }

    try {
      if (editing) {
        await api.updateAchievement(editing.id, payload)
        setMessage('Достижение обновлено')
      } else {
        await api.createAchievement(payload)
        setMessage('Достижение создано')
      }
      resetForm()
      await loadAchievements()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (achievement) => {
    setSaving(true)
    setMessage('')
    try {
      await api.deleteAchievement(achievement.id)
      if (Number(editingId) === Number(achievement.id)) resetForm()
      setPendingDelete(null)
      await loadAchievements()
      setMessage('Достижение удалено')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '32px 36px', flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Достижения</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>
          Создавайте награды и условия автоматического получения
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <Card>
          <SectionTitle>Список достижений</SectionTitle>
          {loading && <div style={{ color: T.textMuted, fontSize: 13 }}>Загрузка...</div>}
          {!loading &&
            achievements.map((achievement) => (
              <div key={achievement.id} style={achievementRow}>
                <div style={iconBox}>
                  <AchievementIcon icon={achievement.icon} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: T.text, overflowWrap: 'anywhere' }}>
                      {achievement.title}
                    </strong>
                    <code style={codePill}>{achievement.code}</code>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: T.textMuted,
                      fontSize: 13,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {achievement.description}
                  </div>
                  <div style={{ marginTop: 8, color: T.textHint, fontSize: 12, fontWeight: 700 }}>
                    {conditionText(achievement.condition)} · получено:{' '}
                    {achievement.earned_count || 0}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn onClick={() => edit(achievement)} disabled={saving}>
                    Изменить
                  </Btn>
                  <Btn danger onClick={() => setPendingDelete(achievement)} disabled={saving}>
                    Удалить
                  </Btn>
                </div>
              </div>
            ))}
          {!loading && !achievements.length && (
            <div style={{ color: T.textMuted, fontSize: 13 }}>Достижений пока нет.</div>
          )}
        </Card>

        <Card>
          <SectionTitle>{editing ? 'Редактирование' : 'Новое достижение'}</SectionTitle>
          <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
            <label style={fieldStyle}>
              <span>Название</span>
              <Input
                value={form.title}
                onChange={set('title')}
                maxLength={INPUT_LIMITS.achievementTitle}
                required
              />
            </label>
            <label style={fieldStyle}>
              <span>Описание</span>
              <textarea
                value={form.description}
                onChange={set('description')}
                maxLength={INPUT_LIMITS.achievementDescription}
                required
                rows={4}
                style={textareaStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>Значок</span>
              <div style={iconPickerStyle}>
                <div style={iconPreviewBox}>
                  <AchievementIcon icon={iconPreviewUrl || form.icon} />
                </div>
                <Select
                  value={ICONS.includes(form.icon) ? form.icon : ''}
                  onChange={setIconChoice}
                >
                  <option value="" disabled>
                    Картинка
                  </option>
                  {ICONS.map((icon) => (
                    <option value={icon} key={icon}>
                      {icon}
                    </option>
                  ))}
                </Select>
                <label style={uploadButtonStyle}>
                  Загрузить
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={setIconImage}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              {form.iconImage && <small style={fileHintStyle}>{form.iconImage.name}</small>}
            </label>
            <label style={fieldStyle}>
              <span>Условие</span>
              <Select value={form.conditionType} onChange={set('conditionType')}>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label style={fieldStyle}>
              <span>Значение</span>
              <input
                type="number"
                min="1"
                max={INPUT_LIMITS.achievementConditionValue}
                step={form.conditionType === 'distance_km' ? '0.1' : '1'}
                value={form.conditionValue}
                onChange={set('conditionValue')}
                required
                style={inputStyle}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn variant="primary" type="submit" disabled={saving}>
                {editing ? 'Сохранить' : 'Создать'}
              </Btn>
              {editing && (
                <Btn onClick={resetForm} disabled={saving}>
                  Отмена
                </Btn>
              )}
            </div>
          </form>
          {message && (
            <div
              style={{
                marginTop: 12,
                color:
                  message.includes('создан') ||
                  message.includes('обнов') ||
                  message.includes('удал')
                    ? T.success
                    : T.danger,
                fontSize: 13,
              }}
            >
              {message}
            </div>
          )}
        </Card>
      </div>

      {pendingDelete && (
        <div
          style={modalOverlay}
          role="presentation"
          onClick={() => !saving && setPendingDelete(null)}
        >
          <div
            style={modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-achievement-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div style={modalIcon}>!</div>
            <div>
              <h2 id="delete-achievement-title" style={modalTitle}>
                Удалить достижение?
              </h2>
              <p style={modalText}>
                “{pendingDelete.title}” исчезнет из списка и из профилей пользователей, которые уже
                его получили.
              </p>
            </div>
            <div style={modalActions}>
              <Btn onClick={() => setPendingDelete(null)} disabled={saving}>
                Отмена
              </Btn>
              <Btn danger onClick={() => remove(pendingDelete)} disabled={saving}>
                {saving ? 'Удаление...' : 'Удалить'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function conditionText(condition = {}) {
  const label = CONDITION_LABELS[condition.type] || condition.type || 'Условие'
  const unit = CONDITION_UNITS[condition.type] || ''
  return `${label}: ${condition.value || 0} ${unit}`.trim()
}

function isUploadedIcon(icon) {
  return (
    typeof icon === 'string' &&
    (icon.startsWith('/uploads/') ||
      icon.includes('/uploads/') ||
      icon.startsWith('blob:') ||
      icon.startsWith('data:image/'))
  )
}

function AchievementIcon({ icon }) {
  if (isUploadedIcon(icon)) {
    return <img alt="" src={icon} style={iconImageStyle} />
  }

  return <AchievementSymbol name={icon} />
}

function AchievementSymbol({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    style: symbolIconStyle,
  }

  const icons = {
    medal: (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
        <path d="M9 2h6" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
        <path d="M8 5H5a3 3 0 0 0 3 5" />
        <path d="M16 5h3a3 3 0 0 1-3 5" />
        <path d="M12 12v5" />
        <path d="M8 21h8" />
        <path d="M10 17h4" />
      </>
    ),
    route: (
      <>
        <path d="M4 17c5-8 8 4 16-6" />
        <circle cx="4" cy="17" r="2" />
        <circle cx="20" cy="11" r="2" />
      </>
    ),
    sunrise: (
      <>
        <path d="M3 18h18" />
        <path d="M7 18a5 5 0 0 1 10 0" />
        <path d="M12 2v4" />
        <path d="m4.9 7.9 2.8 2.8" />
        <path d="m19.1 7.9-2.8 2.8" />
      </>
    ),
    star: <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 5.9-5.4-2.8-5.4 2.8 1-5.9-4.3-4.2 6-.9z" />,
    zap: <path d="M13 2 4 14h7l-1 8 10-13h-7z" />,
    flame: (
      <>
        <path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-9 0 3-2 5-4 6 0-2-1-4-2-5-2 3-3 5-3 8 0 4 3 7 7 7z" />
        <path d="M12 18c1.7 0 3-1.3 3-3 0-1.2-.7-2.3-2-3.5-.2 1.2-.9 2-1.8 2.7-.2-.8-.6-1.5-1.2-2.2-.7 1.1-1 2-1 3 0 1.7 1.3 3 3 3z" />
      </>
    ),
    crown: (
      <>
        <path d="m3 8 5 4 4-7 4 7 5-4-2 11H5z" />
        <path d="M5 19h14" />
      </>
    ),
  }

  return <svg {...common}>{icons[name] || icons.medal}</svg>
}

const achievementRow = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '14px 0',
  borderBottom: `1px solid ${T.border}`,
}

const iconBox = {
  width: 42,
  height: 42,
  borderRadius: T.radius,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background: T.accentLight,
  color: T.accent,
  border: `1px solid ${T.border}`,
  fontSize: 12,
  fontWeight: 800,
}

const iconImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: T.radiusSm,
}

const symbolIconStyle = {
  width: 22,
  height: 22,
  display: 'block',
}

const iconPickerStyle = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr) max-content',
  alignItems: 'center',
  gap: 8,
}

const iconPreviewBox = {
  ...iconBox,
}

const uploadButtonStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '9px 12px',
  fontSize: 13,
  color: T.text,
  outline: 'none',
  fontFamily: 'inherit',
  minHeight: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const fileHintStyle = {
  color: T.textMuted,
  fontSize: 12,
  overflowWrap: 'anywhere',
}

const codePill = {
  padding: '2px 6px',
  borderRadius: T.radiusSm,
  background: T.surfaceAlt,
  color: T.textMuted,
  fontSize: 12,
}

const fieldStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: T.text,
}

const inputStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '9px 12px',
  fontSize: 13,
  color: T.text,
  outline: 'none',
  fontFamily: 'inherit',
}

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
}

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(26, 25, 21, 0.45)',
}

const modalCard = {
  width: 'min(100%, 420px)',
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr)',
  gap: 14,
  padding: 22,
  borderRadius: T.radiusLg,
  border: `1px solid ${T.border}`,
  background: T.surface,
  boxShadow: '0 24px 70px rgba(26, 25, 21, 0.24)',
}

const modalIcon = {
  width: 44,
  height: 44,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: T.dangerLight,
  color: T.danger,
  fontSize: 20,
  fontWeight: 900,
}

const modalTitle = {
  margin: 0,
  color: T.text,
  fontSize: 20,
  lineHeight: 1.2,
}

const modalText = {
  margin: '8px 0 0',
  color: T.textMuted,
  fontSize: 13,
  lineHeight: 1.5,
}

const modalActions = {
  gridColumn: '1 / -1',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 8,
}
