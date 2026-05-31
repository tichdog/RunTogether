import { useState } from 'react'
import { api } from '../api/client'
import { Btn, Select } from './ui'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { T } from '../tokens'

const REASONS = [
  'Оскорбления или агрессия',
  'Спам или реклама',
  'Опасное поведение на тренировке',
  'Фейковый профиль',
  'Другое',
]

export function ReportUserButton({
  user,
  currentUserId,
  label = 'Жалоба',
  compact = false,
  buttonStyle,
  onCreated,
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  if (!user?.id || Number(user.id) === Number(currentUserId)) return null

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const result = await api.createReport({
        reportedUserId: user.id,
        reason,
        details,
      })
      setDetails('')
      setMessage('Жалоба отправлена администратору')
      onCreated?.(result.report)
      setTimeout(() => setOpen(false), 700)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Btn
        danger
        onClick={(event) => {
          event?.stopPropagation?.()
          setOpen(true)
        }}
        style={{
          ...(compact ? { padding: '6px 10px', fontSize: 12 } : {}),
          ...(buttonStyle || {}),
        }}
      >
        {label}
      </Btn>
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26, 25, 21, 0.45)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <form
            onSubmit={submit}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(460px, 100%)',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusLg,
              padding: 22,
              boxShadow: '0 24px 70px rgba(26, 25, 21, 0.22)',
            }}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: 20, color: T.text }}>
              Жалоба на пользователя
            </h2>
            <p
              style={{
                margin: '0 0 16px',
                color: T.textMuted,
                fontSize: 13,
                overflowWrap: 'anywhere',
              }}
            >
              {user.name}
            </p>

            <label style={fieldStyle}>
              <span style={labelStyle}>Причина</span>
              <Select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                style={{ width: '100%' }}
              >
                {REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Описание</span>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Что произошло?"
                maxLength={INPUT_LIMITS.reportDetails}
                rows={5}
                style={textareaStyle}
              />
            </label>

            {message && (
              <div
                style={{
                  marginBottom: 12,
                  color: message.includes('отправлена') ? T.success : T.danger,
                  fontSize: 13,
                }}
              >
                {message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setOpen(false)} disabled={saving}>
                Отмена
              </Btn>
              <Btn variant="primary" type="submit" disabled={saving || !reason}>
                {saving ? 'Отправка...' : 'Отправить'}
              </Btn>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

const fieldStyle = {
  display: 'block',
  marginBottom: 14,
}

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  color: T.textMuted,
  fontSize: 12,
  fontWeight: 700,
}

const textareaStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '10px 12px',
  color: T.text,
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'vertical',
}
