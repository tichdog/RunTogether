import { useCallback, useEffect, useMemo, useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import { api } from '../api/client'
import { ReportUserButton } from '../components/ReportUserButton'
import { INPUT_LIMITS } from '@/lib/input-limits'

const EMPTY_FILTERS = {
  query: '',
  difficulty: '',
  sort: 'time',
  view: 'active',
}

const NAME_RE = /^\p{L}{2,15}$/u
const LAST_NAME_RE = /^(?=.{2,20}$)\p{L}{2,20}(?:-\p{L}{2,20})?$/u

const USER_TAB_PATHS = {
  home: '/me',
  workouts: '/workouts',
  organized: '/organized',
  participating: '/participating',
  create: '/workouts/new',
  notifications: '/notifications',
  profile: '/profile',
}

function routeFromPath(pathname) {
  const path = normalizeUserPath(pathname)
  const organizedMatch = path.match(/^\/organized\/(\d+)$/)
  const participatingMatch = path.match(/^\/participating\/(\d+)$/)
  const userMatch = path.match(/^\/users\/(\d+)$/)
  const workoutMatch = path.match(/^\/workouts\/(\d+)(?:\/(edit|requests))?$/)

  if (userMatch) {
    return {
      path,
      activeTab: 'workouts',
      screen: 'userProfile',
      selectedId: userMatch[1],
      mode: 'create',
    }
  }

  if (organizedMatch) {
    return {
      path,
      activeTab: 'organized',
      screen: 'detail',
      selectedId: organizedMatch[1],
      mode: 'create',
    }
  }

  if (participatingMatch) {
    return {
      path,
      activeTab: 'participating',
      screen: 'detail',
      selectedId: participatingMatch[1],
      mode: 'create',
    }
  }

  if (workoutMatch) {
    const [, workoutId, action] = workoutMatch

    if (action === 'edit') {
      return { path, activeTab: 'create', screen: 'create', selectedId: workoutId, mode: 'edit' }
    }

    if (action === 'requests') {
      return {
        path,
        activeTab: 'workouts',
        screen: 'requests',
        selectedId: workoutId,
        mode: 'create',
      }
    }

    return { path, activeTab: 'workouts', screen: 'detail', selectedId: workoutId, mode: 'create' }
  }

  if (path === USER_TAB_PATHS.workouts) {
    return { path, activeTab: 'workouts', screen: 'workouts', selectedId: null, mode: 'create' }
  }

  if (path === USER_TAB_PATHS.organized || path === '/my-workouts') {
    return {
      path: USER_TAB_PATHS.organized,
      activeTab: 'organized',
      screen: 'organized',
      selectedId: null,
      mode: 'create',
    }
  }

  if (path === USER_TAB_PATHS.participating) {
    return {
      path,
      activeTab: 'participating',
      screen: 'participating',
      selectedId: null,
      mode: 'create',
    }
  }

  if (path === USER_TAB_PATHS.create) {
    return { path, activeTab: 'create', screen: 'create', selectedId: null, mode: 'create' }
  }

  if (path === USER_TAB_PATHS.notifications) {
    return {
      path,
      activeTab: 'notifications',
      screen: 'notifications',
      selectedId: null,
      mode: 'create',
    }
  }

  if (path === USER_TAB_PATHS.profile) {
    return { path, activeTab: 'profile', screen: 'profile', selectedId: null, mode: 'create' }
  }

  return {
    path: USER_TAB_PATHS.home,
    activeTab: 'home',
    screen: 'home',
    selectedId: null,
    mode: 'create',
  }
}

function normalizeUserPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/' ? USER_TAB_PATHS.home : path
}

