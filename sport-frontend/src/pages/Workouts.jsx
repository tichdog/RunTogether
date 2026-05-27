import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Avatar, Btn, Card, EmptyState, Input, Select, StatusBadge } from '../components/ui'
import { ReportUserButton } from '../components/ReportUserButton'
import { T } from '../tokens'

function initialForm(participantLimit = 20) {
  return {
    title: '',
    startAt: '',
    meetingName: '',
    meetingAddress: '',
    routeName: '',
    distanceKm: 5,
    paceMinPerKm: 6,
    difficulty: 'easy',
    participantLimit,
  }
}

export function Workouts({ selectedWorkoutId, onSelectWorkout, onBackToList, currentUserId }) {
  const [workouts, setWorkouts] = useState([])
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [sort, setSort] = useState('time')
  const [showArchive, setShowArchive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(() => initialForm())
  const [defaultParticipantLimit, setDefaultParticipantLimit] = useState(20)
  const [message, setMessage] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('Отменено администратором')
  const [cancelSaving, setCancelSaving] = useState(false)

  const load = useCallback(
    ({ silent = false } = {}) => {
      if (!silent) setMessage('')
      api
        .workouts({ difficulty, sort, includeArchived: showArchive || undefined })
        .then((data) => setWorkouts(data.workouts || []))
        .catch((err) => {
          if (!silent) setMessage(err.message)
        })
    },
    [difficulty, showArchive, sort]
  )

  const loadWorkoutDetail = useCallback(async (id, { silent = false } = {}) => {
    if (!silent) {
      setLoadingDetail(true)
      setMessage('')
    }
    try {
      const [workoutData, requestsData] = await Promise.all([
        api.workout(id),
        api.workoutRequests(id),
      ])
      setSelectedWorkout(workoutData.workout)
      setRequests(requestsData.requests || [])
    } catch (err) {
      setSelectedWorkout(null)
      setRequests([])
      if (!silent) setMessage(err.message)
    } finally {
      if (!silent) setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      load({ silent: true })
      if (selectedWorkoutId) loadWorkoutDetail(selectedWorkoutId, { silent: true })
    }
    const timer = window.setInterval(refresh, 15000)

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load, loadWorkoutDetail, selectedWorkoutId])

  const loadDefaultParticipantLimit = useCallback(async () => {
    try {
      const data = await api.settings()
      const limit = Number(data.settings?.default_participant_limit)
      if (!Number.isFinite(limit)) return
      setDefaultParticipantLimit(limit)
      setForm((prev) => ({ ...prev, participantLimit: limit }))
    } catch {
      // The form can still be used with the local fallback.
    }
  }, [])

  useEffect(() => {
    loadDefaultParticipantLimit()
  }, [loadDefaultParticipantLimit])

  useEffect(() => {
    if (!selectedWorkoutId) {
      setSelectedWorkout(null)
      setRequests([])
      return
    }
    loadWorkoutDetail(selectedWorkoutId)
  }, [loadWorkoutDetail, selectedWorkoutId])

  const filtered = useMemo(
    () =>
      workouts.filter(
        (workout) =>
          workout.title.toLowerCase().includes(search.toLowerCase()) ||
          workout.organizerName?.toLowerCase().includes(search.toLowerCase())
      ),
    [workouts, search]
  )

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const create = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      await api.createWorkout({
        title: form.title,
        startAt: form.startAt,
        meetingPoint: { name: form.meetingName, address: form.meetingAddress },
        route: { name: form.routeName },
        distanceKm: Number(form.distanceKm),
        paceMinPerKm: Number(form.paceMinPerKm),
        difficulty: form.difficulty,
        participantLimit: Number(form.participantLimit),
      })
      setForm(initialForm(defaultParticipantLimit))
      setShowForm(false)
      load()
    } catch (err) {
      setMessage(err.message)
    }
  }

  const join = async (id) => {
    setMessage('')
    try {
      await api.joinWorkout(id)
      setMessage('Заявка отправлена организатору')
      load()
      if (selectedWorkoutId) loadWorkoutDetail(selectedWorkoutId)
    } catch (err) {
      setMessage(err.message)
    }
  }

  const cancel = (id) => {
    const workout =
      selectedWorkout && Number(selectedWorkout.id) === Number(id)
        ? selectedWorkout
        : workouts.find((item) => Number(item.id) === Number(id))
    setCancelTarget(workout || { id })
    setCancelReason('Отменено администратором')
  }

  const closeCancelDialog = () => {
    if (cancelSaving) return
    setCancelTarget(null)
  }

  const confirmCancel = async (event) => {
    event.preventDefault()
    if (!cancelTarget) return
    const reason = cancelReason.trim()
    if (!reason) {
      setMessage('Укажите причину отмены')
      return
    }
    setCancelSaving(true)
    setMessage('')
    try {
      await api.cancelWorkout(cancelTarget.id, reason)
      setCancelTarget(null)
      load()
      if (selectedWorkoutId) loadWorkoutDetail(selectedWorkoutId)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setCancelSaving(false)
    }
  }

  const respondRequest = async (requestId, status) => {
    if (!selectedWorkout) return
    setSaving(true)
    setMessage('')
    try {
      await api.respondRequest(selectedWorkout.id, requestId, status)
      await loadWorkoutDetail(selectedWorkout.id)
      load()
      setMessage(status === 'confirmed' ? 'Заявка подтверждена' : 'Заявка отклонена')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  const removeParticipant = async (participant) => {
    if (!selectedWorkout) return
    if (!window.confirm(`Исключить ${participant.name || 'участника'} из тренировки?`)) return
    setSaving(true)
    setMessage('')
    try {
      await api.cancelParticipation(selectedWorkout.id, participant.id)
      await loadWorkoutDetail(selectedWorkout.id)
      load()
      setMessage('Участник исключен из тренировки')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (selectedWorkoutId) {
    return (
      <>
        <WorkoutDetail
          workout={selectedWorkout}
          requests={requests}
          loading={loadingDetail}
          saving={saving}
          message={message}
          onBack={onBackToList}
          onCancel={cancel}
          onJoin={join}
          onRespond={respondRequest}
          onRemoveParticipant={removeParticipant}
          currentUserId={currentUserId}
        />
        <CancelWorkoutDialog
          workout={cancelTarget}
          reason={cancelReason}
          saving={cancelSaving}
          onReasonChange={setCancelReason}
          onClose={closeCancelDialog}
          onSubmit={confirmCancel}
        />
      </>
    )
  }

  return (
    <div style={{ padding: '32px 36px', flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.text }}>Тренировки</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>
            {filtered.length} записей
          </p>
        </div>
        <Btn
          variant="primary"
          onClick={() => {
            if (!showForm) loadDefaultParticipantLimit()
            setShowForm((value) => !value)
          }}
        >
          {showForm ? 'Скрыть форму' : 'Создать'}
        </Btn>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <form
            onSubmit={create}
            style={{ display: 'grid', gridTemplateColumns: '1.2fr 180px 1fr 1fr', gap: 10 }}
          >
            <Input value={form.title} onChange={set('title')} placeholder="Название" required />
            <Input value={form.startAt} onChange={set('startAt')} type="datetime-local" required />
            <Input
              value={form.meetingName}
              onChange={set('meetingName')}
              placeholder="Точка сбора"
              required
            />
            <Input
              value={form.routeName}
              onChange={set('routeName')}
              placeholder="Маршрут"
              required
            />
            <Input
              value={form.meetingAddress}
              onChange={set('meetingAddress')}
              placeholder="Адрес"
            />
            <Input
              value={form.distanceKm}
              onChange={set('distanceKm')}
              type="number"
              placeholder="Км"
              required
            />
            <Input
              value={form.paceMinPerKm}
              onChange={set('paceMinPerKm')}
              type="number"
              placeholder="Темп"
              required
            />
            <Select value={form.difficulty} onChange={set('difficulty')}>
              <option value="easy">Легкая</option>
              <option value="medium">Средняя</option>
              <option value="hard">Сложная</option>
            </Select>
            <Input
              value={form.participantLimit}
              onChange={set('participantLimit')}
              type="number"
              placeholder="Лимит"
              required
            />
            <Btn type="submit" variant="primary">
              Сохранить
            </Btn>
          </form>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или организатору"
          style={{ flex: 1 }}
        />
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Любая сложность</option>
          <option value="easy">Легкая</option>
          <option value="medium">Средняя</option>
          <option value="hard">Сложная</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="time">По времени</option>
          <option value="distance">По расстоянию</option>
        </Select>
        <Btn
          variant={showArchive ? 'primary' : 'default'}
          onClick={() => setShowArchive((value) => !value)}
          style={{ minWidth: 132 }}
        >
          {showArchive ? 'Скрыть архив' : 'Показать архив'}
        </Btn>
      </div>

      {message && (
        <div
          style={{
            color: message.includes('ошиб') ? T.danger : T.success,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {message}
        </div>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={headerGrid}>
          {['№', 'Организатор', 'Тренировка', 'Дата', 'Места', 'Статус', ''].map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>

        {filtered.map((workout, index) => (
          <div key={workout.id} style={rowGrid(index, filtered.length)}>
            <span style={{ fontSize: 12, color: T.textHint, fontWeight: 700 }}>{workout.id}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{workout.organizerName}</span>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{workout.title}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {workout.distanceKm} км · {workout.paceMinPerKm} мин/км ·{' '}
                {difficultyLabel(workout.difficulty)}
                {workout.archived ? ' · Архив' : ''}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>
                {new Date(workout.startAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {new Date(workout.startAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div style={{ fontSize: 13 }}>
              {workout.confirmedCount} / {workout.participantLimit}
            </div>
            <StatusBadge status={workout.status} participantStatus={workout.participantStatus} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn onClick={() => onSelectWorkout?.(workout.id)}>Подробнее</Btn>
              <Btn
                danger
                onClick={() => cancel(workout.id)}
                disabled={['completed', 'cancelled'].includes(workout.status)}
              >
                Отмена
              </Btn>
            </div>
          </div>
        ))}
        {!filtered.length && <EmptyState>Тренировки не найдены.</EmptyState>}
      </Card>
      <CancelWorkoutDialog
        workout={cancelTarget}
        reason={cancelReason}
        saving={cancelSaving}
        onReasonChange={setCancelReason}
        onClose={closeCancelDialog}
        onSubmit={confirmCancel}
      />
    </div>
  )
}

function WorkoutDetail({
  workout,
  requests,
  loading,
  saving,
  message,
  onBack,
  onCancel,
  onJoin,
  onRespond,
  onRemoveParticipant,
  currentUserId,
}) {
  if (loading) {
    return <div style={{ padding: 32, color: T.textMuted }}>Загрузка тренировки...</div>
  }

  if (!workout) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <Btn onClick={onBack}>Назад к списку</Btn>
        {message && <div style={{ marginTop: 16, color: T.danger }}>{message}</div>}
      </div>
    )
  }

  const participants = workout.participants || []
  const pendingRequests = requests.filter((request) => request.status === 'pending')
  const historicRequests = requests.filter((request) => request.status !== 'pending')

  return (
    <div style={{ padding: '32px 36px', flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <Btn onClick={onBack}>Назад к списку</Btn>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn
            onClick={() => onJoin(workout.id)}
            disabled={!['planned', 'open'].includes(workout.status)}
          >
            Подать заявку
          </Btn>
          <Btn
            danger
            onClick={() => onCancel(workout.id)}
            disabled={['completed', 'cancelled'].includes(workout.status)}
          >
            Отменить тренировку
          </Btn>
        </div>
      </div>

      {message && (
        <div
          style={{
            color: message.includes('ошиб') ? T.danger : T.success,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {message}
        </div>
      )}

      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusLg,
          padding: 24,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 20,
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <StatusBadge status={workout.status} participantStatus={workout.participantStatus} />
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {difficultyLabel(workout.difficulty)}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15 }}>{workout.title}</h1>
            <p style={{ margin: '8px 0 0', color: T.textMuted, maxWidth: 720 }}>
              {workout.description || workout.route?.name || 'Маршрут будет уточнен организатором'}
            </p>
          </div>
          <div style={{ textAlign: 'right', color: T.textMuted, fontSize: 13 }}>
            <strong style={{ display: 'block', color: T.text, fontSize: 16 }}>
              {workout.organizerName}
            </strong>
            Организатор
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
          gap: 18,
        }}
      >
        <div style={{ display: 'grid', gap: 18 }}>
          <Card>
            <h2 style={sectionTitle}>Детали</h2>
            <div style={infoGrid}>
              <Info label="Дата" value={formatDate(workout.startAt)} />
              <Info label="Длительность" value={`${workout.durationMinutes} мин`} />
              <Info label="Дистанция" value={`${workout.distanceKm} км`} />
              <Info label="Темп" value={`${workout.paceMinPerKm} мин/км`} />
              <Info
                label="Места"
                value={`${workout.freePlaces} свободно из ${workout.participantLimit}`}
              />
              <Info
                label="Сбор"
                value={workout.meetingPoint?.address || workout.meetingPoint?.name || 'Не указан'}
              />
              <Info label="Маршрут" value={workout.route?.name || 'Не указан'} />
            </div>
          </Card>

          <Card>
            <h2 style={sectionTitle}>Участники</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              <PersonRow
                user={
                  workout.organizer || {
                    id: workout.organizerId,
                    name: workout.organizerName,
                    initials: initials(workout.organizerName),
                  }
                }
                label="Организатор"
                currentUserId={currentUserId}
              />
              {participants.map((participant) => (
                <PersonRow
                  key={participant.id}
                  user={participant}
                  label="Участник"
                  currentUserId={currentUserId}
                  action={
                    <Btn
                      danger
                      disabled={saving || ['completed', 'cancelled'].includes(workout.status)}
                      onClick={() => onRemoveParticipant(participant)}
                    >
                      Исключить
                    </Btn>
                  }
                />
              ))}
            </div>
            {!participants.length && (
              <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 0 }}>
                Подтвержденных участников пока нет.
              </p>
            )}
          </Card>
        </div>

        <Card>
          <h2 style={sectionTitle}>Заявки</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                saving={saving}
                onRespond={onRespond}
                currentUserId={currentUserId}
              />
            ))}
            {!pendingRequests.length && (
              <p style={{ color: T.textMuted, fontSize: 13, margin: 0 }}>Новых заявок нет.</p>
            )}
          </div>

          {historicRequests.length > 0 && (
            <>
              <h3
                style={{
                  margin: '22px 0 10px',
                  fontSize: 13,
                  color: T.textMuted,
                  textTransform: 'uppercase',
                }}
              >
                История
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {historicRequests.map((request) => (
                  <PersonRow
                    key={request.id}
                    user={{
                      id: request.user_id,
                      name: request.full_name || request.email,
                      initials: initials(request.full_name || request.email),
                    }}
                    label={participantLabel(request.status)}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function CancelWorkoutDialog({ workout, reason, saving, onReasonChange, onClose, onSubmit }) {
  if (!workout) return null

  return (
    <div role="presentation" style={modalOverlay} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-workout-title"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        style={modalCard}
      >
        <div style={modalIcon}>!</div>
        <div>
          <h2 id="cancel-workout-title" style={modalTitle}>
            Отменить тренировку?
          </h2>
          <p style={modalText}>
            {workout.title
              ? `Тренировка «${workout.title}» будет закрыта для заявок и участников.`
              : 'Тренировка будет закрыта для заявок и участников.'}
          </p>
        </div>
        <label style={modalField}>
          <span style={modalLabel}>Причина отмены</span>
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            required
            autoFocus
            placeholder="Например: перенос из-за погоды"
            style={modalTextarea}
          />
        </label>
        <div style={modalActions}>
          <Btn onClick={onClose} disabled={saving}>
            Оставить тренировку
          </Btn>
          <Btn danger type="submit" disabled={saving || !reason.trim()}>
            {saving ? 'Отменяем...' : 'Отменить тренировку'}
          </Btn>
        </div>
      </form>
    </div>
  )
}

function RequestRow({ request, saving, onRespond, currentUserId }) {
  return (
    <PersonRow
      user={{
        id: request.user_id,
        name: request.full_name || request.email,
        initials: initials(request.full_name || request.email),
      }}
      label={request.email}
      currentUserId={currentUserId}
      action={
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn
            variant="primary"
            disabled={saving}
            onClick={() => onRespond(request.id, 'confirmed')}
          >
            Принять
          </Btn>
          <Btn danger disabled={saving} onClick={() => onRespond(request.id, 'declined')}>
            Отклонить
          </Btn>
        </div>
      }
    />
  )
}

function PersonRow({ user, label, action, currentUserId }) {
  const reportAction = user?.id ? (
    <ReportUserButton user={user} currentUserId={currentUserId} compact />
  ) : null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Avatar src={user.avatarUrl} initials={user.initials || initials(user.name)} />
        <div style={{ minWidth: 0 }}>
          <strong
            style={{
              display: 'block',
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.name || 'Участник'}
          </strong>
          <span style={{ display: 'block', color: T.textMuted, fontSize: 12 }}>{label}</span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        {reportAction}
        {action}
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <span style={{ display: 'block', color: T.textMuted, fontSize: 12, marginBottom: 3 }}>
        {label}
      </span>
      <strong style={{ fontSize: 13 }}>{value}</strong>
    </div>
  )
}

function difficultyLabel(value) {
  return { easy: 'легкая', medium: 'средняя', hard: 'сложная' }[value] || value
}

function participantLabel(status) {
  return (
    {
      pending: 'На рассмотрении',
      confirmed: 'Подтвержден',
      declined: 'Отклонена',
      cancelled: 'Отменена',
    }[status] || status
  )
}

function initials(value = 'U') {
  return (
    value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const sectionTitle = {
  margin: '0 0 14px',
  fontSize: 14,
  color: T.text,
  fontWeight: 800,
}

const infoGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 14,
}

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  background: 'rgba(26, 25, 21, 0.48)',
}

const modalCard = {
  width: 'min(520px, 100%)',
  display: 'grid',
  gridTemplateColumns: '44px 1fr',
  gap: '14px 16px',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusLg,
  padding: 22,
  boxShadow: '0 24px 70px rgba(26, 25, 21, 0.24)',
}

const modalIcon = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: T.dangerLight,
  color: T.danger,
  fontWeight: 900,
}

const modalTitle = {
  margin: '0 0 6px',
  color: T.text,
  fontSize: 20,
  lineHeight: 1.2,
}

const modalText = {
  margin: 0,
  color: T.textMuted,
  fontSize: 13,
  lineHeight: 1.5,
}

const modalField = {
  gridColumn: '1 / -1',
  display: 'grid',
  gap: 6,
}

const modalLabel = {
  color: T.textMuted,
  fontSize: 12,
  fontWeight: 800,
}

const modalTextarea = {
  width: '100%',
  minHeight: 110,
  resize: 'vertical',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '10px 12px',
  color: T.text,
  font: 'inherit',
  outline: 'none',
}

const modalActions = {
  gridColumn: '1 / -1',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
}

const headerGrid = {
  display: 'grid',
  gridTemplateColumns: '64px 140px 1fr 130px 90px 130px 210px',
  padding: '10px 18px',
  fontSize: 11.5,
  color: T.textHint,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: T.surfaceAlt,
  borderBottom: `1px solid ${T.border}`,
}

function rowGrid(index, total) {
  return {
    display: 'grid',
    gridTemplateColumns: '64px 140px 1fr 130px 90px 130px 210px',
    padding: '12px 18px',
    alignItems: 'center',
    borderBottom: index < total - 1 ? `1px solid ${T.border}` : 'none',
    gap: 8,
  }
}
