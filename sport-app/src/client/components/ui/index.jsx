import { T, STATUS_LABELS, STATUS_STYLES } from '../../tokens'

export function Avatar({ color = '#2563EB', initials = 'U', size = 32, src }) {
  if (src) {
    return (
      <img
        alt=""
        src={src}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${color}22`,
        border: `1.5px solid ${color}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color,
        fontSize: size * 0.35,
        fontWeight: 700,
      }}
    >
      {initials}
    </div>
  )
}

export function Badge({ text, colors }) {
  const s = colors || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        borderRadius: T.radiusSm,
        padding: '3px 9px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {text}
    </span>
  )
}

export function StatusBadge({ status, participantStatus }) {
  const isFinished = ['completed', 'archived'].includes(status)
  const visibleStatus = status === 'archived' ? 'completed' : status
  const s = STATUS_STYLES[visibleStatus] || { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' }
  const participantMark = isFinished && participantStatus === 'confirmed' ? ' · вы участвовали' : ''
  return (
    <span
      style={{
        minWidth: 118,
        height: 30,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border || s.dot || T.border}`,
        borderRadius: 999,
        padding: '0 12px',
        fontSize: 12,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }}
      />
      {(STATUS_LABELS[visibleStatus] || visibleStatus) + participantMark}
    </span>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'default',
  danger,
  type = 'button',
  disabled,
  style: extra,
}) {
  const variants = {
    default: {
      background: T.surface,
      color: T.text,
      border: `1px solid ${T.border}`,
      padding: '8px 14px',
    },
    primary: {
      background: T.accent,
      color: '#fff',
      border: `1px solid ${T.accent}`,
      padding: '8px 16px',
    },
    ghost: {
      background: 'transparent',
      color: T.textMuted,
      border: '1px solid transparent',
      padding: '8px 14px',
    },
    danger: {
      background: T.dangerLight,
      color: T.danger,
      border: '1px solid #FECACA',
      padding: '8px 14px',
    },
  }
  const v = danger ? variants.danger : variants[variant] || variants.default
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: T.radiusSm,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'inherit',
        opacity: disabled ? 0.55 : 1,
        ...v,
        ...extra,
      }}
    >
      {children}
    </button>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  style: extra,
  required,
  disabled,
  min,
  max,
  step,
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        padding: '9px 12px',
        fontSize: 13,
        color: T.text,
        outline: 'none',
        fontFamily: 'inherit',
        minWidth: 0,
        opacity: disabled ? 0.55 : 1,
        ...extra,
      }}
    />
  )
}

export function Select({ value, onChange, children, style: extra }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        padding: '9px 12px',
        fontSize: 13,
        color: T.text,
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: 'none',
        ...extra,
      }}
    >
      {children}
    </select>
  )
}

export function Card({ children, style: extra }) {
  return (
    <div
      style={{
        background: T.surface,
        borderRadius: T.radiusLg,
        border: `1px solid ${T.border}`,
        padding: '20px 24px',
        ...extra,
      }}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: T.textHint,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

export function EmptyState({ children }) {
  return (
    <div style={{ padding: 24, color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
      {children}
    </div>
  )
}