function currentPathname() {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

function defaultWorkoutForm(participantLimit = 10, minLeadHours = 0) {
  const minLeadMs = Math.max(0, Number(minLeadHours) || 0) * 60 * 60 * 1000
  const defaultLeadMs = Math.max(24 * 60 * 60 * 1000, minLeadMs)
  const start = new Date(Date.now() + defaultLeadMs)
  start.setMinutes(0, 0, 0)

  return {
    title: '',
    description: '',
    startAt: toLocalInputValue(start),
    durationMinutes: 60,
    meetingName: '',
    meetingAddress: '',
    routeName: '',
    distanceKm: 5,
    paceMinPerKm: 6,
    difficulty: 'easy',
    participantLimit,
  }
}

export function UserApp({ user, onLogout }) {
  const [currentUser, setCurrentUser] = useState(user)
  const [route, setRoute] = useState(() => routeFromPath(currentPathname()))
  const [workouts, setWorkouts] = useState([])
  const [requests, setRequests] = useState([])
  const [reviewTargets, setReviewTargets] = useState([])
  const [notifications, setNotifications] = useState([])
  const [publicProfile, setPublicProfile] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [form, setForm] = useState(defaultWorkoutForm)
  const [defaultParticipantLimit, setDefaultParticipantLimit] = useState(10)
  const [workoutCreateMinLeadHours, setWorkoutCreateMinLeadHours] = useState(0)
  const [requireVerificationToCreateWorkouts, setRequireVerificationToCreateWorkouts] =
    useState(true)
  const [profile, setProfile] = useState(() => profileFromUser(user))
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notificationsSaving, setNotificationsSaving] = useState(false)
  const [cancelWorkoutDraft, setCancelWorkoutDraft] = useState(null)
  const [message, setMessage] = useState(null)
  const { activeTab, screen: routeScreen, selectedId, mode } = route

  const navigate = useCallback((path, { replace = false } = {}) => {
    const nextRoute = routeFromPath(path)
    setRoute(nextRoute)
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextRoute.path)
  }, [])

  const refreshCurrentUser = useCallback(async ({ syncProfileForm = false } = {}) => {
    const data = await api.me()
    if (!data.user) return null
    setCurrentUser(data.user)
    if (syncProfileForm) {
      setProfile(profileFromUser(data.user))
    }
    return data.user
  }, [])

  const selectedWorkout = useMemo(
    () => workouts.find((workout) => Number(workout.id) === Number(selectedId)) || null,
    [selectedId, workouts]
  )
  const screen =
    routeScreen === 'detail' &&
    selectedWorkout &&
    Number(selectedWorkout.organizerId) === Number(currentUser.id)
      ? 'organizer'
      : routeScreen

  const organizedWorkouts = useMemo(
    () =>
      workouts
        .filter((workout) => Number(workout.organizerId) === Number(currentUser.id))
        .sort(sortWorkoutsNewestFirst),
    [currentUser.id, workouts]
  )

  const participatingWorkouts = useMemo(
    () =>
      workouts
        .filter(
          (workout) =>
            Number(workout.organizerId) !== Number(currentUser.id) &&
            ['pending', 'confirmed'].includes(workout.participantStatus)
        )
        .sort(sortWorkoutsNewestFirst),
    [currentUser.id, workouts]
  )

  const visibleWorkouts = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return workouts.filter((workout) => {
      const matchesQuery =
        !query ||
        [workout.title, workout.organizerName, workout.meetingPoint?.name, workout.route?.name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      const matchesDifficulty = !filters.difficulty || workout.difficulty === filters.difficulty
      return matchesQuery && matchesDifficulty
    })
  }, [filters, workouts])

  const moderationNotifications = useMemo(
    () =>
      notifications.filter((item) => ['moderation_warning', 'moderation_ban'].includes(item.type)),
    [notifications]
  )

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  )

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.notifications()
      setNotifications(data.notifications || [])
    } catch {
      setNotifications([])
    }
  }, [])

  const loadWorkouts = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true)
        setMessage(null)
      }
      try {
        const data = await api.workouts({
          difficulty: filters.difficulty,
          sort: filters.sort,
          archiveOnly: filters.view === 'archive' || undefined,
        })
        setWorkouts(data.workouts || [])
        refreshCurrentUser().catch(() => {})
        loadNotifications()
      } catch (error) {
        if (!silent) setMessage({ type: 'error', text: error.message })
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [filters.difficulty, filters.sort, filters.view, loadNotifications, refreshCurrentUser]
  )

  useEffect(() => {
    loadWorkouts()
  }, [loadWorkouts])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadWorkouts({ silent: true })
      }
    }
    const timer = window.setInterval(refresh, 15000)

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadWorkouts])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (window.location.pathname !== route.path) {
      window.history.replaceState({}, '', route.path)
    }
  }, [route.path])

  useEffect(() => {
    const handlePopState = () => {
      setRoute(routeFromPath(window.location.pathname))
      setMessage(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    setCurrentUser(user)
    setProfile(profileFromUser(user))
  }, [user])

  useEffect(() => {
    if (screen !== 'profile') return
    refreshCurrentUser({ syncProfileForm: true }).catch(() => {})
  }, [refreshCurrentUser, screen])

  useEffect(() => {
    const refreshOnFocus = () => {
      refreshCurrentUser().catch(() => {})
    }
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshOnFocus()
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnVisible)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
  }, [refreshCurrentUser])

  useEffect(() => {
    if (screen !== 'profile') return
    const timer = window.setInterval(() => {
      refreshCurrentUser().catch(() => {})
    }, 30000)

    return () => window.clearInterval(timer)
  }, [refreshCurrentUser, screen])

  useEffect(() => {
    if (screen === 'create' && mode === 'edit' && selectedWorkout) {
      setForm(formFromWorkout(selectedWorkout))
    }
  }, [mode, screen, selectedWorkout])

  useEffect(() => {
    if (screen !== 'create' || mode !== 'create') return

    let ignore = false
    api
      .settings()
      .then((data) => {
        const limit = Number(data.settings?.default_participant_limit)
        const minLeadHours = Number(data.settings?.workout_create_min_lead_hours)
        const safeMinLeadHours = Number.isFinite(minLeadHours) ? Math.max(0, minLeadHours) : 0
        if (ignore) return
        setRequireVerificationToCreateWorkouts(
          Boolean(data.settings?.require_verified_to_create_workouts)
        )
        if (Number.isFinite(safeMinLeadHours)) {
          setWorkoutCreateMinLeadHours(safeMinLeadHours)
        }
        if (Number.isFinite(limit)) {
          setDefaultParticipantLimit(limit)
          setForm(defaultWorkoutForm(limit, safeMinLeadHours))
        }
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [mode, screen])

  useEffect(() => {
    if (
      !selectedId ||
      !['detail', 'requests', 'create'].includes(routeScreen) ||
      selectedWorkout ||
      loading
    )
      return

    let ignore = false
    api
      .workout(selectedId)
      .then((data) => {
        if (ignore || !data.workout) return
        setWorkouts((prev) => {
          const next = prev.filter((workout) => Number(workout.id) !== Number(data.workout.id))
          return [data.workout, ...next]
        })
      })
      .catch((error) => {
        if (!ignore) setMessage({ type: 'error', text: error.message })
      })

    return () => {
      ignore = true
    }
  }, [loading, routeScreen, selectedId, selectedWorkout])

  useEffect(() => {
    if (screen !== 'requests' || !selectedWorkout) return

    let ignore = false
    setSaving(true)
    setMessage(null)

    api
      .workoutRequests(selectedWorkout.id)
      .then((data) => {
        if (!ignore) setRequests(data.requests || [])
      })
      .catch((error) => {
        if (!ignore) setMessage({ type: 'error', text: error.message })
      })
      .finally(() => {
        if (!ignore) setSaving(false)
      })

    return () => {
      ignore = true
    }
  }, [screen, selectedWorkout])

  useEffect(() => {
    if (
      !selectedWorkout ||
      !['detail', 'organizer'].includes(screen) ||
      selectedWorkout.status !== 'completed'
    ) {
      setReviewTargets([])
      return
    }

    let ignore = false
    api
      .reviewTargets(selectedWorkout.id)
      .then((data) => {
        if (!ignore) setReviewTargets(data.reviewTargets || [])
      })
      .catch(() => {
        if (!ignore) setReviewTargets([])
      })

    return () => {
      ignore = true
    }
  }, [screen, selectedWorkout])

  useEffect(() => {
    if (routeScreen !== 'userProfile' || !selectedId) {
      setPublicProfile(null)
      return
    }

    let ignore = false
    setProfileLoading(true)
    setMessage(null)

    api
      .user(selectedId)
      .then((data) => {
        if (!ignore) setPublicProfile(data.user)
      })
      .catch((error) => {
        if (!ignore) {
          setPublicProfile(null)
          setMessage({ type: 'error', text: error.message })
        }
      })
      .finally(() => {
        if (!ignore) setProfileLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [routeScreen, selectedId])

  const openWorkout = (workout) => {
    navigate(`/workouts/${workout.id}`)
  }

  const goTab = (tab) => {
    navigate(USER_TAB_PATHS[tab] || USER_TAB_PATHS.home)
    setMessage(null)
    if (tab === 'create') {
      setForm(defaultWorkoutForm(defaultParticipantLimit, workoutCreateMinLeadHours))
    }
  }

  const saveWorkout = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const payload = workoutPayload(form)
      const result =
        mode === 'edit' && selectedWorkout
          ? await api.updateWorkout(selectedWorkout.id, payload)
          : await api.createWorkout(payload)
      await loadWorkouts()
      setWorkouts((prev) => {
        const next = prev.filter((workout) => Number(workout.id) !== Number(result.workout.id))
        return [result.workout, ...next]
      })
      navigate(`/workouts/${result.workout.id}`)
      setMessage({
        type: 'success',
        text: mode === 'edit' ? 'Тренировка обновлена' : 'Тренировка опубликована',
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const editWorkout = () => {
    if (!selectedWorkout) return
    setForm(formFromWorkout(selectedWorkout))
    navigate(`/workouts/${selectedWorkout.id}/edit`)
  }

  const cancelWorkout = async () => {
    if (!selectedWorkout) return
    setCancelWorkoutDraft({
      workout: selectedWorkout,
      reason: 'Отменено организатором',
    })
  }

  const closeCancelWorkoutDialog = () => {
    if (saving) return
    setCancelWorkoutDraft(null)
  }

  const confirmCancelWorkout = async (event) => {
    event.preventDefault()
    if (!cancelWorkoutDraft?.workout) return
    const reason = cancelWorkoutDraft.reason.trim()
    if (!reason) {
      setMessage({ type: 'error', text: 'Укажите причину отмены' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await api.cancelWorkout(cancelWorkoutDraft.workout.id, reason)
      await loadWorkouts()
      setCancelWorkoutDraft(null)
      setMessage({ type: 'success', text: 'Тренировка отменена' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const joinWorkout = async (workout) => {
    setSaving(true)
    setMessage(null)
    try {
      await api.joinWorkout(workout.id)
      await loadWorkouts()
      setMessage({ type: 'success', text: 'Заявка отправлена организатору' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const leaveWorkout = async (workout) => {
    setSaving(true)
    setMessage(null)
    try {
      await api.cancelParticipation(workout.id)
      await loadWorkouts()
      setMessage({ type: 'success', text: 'Участие отменено' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const openRequests = () => {
    if (!selectedWorkout) return
    navigate(`/workouts/${selectedWorkout.id}/requests`)
  }

  const openUserProfile = (userId) => {
    if (!userId) return
    if (Number(userId) === Number(currentUser.id)) {
      goTab('profile')
      return
    }
    navigate(`/users/${userId}`)
  }

  const markNotificationRead = async (notificationId) => {
    try {
      const data = await api.readNotification(notificationId)
      if (!data.notification) return
      setNotifications((prev) =>
        prev.map((item) => (Number(item.id) === Number(notificationId) ? data.notification : item))
      )
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const markAllNotificationsRead = async () => {
    setNotificationsSaving(true)
    try {
      const data = await api.readAllNotifications()
      setNotifications(data.notifications || [])
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setNotificationsSaving(false)
    }
  }

  const respondToRequest = async (requestId, status) => {
    if (!selectedWorkout) return
    setSaving(true)
    setMessage(null)
    try {
      await api.respondRequest(selectedWorkout.id, requestId, status)
      const data = await api.workoutRequests(selectedWorkout.id)
      setRequests(data.requests || [])
      await loadWorkouts()
      setMessage({
        type: 'success',
        text: status === 'confirmed' ? 'Заявка подтверждена' : 'Заявка отклонена',
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    const firstName = profile.firstName.trim()
    const lastName = profile.lastName.trim()

    if (
      !NAME_RE.test(firstName) ||
      !LAST_NAME_RE.test(lastName) ||
      !['male', 'female'].includes(profile.gender)
    ) {
      setMessage({ type: 'error', text: 'Проверьте имя, фамилию и пол перед сохранением.' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const result = await api.updateMe({
        firstName,
        lastName,
        gender: profile.gender,
        phone: profile.phone,
        privacy: {
          hide_email: profile.hideEmail,
          hide_phone: profile.hidePhone,
        },
      })
      setCurrentUser(result.user)
      setProfile(profileFromUser(result.user))
      setMessage({ type: 'success', text: 'Профиль сохранен' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const saveReview = async (revieweeId, rating, text = '') => {
    if (!selectedWorkout) return

    setSaving(true)
    setMessage(null)
    try {
      await api.createReview(selectedWorkout.id, { revieweeId, rating, text })
      const data = await api.reviewTargets(selectedWorkout.id)
      setReviewTargets(data.reviewTargets || [])
      setMessage({
        type: 'success',
        text: text ? 'Отзыв отправлен организатору' : 'Оценка сохранена',
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const saveAvatar = async (file) => {
    if (!file) return

    setSaving(true)
    setMessage(null)
    try {
      const result = await api.updateMyAvatar(file)
      setCurrentUser(result.user)
      setProfile(profileFromUser(result.user))
      setMessage({ type: 'success', text: 'Аватарка обновлена' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rt-app">
      <aside className="rt-sidebar">
        <div className="rt-brand">
          <span>R</span>
          <strong>RunTogether</strong>
        </div>
        <NavItems active={activeTab} onChange={goTab} unreadCount={unreadNotifications} />
        <div className="rt-sidebar-user">
          <Avatar user={currentUser} />
          <div>
            <strong>{currentUser.name}</strong>
            <span>Участник</span>
          </div>
          <button type="button" onClick={onLogout} aria-label="Выйти">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="rt-main">
        <TopBar
          title={titleFor(screen, activeTab, mode)}
          user={currentUser}
          onProfile={() => goTab('profile')}
        />
        {message && <StatusMessage message={message} />}

        {screen === 'home' && (
          <HomeScreen
            user={currentUser}
            workouts={visibleWorkouts}
            organizedWorkouts={organizedWorkouts}
            participatingWorkouts={participatingWorkouts}
            loading={loading}
            onOpen={openWorkout}
            onCreate={() => goTab('create')}
            onNavigate={goTab}
          />
        )}

        {screen === 'workouts' && (
          <WorkoutsScreen
            workouts={visibleWorkouts}
            userId={currentUser.id}
            filters={filters}
            setFilters={setFilters}
            loading={loading}
            saving={saving}
            onOpen={openWorkout}
            onJoin={joinWorkout}
            onLeave={leaveWorkout}
          />
        )}

        {screen === 'organized' && (
          <OrganizedWorkoutsScreen
            workouts={organizedWorkouts}
            loading={loading}
            onOpen={(workout) => navigate(`/organized/${workout.id}`)}
            onCreate={() => goTab('create')}
          />
        )}

        {screen === 'participating' && (
          <ParticipatingWorkoutsScreen
            workouts={participatingWorkouts}
            filters={filters}
            setFilters={setFilters}
            loading={loading}
            saving={saving}
            onOpen={(workout) => navigate(`/participating/${workout.id}`)}
            onLeave={leaveWorkout}
          />
        )}

        {screen === 'detail' && selectedWorkout && (
          <WorkoutDetail
            workout={selectedWorkout}
            reviewTargets={reviewTargets}
            saving={saving}
            onOpenUser={openUserProfile}
            onJoin={joinWorkout}
            onLeave={leaveWorkout}
            onReview={saveReview}
            currentUserId={currentUser.id}
            onBack={() =>
              navigate(
                activeTab === 'participating'
                  ? USER_TAB_PATHS.participating
                  : USER_TAB_PATHS.workouts
              )
            }
          />
        )}

        {screen === 'create' &&
          mode === 'create' &&
          requireVerificationToCreateWorkouts &&
          !currentUser.phoneVerified && (
            <VerificationRequiredScreen
              phone={currentUser.phone}
              email={currentUser.email}
              onProfile={() => goTab('profile')}
            />
          )}

        {screen === 'create' &&
          (mode === 'edit' ||
            !requireVerificationToCreateWorkouts ||
            currentUser.phoneVerified) && (
          <WorkoutForm
            mode={mode}
            form={form}
            setForm={setForm}
            saving={saving}
            minLeadHours={workoutCreateMinLeadHours}
            onSubmit={saveWorkout}
          />
        )}

        {screen === 'organizer' && selectedWorkout && (
          <OrganizerScreen
            workout={selectedWorkout}
            reviewTargets={reviewTargets}
            saving={saving}
            onOpenUser={openUserProfile}
            onEdit={editWorkout}
            onCancel={cancelWorkout}
            onRequests={openRequests}
            onReview={saveReview}
            currentUserId={currentUser.id}
            onBack={() =>
              navigate(
                activeTab === 'organized' ? USER_TAB_PATHS.organized : USER_TAB_PATHS.workouts
              )
            }
          />
        )}

        {screen === 'requests' && selectedWorkout && (
          <RequestsScreen
            workout={selectedWorkout}
            requests={requests}
            saving={saving}
            onBack={() => navigate(`/workouts/${selectedWorkout.id}`)}
            onRespond={respondToRequest}
            currentUserId={currentUser.id}
          />
        )}

        {screen === 'profile' && (
          <ProfileScreen
            user={currentUser}
            profile={profile}
            setProfile={setProfile}
            moderationNotifications={moderationNotifications}
            saving={saving}
            onSubmit={saveProfile}
            onAvatarChange={saveAvatar}
            onLogout={onLogout}
          />
        )}

        {screen === 'notifications' && (
          <NotificationsScreen
            notifications={notifications}
            readingAll={notificationsSaving}
            onRead={markNotificationRead}
            onReadAll={markAllNotificationsRead}
          />
        )}

        {screen === 'userProfile' && (
          <PublicProfileScreen
            user={publicProfile}
            loading={profileLoading}
            currentUserId={currentUser.id}
            onBack={() => navigate(USER_TAB_PATHS.workouts)}
          />
        )}
      </main>

      <CancelWorkoutDialog
        draft={cancelWorkoutDraft}
        saving={saving}
        onReasonChange={(reason) =>
          setCancelWorkoutDraft((prev) => (prev ? { ...prev, reason } : prev))
        }
        onClose={closeCancelWorkoutDialog}
        onSubmit={confirmCancelWorkout}
      />

      <nav className="rt-bottom-nav" aria-label="Основная навигация">
        <NavItems active={activeTab} onChange={goTab} compact unreadCount={unreadNotifications} />
      </nav>
    </div>
  )
}

function CancelWorkoutDialog({ draft, saving, onReasonChange, onClose, onSubmit }) {
  if (!draft?.workout) return null

  return (
    <div className="rt-modal-overlay" role="presentation" onClick={onClose}>
      <form
        className="rt-cancel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rt-cancel-title"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rt-cancel-dialog-icon">!</div>
        <div>
          <h2 id="rt-cancel-title">Отменить тренировку?</h2>
          <p>
            Тренировка «{draft.workout.title}» будет закрыта для заявок. Участники получат
            уведомление с причиной отмены.
          </p>
        </div>
        <label>
          <span>Причина отмены</span>
          <textarea
            value={draft.reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            required
            autoFocus
            maxLength={INPUT_LIMITS.workoutCancelReason}
            placeholder="Например: перенос из-за погоды"
          />
        </label>
        <div className="rt-cancel-dialog-actions">
          <button className="rt-secondary" type="button" disabled={saving} onClick={onClose}>
            Оставить тренировку
          </button>
          <button className="rt-danger" type="submit" disabled={saving || !draft.reason.trim()}>
            {saving ? 'Отменяем...' : 'Отменить тренировку'}
          </button>
        </div>
      </form>
    </div>
  )
}

function HomeScreen({
  user,
  workouts,
  organizedWorkouts,
  participatingWorkouts,
  loading,
  onOpen,
  onCreate,
  onNavigate,
}) {
  const nextWorkouts = workouts
    .filter(
      (workout) =>
        Number(workout.organizerId) !== Number(user.id) && isJoinableStatus(workout.status)
    )
    .slice(0, 3)
  const nextOrganizerWorkout = organizedWorkouts.find(
    (workout) => !['completed', 'cancelled'].includes(workout.status)
  )
  const pendingParticipations = participatingWorkouts.filter(
    (workout) => workout.participantStatus === 'pending'
  ).length

  return (
    <section className="rt-page">
      <div className="rt-hero">
        <div>
          <span>Сегодня хороший день для пробежки</span>
          <h1>
            {user.firstName || user.name}, подберите тренировку рядом или соберите свою группу
          </h1>
        </div>
        <button className="rt-primary" type="button" onClick={onCreate}>
          <Icon name="plus" />
          Создать тренировку
        </button>
      </div>

      <StatsGrid stats={user.stats} />

      <div className="rt-mobile-quick-actions" aria-label="Быстрые переходы">
        <button type="button" onClick={() => onNavigate('organized')}>
          <Icon name="clipboard" />
          <span>
            <strong>Организую</strong>
            <em>{organizedWorkouts.length} тренировок</em>
          </span>
        </button>
        <button type="button" onClick={() => onNavigate('participating')}>
          <Icon name="check" />
          <span>
            <strong>Участвую</strong>
            <em>
              {pendingParticipations
                ? `${pendingParticipations} на рассмотрении`
                : `${participatingWorkouts.length} заявок`}
            </em>
          </span>
        </button>
      </div>

      <div className="rt-columns">
        <section>
          <SectionHead
            title="Ближайшие тренировки"
            caption={loading ? 'Загружаем...' : `${nextWorkouts.length} доступно`}
          />
          <WorkoutList
            workouts={nextWorkouts}
            onOpen={onOpen}
            empty="Пока нет доступных тренировок"
          />
        </section>

        <section>
          <SectionHead title="Вы организатор" caption={`${organizedWorkouts.length} создано`} />
          {nextOrganizerWorkout ? (
            <WorkoutCard
              workout={nextOrganizerWorkout}
              onOpen={() => onOpen(nextOrganizerWorkout)}
            />
          ) : (
            <EmptyState
              title="Создайте первую тренировку"
              text="Укажите место, маршрут и лимит участников, а заявки будут приходить сюда."
            />
          )}
        </section>
      </div>
    </section>
  )
}

function WorkoutsScreen({
  workouts,
  userId,
  filters,
  setFilters,
  loading,
  saving,
  onOpen,
  onJoin,
  onLeave,
}) {
  return (
    <section className="rt-page">
      <div className="rt-toolbar">
        <label className="rt-search">
          <Icon name="search" />
          <input
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
            maxLength={INPUT_LIMITS.search}
            placeholder="Поиск по названию, месту или организатору"
          />
        </label>
        <select
          value={filters.difficulty}
          onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value }))}
        >
          <option value="">Любая сложность</option>
          <option value="easy">Легкая</option>
          <option value="medium">Средняя</option>
          <option value="hard">Сложная</option>
        </select>
        <select
          value={filters.sort}
          onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}
        >
          <option value="time">По времени</option>
          <option value="distance">По расстоянию</option>
        </select>
        <div className="rt-view-toggle" aria-label="Фильтр архива тренировок">
          <button
            className={filters.view === 'active' ? 'active' : ''}
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, view: 'active' }))}
          >
            Активные
          </button>
          <button
            className={filters.view === 'archive' ? 'active' : ''}
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, view: 'archive' }))}
          >
            Архив
          </button>
        </div>
      </div>

      <SectionHead
        title="Тренировки"
        caption={loading ? 'Загружаем...' : `${workouts.length} найдено`}
      />
      <WorkoutList
        workouts={workouts}
        userId={userId}
        onOpen={onOpen}
        saving={saving}
        onJoin={onJoin}
        onLeave={onLeave}
        empty="Тренировки не найдены"
      />
    </section>
  )
}

function OrganizedWorkoutsScreen({ workouts, loading, onOpen, onCreate }) {
  const activeCount = workouts.filter(
    (workout) => !['completed', 'cancelled'].includes(workout.status)
  ).length

  return (
    <section className="rt-page">
      <div className="rt-page-head">
        <SectionHead
          title="Организую"
          caption={
            loading ? 'Загружаем...' : `${workouts.length} создано · ${activeCount} активных`
          }
        />
        <button className="rt-primary" type="button" onClick={onCreate}>
          <Icon name="plus" />
          Создать тренировку
        </button>
      </div>
      <WorkoutList workouts={workouts} onOpen={onOpen} empty="Вы пока не организовали тренировок" />
    </section>
  )
}

function ParticipatingWorkoutsScreen({
  workouts,
  filters,
  setFilters,
  loading,
  saving,
  onOpen,
  onLeave,
}) {
  const confirmedCount = workouts.filter(
    (workout) => workout.participantStatus === 'confirmed'
  ).length
  const pendingCount = workouts.filter((workout) => workout.participantStatus === 'pending').length
  const isArchive = filters.view === 'archive'

  return (
    <section className="rt-page">
      <div className="rt-page-head">
        <SectionHead
          title="Участвую"
          caption={
            loading
              ? 'Загружаем...'
              : isArchive
                ? `${workouts.length} в архиве`
                : `${confirmedCount} подтверждено · ${pendingCount} на рассмотрении`
          }
        />
        <div className="rt-view-toggle" aria-label="Фильтр архива участий">
          <button
            className={!isArchive ? 'active' : ''}
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, view: 'active' }))}
          >
            Активные
          </button>
          <button
            className={isArchive ? 'active' : ''}
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, view: 'archive' }))}
          >
            Архив
          </button>
        </div>
      </div>
      <WorkoutList
        workouts={workouts}
        onOpen={onOpen}
        saving={saving}
        onLeave={onLeave}
        empty="У вас пока нет заявок на тренировки"
      />
    </section>
  )
}

function WorkoutDetail({
  workout,
  reviewTargets,
  saving,
  onOpenUser,
  onJoin,
  onLeave,
  onReview,
  currentUserId,
  onBack,
}) {
  const canJoin =
    isJoinableStatus(workout.status) &&
    !['pending', 'confirmed'].includes(workout.participantStatus)
  const canLeave =
    !['completed', 'cancelled'].includes(workout.status) &&
    ['pending', 'confirmed'].includes(workout.participantStatus)

  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />
        Ко всем тренировкам
      </button>
      <WorkoutHeader workout={workout} onOpenOrganizer={() => onOpenUser(workout.organizerId)} />
      <div className="rt-detail-grid">
        <div className="rt-side-stack">
          <InfoPanel workout={workout} />
          <ParticipantsPanel
            workout={workout}
            onOpenUser={onOpenUser}
            currentUserId={currentUserId}
          />
        </div>
        <div className="rt-side-stack">
          <div className="rt-panel">
            <SectionHead
              title="Участие"
              caption={participantLabel(workout.participantStatus) || statusLabel(workout.status)}
            />
            <p className="rt-muted">
              Организатор рассмотрит заявку и подтвердит участие. Если планы изменятся, заявку можно
              отменить.
            </p>
            <div className="rt-actions">
              {canJoin && (
                <button
                  className="rt-primary"
                  type="button"
                  disabled={saving}
                  onClick={() => onJoin(workout)}
                >
                  Подать заявку
                </button>
              )}
              {canLeave && (
                <button
                  className="rt-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => onLeave(workout)}
                >
                  Отменить участие
                </button>
              )}
            </div>
          </div>
          {workout.status === 'completed' && (
            <ReviewPanel
              targets={reviewTargets}
              saving={saving}
              onReview={onReview}
              currentUserId={currentUserId}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function OrganizerScreen({
  workout,
  reviewTargets,
  saving,
  onOpenUser,
  onEdit,
  onCancel,
  onRequests,
  onReview,
  currentUserId,
  onBack,
}) {
  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />
        На главную
      </button>
      <WorkoutHeader
        workout={workout}
        organizer
        onOpenOrganizer={() => onOpenUser(workout.organizerId)}
      />
      <div className="rt-detail-grid">
        <div className="rt-side-stack">
          <InfoPanel workout={workout} />
          <ParticipantsPanel
            workout={workout}
            onOpenUser={onOpenUser}
            currentUserId={currentUserId}
          />
        </div>
        <div className="rt-side-stack">
          <div className="rt-panel">
            <SectionHead title="Управление" caption="Заявки и состояние тренировки" />
            <div className="rt-actions vertical">
              <button className="rt-primary" type="button" disabled={saving} onClick={onRequests}>
                <Icon name="users" />
                Заявки участников
              </button>
              <button
                className="rt-secondary"
                type="button"
                disabled={saving || !canEditWorkout(workout)}
                onClick={onEdit}
              >
                <Icon name="edit" />
                Редактировать
              </button>
              <button
                className="rt-danger"
                type="button"
                disabled={
                  saving || workout.status === 'completed' || workout.status === 'cancelled'
                }
                onClick={onCancel}
              >
                Отменить тренировку
              </button>
            </div>
          </div>
          {workout.status === 'completed' && (
            <ReviewPanel
              targets={reviewTargets}
              saving={saving}
              onReview={onReview}
              currentUserId={currentUserId}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function RequestsScreen({ workout, requests, saving, onBack, onRespond, currentUserId }) {
  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />К тренировке
      </button>
      <SectionHead title={`Заявки: ${workout.title}`} caption={`${requests.length} всего`} />
      <div className="rt-request-list">
        {requests.map((request) => (
          <article className="rt-request" key={request.id}>
            <div className="rt-mini-avatar">{initials(request.full_name || request.email)}</div>
            <div>
              <strong>{request.full_name || request.email}</strong>
              <span>{request.email}</span>
              <em>{participantLabel(request.status)}</em>
            </div>
            <div className="rt-request-actions">
              <ReportUserButton
                user={{ id: request.user_id, name: request.full_name || request.email }}
                currentUserId={currentUserId}
                compact
              />
              {request.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onRespond(request.id, 'confirmed')}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onRespond(request.id, 'declined')}
                  >
                    Отклонить
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {!requests.length && (
          <EmptyState
            title="Заявок пока нет"
            text="Когда участники отправят заявки, они появятся здесь."
          />
        )}
      </div>
    </section>
  )
}

function PublicProfileScreen({ user, loading, currentUserId, onBack }) {
  if (loading) {
    return (
      <section className="rt-page">
        <button className="rt-link-button" type="button" onClick={onBack}>
          <Icon name="arrow" />К тренировкам
        </button>
        <div className="rt-panel">Загрузка профиля...</div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="rt-page">
        <button className="rt-link-button" type="button" onClick={onBack}>
          <Icon name="arrow" />К тренировкам
        </button>
        <EmptyState title="Профиль не найден" text="Пользователь удален или недоступен." />
      </section>
    )
  }

  return (
    <section className="rt-page">
      <button className="rt-link-button" type="button" onClick={onBack}>
        <Icon name="arrow" />К тренировкам
      </button>
      <div className="rt-public-profile">
        <Avatar user={user} large />
        <div>
          <span>{roleLabel(user.role)}</span>
          <h1>{user.name}</h1>
          <p>
            {user.email || 'Email скрыт'}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>
          <ReportUserButton user={user} currentUserId={currentUserId} />
        </div>
      </div>
      <StatsGrid stats={user.stats} />
      <AchievementsPanel achievements={user.achievements} />
    </section>
  )
}

function ParticipantsPanel({ workout, onOpenUser, currentUserId }) {
  const organizer = workout.organizer || {
    id: workout.organizerId,
    name: workout.organizerName,
    initials: initials(workout.organizerName),
    stats: {},
  }
  const participants = workout.participants || []
  const participantCount = Number(workout.confirmedCount ?? participants.length)

  return (
    <div className="rt-panel">
      <SectionHead title="Участники" caption={`${participantCount} подтверждено`} />
      <div className="rt-participant-list">
        <UserListItem
          user={organizer}
          label="Организатор"
          onOpen={() => onOpenUser(organizer.id)}
          currentUserId={currentUserId}
        />
        {participants.map((participant) => (
          <UserListItem
            key={participant.id}
            user={participant}
            label="Участник"
            onOpen={() => onOpenUser(participant.id)}
            currentUserId={currentUserId}
          />
        ))}
      </div>
      {!workout.participantsHidden && !participants.length && (
        <p className="rt-muted">Подтвержденных участников пока нет.</p>
      )}
    </div>
  )
}

function UserListItem({ user, label, onOpen, currentUserId }) {
  return (
    <div
      className="rt-user-list-item"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen()
      }}
      style={{ gridTemplateColumns: '38px minmax(0, 1fr) auto 22px' }}
    >
      <Avatar user={user} />
      <span>
        <strong>{user.name}</strong>
        <em>
          {label} · рейтинг {formatRating(user.stats?.rating)}
        </em>
      </span>
      <ReportUserButton user={user} currentUserId={currentUserId} compact />
      <Icon name="arrowRight" />
    </div>
  )
}

function ReviewPanel({ targets = [], saving, onReview, currentUserId }) {
  const ratedCount = targets.filter((target) => target.review).length
  const hasPendingReviews = targets.some((target) => !target.review)
  const canReview = targets.some((target) => target.canReview && !target.review)
  const expiresAt = targets.find((target) => target.reviewExpiresAt)?.reviewExpiresAt

  return (
    <div className="rt-panel">
      <SectionHead
        title="Отзывы"
        caption={targets.length ? `${ratedCount}/${targets.length} оставлено` : 'после тренировки'}
      />
      {!targets.length ? (
        <p className="rt-muted">
          Оставить отзыв можно только по завершенной тренировке, где вы были организатором или
          подтвержденным участником.
        </p>
      ) : (
        <>
          {hasPendingReviews && !canReview && (
            <p className="rt-muted">
              {expiresAt
                ? `Срок для новых отзывов истек ${new Date(expiresAt).toLocaleDateString()}.`
                : 'Срок для новых отзывов истек.'}
            </p>
          )}
          <div className="rt-review-list">
            {targets.map((target) => (
              <ReviewTargetV2
                key={target.user.id}
                target={target}
                saving={saving}
                currentUserId={currentUserId}
                onReview={(rating, text) => onReview(target.user.id, rating, text)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewTargetV2({ target, saving, onReview, currentUserId }) {
  const user = target.user
  const canReview = Boolean(target.canReview)

  return (
    <article
      className={`rt-review-target ${target.isOrganizer && !target.review ? 'has-form' : ''}`}
    >
      <Avatar user={user} />
      <div>
        <strong>{user.name}</strong>
        <span>
          {target.isOrganizer ? 'Организатор' : 'Участник'} · рейтинг{' '}
          {formatRating(user.stats?.rating)}
        </span>
      </div>
      <ReportUserButton user={user} currentUserId={currentUserId} compact />
      {target.review ? (
        <div className="rt-review-result">
          <span className="rt-review-done">{stars(target.review.rating)}</span>
          {target.review.text && <p>{target.review.text}</p>}
        </div>
      ) : target.isOrganizer ? (
        <OrganizerReviewForm disabled={saving || !canReview} onReview={onReview} />
      ) : (
        <RatingPicker disabled={saving || !canReview} onChange={onReview} />
      )}
    </article>
  )
}

function OrganizerReviewForm({ disabled, onReview }) {
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const trimmed = text.trim()

  return (
    <div className="rt-review-form">
      <RatingPicker disabled={disabled} value={rating} onChange={setRating} />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={INPUT_LIMITS.reviewText}
        placeholder="Что было хорошо, что можно улучшить"
        disabled={disabled}
      />
      <button
        className="rt-primary"
        type="button"
        disabled={disabled || !trimmed}
        onClick={() => onReview(rating, trimmed)}
      >
        Отправить отзыв
      </button>
    </div>
  )
}

function RatingPicker({ disabled, onChange, value = 0 }) {
  return (
    <div className="rt-stars" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((ratingValue) => (
        <button
          key={ratingValue}
          type="button"
          disabled={disabled}
          onClick={() => onChange(ratingValue)}
          className={Number(value) > 0 && ratingValue <= Number(value) ? 'active' : ''}
          aria-label={`${ratingValue} из 5`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function VerificationRequiredScreen({ phone, email, onProfile }) {
  const missingPhone = !phone
  const contactHint = missingPhone
    ? 'Добавьте и подтвердите телефон в профиле, чтобы получить доступ к созданию тренировок.'
    : 'Подтвердите телефон в профиле, чтобы получить доступ к созданию тренировок.'

  return (
    <section className="rt-page">
      <div className="rt-panel rt-verification-gate">
        <span className="rt-verification-icon">
          <Icon name="shield" />
        </span>
        <div>
          <h2>Пройдите верификацию</h2>
          <p>
            Создание тренировок доступно только пользователям с подтвержденным телефоном. Форма
            появится сразу после подтверждения.
          </p>
          <p>{contactHint}</p>
          {(email || phone) && (
            <div className="rt-verification-contacts">
              {email && <span>{email}</span>}
              {phone && <span>{phone}</span>}
            </div>
          )}
        </div>
        <button className="rt-primary" type="button" onClick={onProfile}>
          <Icon name="user" />
          Открыть профиль
        </button>
      </div>
    </section>
  )
}

function WorkoutForm({ mode, form, setForm, saving, minLeadHours = 0, onSubmit }) {
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const now = new Date()
  const minStartAt = toLocalInputValue(new Date(now.getTime() + minLeadHours * 60 * 60 * 1000))

  return (
    <section className="rt-page">
      <form className="rt-form rt-panel" onSubmit={onSubmit}>
        <label className="wide">
          <span>Название</span>
          <input
            value={form.title}
            onChange={set('title')}
            maxLength={INPUT_LIMITS.workoutTitle}
            required
          />
        </label>
        <label>
          <span>Дата и время</span>
          <input
            value={form.startAt}
            onChange={set('startAt')}
            type="datetime-local"
            min={minStartAt}
            required
          />
        </label>
        <label>
          <span>Длительность, мин</span>
          <input
            value={form.durationMinutes}
            onChange={set('durationMinutes')}
            type="number"
            min="15"
            max="1440"
            step="5"
            required
          />
        </label>
        <label>
          <span>Сложность</span>
          <select value={form.difficulty} onChange={set('difficulty')} required>
            <option value="easy">Легкая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
        </label>
        <label>
          <span>Точка сбора</span>
          <input
            value={form.meetingName}
            onChange={set('meetingName')}
            maxLength={INPUT_LIMITS.workoutMeetingName}
            required
          />
        </label>
        <label>
          <span>Адрес</span>
          <input
            value={form.meetingAddress}
            onChange={set('meetingAddress')}
            maxLength={INPUT_LIMITS.workoutMeetingAddress}
          />
        </label>
        <label>
          <span>Маршрут</span>
          <input
            value={form.routeName}
            onChange={set('routeName')}
            maxLength={INPUT_LIMITS.workoutRouteName}
            required
          />
        </label>
        <label>
          <span>Дистанция, км</span>
          <input
            value={form.distanceKm}
            onChange={set('distanceKm')}
            type="number"
            min="0.1"
            max="99999.99"
            step="0.01"
            required
          />
        </label>
        <label>
          <span>Темп, мин/км</span>
          <input
            value={form.paceMinPerKm}
            onChange={set('paceMinPerKm')}
            type="number"
            min="0.1"
            max="99.99"
            step="0.01"
            required
          />
        </label>
        <label>
          <span>Лимит участников</span>
          <input
            value={form.participantLimit}
            onChange={set('participantLimit')}
            type="number"
            min="1"
            max="200"
            required
          />
        </label>
        <label className="wide">
          <span>Комментарий</span>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={4}
            maxLength={INPUT_LIMITS.workoutDescription}
          />
        </label>
        <div className="rt-form-actions wide">
          <button className="rt-primary" type="submit" disabled={saving}>
            {mode === 'edit' ? 'Сохранить изменения' : 'Опубликовать тренировку'}
          </button>
        </div>
      </form>
    </section>
  )
}

function ProfileScreen({
  user,
  profile,
  setProfile,
  moderationNotifications,
  saving,
  onSubmit,
  onAvatarChange,
  onLogout,
}) {
  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setProfile((prev) => ({ ...prev, [key]: value }))
  }
  const uploadAvatar = (event) => {
    const [file] = event.target.files || []
    onAvatarChange?.(file)
    event.target.value = ''
  }
  const firstNameError =
    profile.firstName && !NAME_RE.test(profile.firstName.trim())
      ? 'Имя: только буквы, от 2 до 15 символов.'
      : ''
  const lastNameError =
    profile.lastName && !LAST_NAME_RE.test(profile.lastName.trim())
      ? 'Фамилия: буквы от 2 до 20 символов. Двойная фамилия пишется через дефис.'
      : ''
  const phoneError =
    profile.phone && !isValidPhoneNumber(profile.phone)
      ? 'Укажите корректный номер с кодом страны.'
      : ''
  const profileIsValid =
    NAME_RE.test(profile.firstName.trim()) &&
    LAST_NAME_RE.test(profile.lastName.trim()) &&
    ['male', 'female'].includes(profile.gender) &&
    !phoneError

  return (
    <section className="rt-page rt-profile-page">
      <div className="rt-profile-head">
        <div className="rt-profile-avatar-wrap">
          <Avatar user={user} large />
        </div>
        <div className="rt-profile-main">
          <h1>{user.name}</h1>
          <span className="rt-profile-email">{user.email || 'Email скрыт'}</span>
          <label className="rt-avatar-upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={uploadAvatar}
              disabled={saving}
            />
            <span>
              <Icon name="camera" />
              {saving ? 'Загрузка...' : 'Загрузить фото'}
            </span>
          </label>
        </div>
      </div>
      <StatsGrid stats={user.stats} />
      <AchievementsPanel achievements={user.achievements} />
      <ModerationNoticeList user={user} notifications={moderationNotifications} />
      <form className="rt-form rt-panel" onSubmit={onSubmit}>
        <label>
          <span>Имя</span>
          <input
            value={profile.firstName}
            onChange={set('firstName')}
            autoComplete="given-name"
            maxLength={INPUT_LIMITS.firstName}
            required
          />
          <small className={`rt-field-hint ${firstNameError ? 'error' : 'empty'}`}>
            {firstNameError || ' '}
          </small>
        </label>
        <label>
          <span>Фамилия</span>
          <input
            value={profile.lastName}
            onChange={set('lastName')}
            autoComplete="family-name"
            maxLength={INPUT_LIMITS.lastName}
            required
          />
          <small className={`rt-field-hint ${lastNameError ? 'error' : 'empty'}`}>
            {lastNameError || ' '}
          </small>
        </label>
        <label>
          <span>Пол</span>
          <select value={profile.gender || 'male'} onChange={set('gender')}>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </label>
        <label>
          <span>Телефон</span>
          <PhoneInput
            className="rt-phone-input"
            value={profile.phone || undefined}
            onChange={(value) => setProfile((prev) => ({ ...prev, phone: value || '' }))}
            defaultCountry="RU"
            international
            countryCallingCodeEditable={false}
            placeholder="+7 999 000-11-22"
            limitMaxLength
            maxLength={INPUT_LIMITS.phone}
          />
          <small className={`rt-field-hint ${phoneError ? 'error' : 'empty'}`}>
            {phoneError || ' '}
          </small>
        </label>
        <label className="rt-checkbox wide">
          <input type="checkbox" checked={profile.hideEmail} onChange={set('hideEmail')} />
          <span>Скрывать email в публичном профиле</span>
        </label>
        <label className="rt-checkbox wide">
          <input type="checkbox" checked={profile.hidePhone} onChange={set('hidePhone')} />
          <span>Скрывать телефон в публичном профиле</span>
        </label>
        <div className="rt-form-actions wide">
          <button className="rt-primary" type="submit" disabled={saving || !profileIsValid}>
            Сохранить профиль
          </button>
          <button className="rt-secondary" type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </form>
    </section>
  )
}

function ModerationNoticeList({ user, notifications = [] }) {
  const warnings = Number(user.moderation?.warnings || 0)
  if (!notifications.length && !warnings) return null
  return (
    <div className="rt-panel rt-moderation-panel">
      <SectionHead
        title="Модерация"
        caption={warnings ? `предупреждений: ${warnings}` : 'важные сообщения от администратора'}
      />
      <div className="rt-notification-list">
        {notifications.length ? (
          notifications
            .slice(0, 3)
            .map((notification) => (
              <NotificationItem key={notification.id} notification={notification} compact />
            ))
        ) : (
          <article className="rt-notification moderation">
            <div>
              <strong>Есть предупреждения от модерации</strong>
              <p>Подробности новых предупреждений будут появляться в уведомлениях.</p>
            </div>
          </article>
        )}
      </div>
    </div>
  )
}

function NotificationsScreen({ notifications, readingAll, onRead, onReadAll }) {
  const [filter, setFilter] = useState('all')
  const unreadCount = notifications.filter((item) => !item.read_at).length
  const filters = notificationFilters(notifications)
  const visibleNotifications =
    filter === 'all'
      ? notifications
      : notifications.filter((notification) => notificationGroupId(notification.type) === filter)
  const groupedNotifications = groupNotificationsByDay(visibleNotifications)

  return (
    <section className="rt-page">
      <div className="rt-notification-head">
        <SectionHead
          title="Уведомления"
          caption={`${unreadCount} новых · ${notifications.length} всего`}
        />
        <button
          className="rt-secondary"
          type="button"
          disabled={!unreadCount || readingAll}
          onClick={onReadAll}
        >
          {readingAll ? 'Обновляем...' : 'Прочитать все'}
        </button>
      </div>

      {!!notifications.length && (
        <div className="rt-notification-filters" aria-label="Фильтр уведомлений">
          {filters.map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? 'active' : ''}
              type="button"
              onClick={() => setFilter(item.id)}
            >
              <span>{item.label}</span>
              <em>{item.count}</em>
            </button>
          ))}
        </div>
      )}

      <div className="rt-notification-groups">
        {groupedNotifications.map((group) => (
          <section className="rt-notification-group" key={group.key}>
            <h2>{group.label}</h2>
            <div className="rt-notification-list">
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => onRead(notification.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!notifications.length && (
        <EmptyState
          title="Уведомлений пока нет"
          text="Предупреждения и решения администрации появятся здесь."
        />
      )}
      {!!notifications.length && !visibleNotifications.length && (
        <EmptyState title="В этой группе пусто" text="Попробуйте другой фильтр уведомлений." />
      )}
    </section>
  )
}

function NotificationItem({ notification, compact = false, onRead }) {
  const isModeration = ['moderation_warning', 'moderation_ban'].includes(notification.type)
  const meta = notificationTypeMeta(notification.type)
  return (
    <article
      className={`rt-notification ${notification.read_at ? '' : 'unread'} ${isModeration ? 'moderation' : ''}`}
    >
      <div>
        {!compact && <span className={`rt-notification-kind ${meta.group}`}>{meta.label}</span>}
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
        {!compact && <span>{new Date(notification.created_at).toLocaleString()}</span>}
      </div>
      {!notification.read_at && onRead && (
        <button type="button" onClick={onRead}>
          Прочитано
        </button>
      )}
    </article>
  )
}

function notificationTypeMeta(type) {
  const meta = {
    participation_request: { group: 'requests', label: 'Заявка' },
    participation_response: { group: 'requests', label: 'Заявка' },
    participation_removed: { group: 'requests', label: 'Участие' },
    workout_review: { group: 'reviews', label: 'Отзыв' },
    workout_created: { group: 'workouts', label: 'Тренировка' },
    workout_changed: { group: 'workouts', label: 'Изменение' },
    workout_cancelled: { group: 'workouts', label: 'Отмена' },
    workout_reminder: { group: 'workouts', label: 'Напоминание' },
    moderation_warning: { group: 'moderation', label: 'Модерация' },
    moderation_ban: { group: 'moderation', label: 'Модерация' },
    achievement: { group: 'system', label: 'Достижение' },
  }

  return meta[type] || { group: 'system', label: 'Система' }
}

function notificationGroupId(type) {
  return notificationTypeMeta(type).group
}

function notificationFilters(notifications) {
  const labels = {
    all: 'Все',
    requests: 'Заявки',
    reviews: 'Отзывы',
    workouts: 'Тренировки',
    moderation: 'Модерация',
    system: 'Система',
  }
  const counts = notifications.reduce(
    (acc, notification) => {
      const group = notificationGroupId(notification.type)
      acc.all += 1
      acc[group] = (acc[group] || 0) + 1
      return acc
    },
    { all: 0 }
  )

  return ['all', 'requests', 'reviews', 'workouts', 'moderation', 'system']
    .filter((id) => id === 'all' || counts[id])
    .map((id) => ({ id, label: labels[id], count: counts[id] || 0 }))
}

function groupNotificationsByDay(notifications) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const groups = new Map()

  for (const notification of notifications) {
    const date = new Date(notification.created_at)
    const key = date.toDateString()
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: notificationDayLabel(date, today, yesterday),
        items: [],
      })
    }
    groups.get(key).items.push(notification)
  }

  return [...groups.values()]
}

function notificationDayLabel(date, today, yesterday) {
  if (date.toDateString() === today.toDateString()) return 'Сегодня'
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера'
  return date.toLocaleDateString()
}

function WorkoutList({ workouts, userId, onOpen, saving, onJoin, onLeave, empty }) {
  if (!workouts.length) {
    return (
      <EmptyState
        title={empty}
        text="Попробуйте изменить фильтры или создать тренировку самостоятельно."
      />
    )
  }

  return (
    <div className="rt-workout-list">
      {workouts.map((workout) => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          userId={userId}
          saving={saving}
          onOpen={() => onOpen(workout)}
          onJoin={onJoin ? () => onJoin(workout) : null}
          onLeave={onLeave ? () => onLeave(workout) : null}
        />
      ))}
    </div>
  )
}

function WorkoutCard({ workout, userId, saving, onOpen, onJoin, onLeave }) {
  const isOrganizer = userId && Number(workout.organizerId) === Number(userId)
  const canJoin =
    onJoin &&
    !isOrganizer &&
    isJoinableStatus(workout.status) &&
    !['pending', 'confirmed'].includes(workout.participantStatus)
  const canLeave =
    onLeave &&
    !['completed', 'cancelled'].includes(workout.status) &&
    ['pending', 'confirmed'].includes(workout.participantStatus)

  return (
    <article className="rt-workout-card">
      <button className="rt-card-main" type="button" onClick={onOpen}>
        <div>
          <span className="rt-pill">{difficultyLabel(workout.difficulty)}</span>
          <h2>{workout.title}</h2>
          <p>{workout.meetingPoint?.name || workout.route?.name || 'Маршрут'}</p>
        </div>
        <StatusBadge status={workout.status} participantStatus={workout.participantStatus} />
      </button>
      <div className="rt-card-meta">
        <Meta icon="clock" value={formatDate(workout.startAt)} />
        <Meta icon="route" value={`${workout.distanceKm} км`} />
        <Meta icon="bolt" value={`${workout.paceMinPerKm} мин/км`} />
        <Meta icon="users" value={`${workout.confirmedCount}/${workout.participantLimit}`} />
      </div>
      <div className="rt-card-footer">
        <span>{workout.organizerName}</span>
        <div>
          {canJoin && (
            <button type="button" disabled={saving} onClick={onJoin}>
              Заявка
            </button>
          )}
          {canLeave && (
            <button type="button" disabled={saving} onClick={onLeave}>
              Отменить
            </button>
          )}
          <button type="button" onClick={onOpen}>
            Подробнее
          </button>
        </div>
      </div>
    </article>
  )
}

function WorkoutHeader({ workout, organizer, onOpenOrganizer }) {
  return (
    <div className="rt-workout-header">
      <div>
        <button className="rt-header-person" type="button" onClick={onOpenOrganizer}>
          {organizer ? 'Вы организатор' : workout.organizerName}
        </button>
        <h1>{workout.title}</h1>
        <p>{workout.description || workout.route?.name || 'Маршрут будет уточнен организатором'}</p>
      </div>
      <StatusBadge status={workout.status} participantStatus={workout.participantStatus} />
    </div>
  )
}

function InfoPanel({ workout }) {
  return (
    <div className="rt-panel">
      <SectionHead title="Детали" caption={workout.meetingPoint?.name} />
      <div className="rt-info-grid">
        <Info label="Дата" value={formatDate(workout.startAt)} />
        <Info label="Длительность" value={`${workout.durationMinutes} мин`} />
        <Info label="Дистанция" value={`${workout.distanceKm} км`} />
        <Info label="Темп" value={`${workout.paceMinPerKm} мин/км`} />
        <Info label="Сложность" value={difficultyLabel(workout.difficulty)} />
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
    </div>
  )
}

function StatsGrid({ stats = {} }) {
  return (
    <div className="rt-stats">
      <Stat value={stats.attendedWorkouts || 0} label="тренировок" />
      <Stat value={Number(stats.distance || 0).toFixed(1)} label="км всего" />
      <Stat value={formatRating(stats.rating)} label="рейтинг" />
      <Stat value={stats.organizedWorkouts || 0} label="организовано" />
    </div>
  )
}

function NavItems({ active, onChange, compact = false, unreadCount = 0 }) {
  const allItems = [
    ['home', 'home', 'Главная'],
    ['workouts', 'runner', 'Тренировки'],
    ['organized', 'clipboard', 'Организую'],
    ['participating', 'check', 'Участвую'],
    ['create', 'plus', 'Создать'],
    ['notifications', 'bell', 'Уведомления'],
    ['profile', 'user', 'Профиль'],
  ]
  const compactItems = [
    ['home', 'home', 'Главная'],
    ['workouts', 'runner', 'Тренировки'],
    ['create', 'plus', 'Создать'],
    ['notifications', 'bell', 'Уведомления'],
    ['profile', 'user', 'Профиль'],
  ]
  const items = compact ? compactItems : allItems
  const activeItem = compact && ['organized', 'participating'].includes(active) ? 'home' : active

  return (
    <div className={compact ? 'rt-nav compact' : 'rt-nav'}>
      {items.map(([id, icon, label]) => (
        <button
          className={activeItem === id ? 'active' : ''}
          type="button"
          key={id}
          onClick={() => onChange(id)}
          aria-label={label}
        >
          <Icon name={icon} />
          <span>{label}</span>
          {id === 'notifications' && unreadCount > 0 && (
            <em className="rt-nav-badge">{unreadCount}</em>
          )}
        </button>
      ))}
    </div>
  )
}

function TopBar({ title, user, onProfile }) {
  return (
    <header className="rt-top">
      <div>
        <span>RunTogether</span>
        <h1>{title}</h1>
      </div>
      <button type="button" onClick={onProfile} aria-label="Профиль">
        <Avatar user={user} />
      </button>
    </header>
  )
}

function StatusMessage({ message }) {
  return <div className={`rt-message ${message.type}`}>{message.text}</div>
}

function SectionHead({ title, caption }) {
  return (
    <div className="rt-section-head">
      <h2>{title}</h2>
      {caption && <span>{caption}</span>}
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="rt-empty">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="rt-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function Meta({ icon, value }) {
  return (
    <span>
      <Icon name={icon} />
      {value}
    </span>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusBadge({ status, participantStatus }) {
  const isFinished = ['completed', 'archived'].includes(status)
  const ownStatus = participantStatus === 'cancelled' || isFinished ? '' : participantStatus
  const participantMark =
    isFinished && participantStatus === 'confirmed' ? ` · ${participantFinishedLabel()}` : ''
  const text = `${participantLabel(ownStatus) || statusLabel(status)}${participantMark}`
  return (
    <span className={`rt-status ${isFinished ? 'completed' : ownStatus || status}`}>{text}</span>
  )
}

function Avatar({ user, large = false }) {
  return (
    <span className={large ? 'rt-avatar large' : 'rt-avatar'}>
      {user.avatarUrl ? <img alt="" src={user.avatarUrl} /> : user.initials || initials(user.name)}
    </span>
  )
}

function AchievementsPanel({ achievements = [] }) {
  return (
    <div className="rt-panel rt-achievements-panel">
      <SectionHead title="Достижения" caption={`${achievements.length} получено`} />
      {achievements.length ? (
        <div className="rt-achievement-grid">
          {achievements.map((achievement) => (
            <article className="rt-achievement" key={achievement.id}>
              <span>{achievementIcon(achievement.icon)}</span>
              <div>
                <strong>{achievement.title}</strong>
                <em>{achievement.description}</em>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rt-muted">Полученных достижений пока нет.</p>
      )}
    </div>
  )
}

function workoutPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    startAt: new Date(form.startAt).toISOString(),
    durationMinutes: Number(form.durationMinutes),
    meetingPoint: {
      name: form.meetingName.trim(),
      address: form.meetingAddress.trim() || null,
    },
    route: {
      name: form.routeName.trim(),
      geojson: null,
    },
    distanceKm: Number(form.distanceKm),
    paceMinPerKm: Number(form.paceMinPerKm),
    difficulty: form.difficulty,
    participantLimit: Number(form.participantLimit),
  }
}

function formFromWorkout(workout) {
  return {
    title: workout.title || '',
    description: workout.description || '',
    startAt: toLocalInputValue(new Date(workout.startAt)),
    durationMinutes: workout.durationMinutes || 60,
    meetingName: workout.meetingPoint?.name || '',
    meetingAddress: workout.meetingPoint?.address || '',
    routeName: workout.route?.name || '',
    distanceKm: workout.distanceKm || 5,
    paceMinPerKm: workout.paceMinPerKm || 6,
    difficulty: workout.difficulty || 'easy',
    participantLimit: workout.participantLimit || 10,
  }
}

function profileFromUser(user) {
  return {
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    gender: ['male', 'female'].includes(user.gender) ? user.gender : 'male',
    phone: user.phone || '',
    hideEmail: user.privacy?.hide_email !== false,
    hidePhone: user.privacy?.hide_phone !== false,
  }
}

function toLocalInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatRating(value) {
  return value ? Number(value).toFixed(1) : 'нет'
}

function sortWorkoutsNewestFirst(left, right) {
  const leftDate = new Date(left.createdAt || left.startAt || 0).getTime()
  const rightDate = new Date(right.createdAt || right.startAt || 0).getTime()
  return rightDate - leftDate || Number(right.id || 0) - Number(left.id || 0)
}

function achievementIcon(value) {
  return (
    {
      medal: '🏅',
      trophy: '🏆',
      route: '🗺',
      sunrise: '🌅',
      star: '★',
      zap: '⚡',
      flame: '🔥',
      crown: '♕',
    }[value] ||
    value ||
    '★'
  )
}

function stars(value) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0))
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
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

function statusLabel(status) {
  return (
    {
      planned: 'Открыта',
      open: 'Открыта',
      full: 'Мест нет',
      in_progress: 'Идет',
      completed: 'Завершена',
      archived: 'Завершена',
      cancelled: 'Отменена',
    }[status] || status
  )
}

function participantFinishedLabel() {
  return 'вы участвовали'
}

function participantLabel(status) {
  return (
    {
      pending: 'Заявка на рассмотрении',
      confirmed: 'Вы участвуете',
      declined: 'Заявка отклонена',
      cancelled: 'Участие отменено',
    }[status] || ''
  )
}

function difficultyLabel(value) {
  return (
    {
      easy: 'Легкая',
      medium: 'Средняя',
      hard: 'Сложная',
    }[value] || value
  )
}

function roleLabel(value) {
  return (
    {
      member: 'Участник',
      admin: 'Администратор',
      super_admin: 'Супер-админ',
    }[value] || 'Участник'
  )
}

function titleFor(screen, activeTab, mode) {
  if (screen === 'create')
    return mode === 'edit' ? 'Редактирование тренировки' : 'Создание тренировки'
  return (
    {
      home: 'Главная',
      workouts: 'Тренировки',
      organized: 'Организую',
      participating: 'Участвую',
      detail: 'Карточка тренировки',
      organizer: 'Панель организатора',
      requests: 'Заявки',
      notifications: 'Уведомления',
      profile: 'Профиль',
      userProfile: 'Профиль пользователя',
    }[screen] ||
    {
      home: 'Главная',
      workouts: 'Тренировки',
      organized: 'Организую',
      participating: 'Участвую',
      create: 'Создать',
      notifications: 'Уведомления',
      profile: 'Профиль',
    }[activeTab] ||
    'RunTogether'
  )
}

function isJoinableStatus(status) {
  return ['planned', 'open'].includes(status)
}

function canEditWorkout(workout) {
  return isJoinableStatus(workout.status) && new Date(workout.startAt) > new Date()
}

function Icon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  const icons = {
    arrow: (
      <>
        <path d="M15 18l-6-6 6-6" />
        <path d="M9 12h12" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M9 18l6-6-6-6" />
        <path d="M3 12h12" />
      </>
    ),
    home: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h5v-6h4v6h5V10" />
      </>
    ),
    runner: (
      <>
        <path d="M6.5 6.5l11 11" />
        <path d="M21 14l-7 7" />
        <path d="M3 10l7-7" />
        <path d="M17 6l1 1" />
        <path d="M6 17l1 1" />
        <path d="M19 4l1 1" />
        <path d="M4 19l1 1" />
      </>
    ),
    clipboard: (
      <>
        <rect x="8" y="3" width="8" height="4" rx="1" />
        <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </>
    ),
    check: (
      <>
        <path d="M20 6L9 17l-5-5" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
    plus: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    route: (
      <>
        <path d="M4 17c5-8 8 4 16-6" />
        <circle cx="4" cy="17" r="2" />
        <circle cx="20" cy="11" r="2" />
      </>
    ),
    bolt: <path d="M13 2L4 14h7l-1 8 10-13h-7z" />,
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 4l1.4 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.1l1.4-2z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  }

  return (
    <svg className="rt-icon" {...common}>
      {icons[name]}
    </svg>
  )
}
