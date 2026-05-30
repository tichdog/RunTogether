import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { INPUT_LIMITS } from '@/lib/input-limits'
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  Input,
  Select,
  SectionTitle,
  StatusBadge,
} from '../components/ui'
import { T } from '../tokens'

const REPORT_STATUS = {
  open: { text: 'Открыта', colors: { bg: T.warningLight, text: T.warning, border: '#FDE68A' } },
  warned: {
    text: 'Предупреждение',
    colors: { bg: T.accentLight, text: T.accent, border: '#BFDBFE' },
  },
  banned: { text: 'Бан', colors: { bg: T.dangerLight, text: T.danger, border: '#FECACA' } },
  dismissed: { text: 'Отклонена', colors: { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' } },
  reviewed: { text: 'Проверена', colors: { bg: T.accentLight, text: T.accent, border: '#BFDBFE' } },
}

const DEFAULT_DECISION = {
  action: 'warn',
  banMode: 'temporary',
  banDays: 7,
  moderatorComment: '',
}

export function Reports({ onSelectUser }) {
  const [reports, setReports] = useState([])
  const [view, setView] = useState('open')
  const [filter, setFilter] = useState('')
  const [decisions, setDecisions] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const data = await api.reports({ status: view })
      setReports(data.reports || [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    load()
  }, [load])

  const filteredReports = useMemo(() => {
    if (view === 'open') return reports.filter((report) => report.status === 'open')
    if (!filter) return reports.filter((report) => report.status !== 'open')
    return reports.filter((report) => report.status === filter)
  }, [reports, filter, view])

  const setDecision = (id, patch) => {
    setDecisions((prev) => ({
      ...prev,
      [id]: { ...DEFAULT_DECISION, ...(prev[id] || {}), ...patch },
    }))
  }

  const moderate = async (report) => {
    const decision = { ...DEFAULT_DECISION, ...(decisions[report.id] || {}) }
    setSavingId(report.id)
    setMessage('')
    try {
      const payload = {
        action: decision.action,
        moderatorComment: decision.moderatorComment,
        banMode: decision.banMode,
        banDays: Number(decision.banDays),
      }
      const data = await api.moderateReport(report.id, payload)
      setReports((prev) =>
        prev.map((item) => (Number(item.id) === Number(report.id) ? data.report : item))
      )
      setMessage('Решение сохранено')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ padding: '32px 36px', flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Жалобы</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>
            Открытые жалобы требуют решения, архив хранит все обработанные случаи
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {view === 'archive' && (
            <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">Весь архив</option>
              <option value="warned">С предупреждением</option>
              <option value="banned">С баном</option>
              <option value="dismissed">Отклоненные</option>
            </Select>
          )}
          <Btn onClick={load}>Обновить</Btn>
        </div>
      </div>

      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          padding: 4,
          background: T.surface,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setView('open')
            setFilter('')
          }}
          style={tabStyle(view === 'open')}
        >
          На проверке
        </button>
        <button
          type="button"
          onClick={() => {
            setView('archive')
            setFilter('')
          }}
          style={tabStyle(view === 'archive')}
        >
          Архив
        </button>
      </div>

      {message && (
        <div
          style={{
            color: message.includes('сохранено') ? T.success : T.danger,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}
      {loading && <Card style={{ color: T.textMuted }}>Загрузка жалоб...</Card>}

      {!loading && (
        <div style={{ display: 'grid', gap: 14 }}>
          {filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              decision={{ ...DEFAULT_DECISION, ...(decisions[report.id] || {}) }}
              saving={savingId === report.id}
              onDecision={(patch) => setDecision(report.id, patch)}
              onModerate={() => moderate(report)}
              onSelectUser={onSelectUser}
            />
          ))}
          {!filteredReports.length && (
            <EmptyState>
              {view === 'open' ? 'Открытых жалоб нет.' : 'В архиве пока нет жалоб.'}
            </EmptyState>
          )}
        </div>
      )}
    </div>
  )
}

function ReportCard({ report, decision, saving, onDecision, onModerate, onSelectUser }) {
  const status = REPORT_STATUS[report.status] || REPORT_STATUS.open
  const isOpen = report.status === 'open'

  return (
    <Card style={{ overflow: 'hidden' }}>
      <div
        className="report-card-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: isOpen
            ? 'minmax(0, 1fr) minmax(260px, 300px)'
            : 'minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <Badge text={status.text} colors={status.colors} />
            <span style={{ color: T.textHint, fontSize: 12 }}>
              #{report.id} · {new Date(report.createdAt).toLocaleString()}
            </span>
            {report.resolvedAt && (
              <span style={{ color: T.textHint, fontSize: 12 }}>
                закрыта {new Date(report.resolvedAt).toLocaleString()}
              </span>
            )}
          </div>
          <h2
            style={{ margin: '0 0 8px', color: T.text, fontSize: 18, overflowWrap: 'anywhere' }}
          >
            {report.reason}
          </h2>
          {report.details && (
            <p
              style={{
                margin: '0 0 14px',
                color: T.textMuted,
                fontSize: 13,
                lineHeight: 1.5,
                overflowWrap: 'anywhere',
                whiteSpace: 'pre-wrap',
              }}
            >
              {report.details}
            </p>
          )}
          <div
            className="report-person-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}
          >
            <PersonBlock
              title="Кто пожаловался"
              person={report.reporter}
              onSelectUser={onSelectUser}
            />
            <PersonBlock
              title="На кого жалоба"
              person={report.reportedUser}
              onSelectUser={onSelectUser}
              target
            />
          </div>
          {!isOpen && (
            <div
              style={{
                marginTop: 14,
                color: T.textMuted,
                fontSize: 13,
                overflowWrap: 'anywhere',
              }}
            >
              Решение: {status.text}
              {report.moderator?.name ? ` · ${report.moderator.name}` : ''}
              {report.moderatorComment ? ` · ${report.moderatorComment}` : ''}
              {report.banUntil ? ` · бан до ${new Date(report.banUntil).toLocaleDateString()}` : ''}
            </div>
          )}
        </div>

        {isOpen && (
          <div className="report-decision-panel" style={{ width: '100%', display: 'grid', gap: 10 }}>
            <SectionTitle>Решение</SectionTitle>
            <Select
              value={decision.action}
              onChange={(event) => onDecision({ action: event.target.value })}
              style={{ width: '100%' }}
            >
              <option value="warn">Предупреждение</option>
              <option value="ban">Бан</option>
              <option value="dismiss">Отклонить</option>
            </Select>
            {decision.action === 'ban' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 8 }}>
                <Select
                  value={decision.banMode}
                  onChange={(event) => onDecision({ banMode: event.target.value })}
                >
                  <option value="temporary">На срок</option>
                  <option value="permanent">Навсегда</option>
                </Select>
                <Input
                  type="number"
                  value={decision.banDays}
                  onChange={(event) => onDecision({ banDays: event.target.value })}
                  disabled={decision.banMode === 'permanent'}
                  min={1}
                  max={3650}
                />
              </div>
            )}
            <textarea
              value={decision.moderatorComment}
              onChange={(event) => onDecision({ moderatorComment: event.target.value })}
              placeholder="Комментарий модератора"
              maxLength={INPUT_LIMITS.moderatorComment}
              rows={4}
              style={textareaStyle}
            />
            <Btn variant="primary" onClick={onModerate} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить решение'}
            </Btn>
          </div>
        )}
      </div>
    </Card>
  )
}

function PersonBlock({ title, person, onSelectUser, target }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        padding: 12,
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: T.textHint,
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <button
        onClick={() => onSelectUser?.({ id: person.id, name: person.name })}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          color: T.text,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 800,
          maxWidth: '100%',
          overflowWrap: 'anywhere',
          textAlign: 'left',
        }}
      >
        {person.name || person.email || `ID ${person.id}`}
      </button>
      {target && (
        <div
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}
        >
          <StatusBadge status={person.status} />
          <span style={{ color: T.textMuted, fontSize: 12 }}>
            Предупреждений: {person.warnings || 0}
          </span>
        </div>
      )}
    </div>
  )
}

function tabStyle(active) {
  return {
    border: 'none',
    borderRadius: 6,
    background: active ? T.accent : 'transparent',
    color: active ? '#fff' : T.textMuted,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

const textareaStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '9px 12px',
  color: T.text,
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'vertical',
}
