const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

const STALE_TIME = {
  short: 15_000,
  medium: 30_000,
  long: 60_000,
  settings: 5 * 60_000,
}

const responseCache = new Map()
let refreshPromise = null

async function fetchJson(path, fetchOptions = {}) {
  const isFormData = fetchOptions.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: isFormData
      ? { ...(fetchOptions.headers || {}) }
      : {
          'Content-Type': 'application/json',
          ...(fetchOptions.headers || {}),
        },
    ...fetchOptions,
  })

  if (response.status === 204) return null

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Request error')
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = request('/api/auth/refresh', {
      method: 'POST',
      skipAuthRefresh: true,
    }).finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

function canRefreshAuth(path, skipAuthRefresh) {
  return (
    !skipAuthRefresh &&
    !['/api/auth/login', '/api/auth/register', '/api/auth/refresh'].includes(path)
  )
}

async function request(path, options = {}) {
  const { staleTime = 0, skipAuthRefresh = false, ...fetchOptions } = options
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const shouldCache = method === 'GET' && staleTime > 0 && !fetchOptions.signal
  const cacheKey = path

  if (shouldCache) {
    const cached = responseCache.get(cacheKey)
    if (cached?.expiresAt > Date.now() && 'data' in cached) {
      return cloneCachedData(cached.data)
    }
    if (cached?.promise) {
      return cached.promise.then(cloneCachedData)
    }
  }

  const promise = fetchJson(path, fetchOptions)
    .catch(async (error) => {
      if (error.status === 401 && canRefreshAuth(path, skipAuthRefresh)) {
        await refreshSession()
        return fetchJson(path, fetchOptions)
      }
      throw error
    })
    .then((data) => {
      if (shouldCache) {
        responseCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + staleTime,
        })
      } else if (method !== 'GET') {
        clearResponseCache()
      }

      return data
    })
    .catch((error) => {
      if (shouldCache) responseCache.delete(cacheKey)
      throw error
    })

  if (shouldCache) {
    responseCache.set(cacheKey, {
      promise,
      expiresAt: Date.now() + staleTime,
    })
  }

  return promise
}

function clearResponseCache() {
  responseCache.clear()
}

function cloneCachedData(data) {
  if (data == null) return data
  if (typeof structuredClone === 'function') return structuredClone(data)
  return JSON.parse(JSON.stringify(data))
}

function toQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value)
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

function uploadAvatar(path, file) {
  const form = new FormData()
  form.append('avatar', file)
  return request(path, {
    method: 'POST',
    body: form,
  })
}

function achievementBody(payload = {}) {
  if (!payload.iconImage) return JSON.stringify(payload)

  const form = new FormData()
  if (payload.code) form.append('code', payload.code)
  form.append('title', payload.title || '')
  form.append('description', payload.description || '')
  form.append('icon', payload.icon || '')
  form.append('conditionType', payload.condition?.type || payload.conditionType || '')
  form.append('conditionValue', String(payload.condition?.value ?? payload.conditionValue ?? ''))
  form.append('iconImage', payload.iconImage)

  return form
}

export const api = {
  register: (payload) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  checkEmail: (email, options = {}) =>
    request(`/api/auth/email?email=${encodeURIComponent(email)}`, options),
  login: (payload) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  users: (params) => request(`/api/users${toQuery(params)}`, { staleTime: STALE_TIME.medium }),
  user: (id) => request(`/api/users/${id}`, { staleTime: STALE_TIME.short }),
  updateMe: (payload) =>
    request('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateMyAvatar: (file) => uploadAvatar('/api/users/me/avatar', file),
  updateUserAvatar: (id, file) => uploadAvatar(`/api/users/${id}/avatar`, file),
  updateRole: (id, role) =>
    request(`/api/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  blockUser: (id, payload = {}) =>
    request(`/api/users/${id}/block`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  unblockUser: (id) =>
    request(`/api/users/${id}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unblock' }),
    }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
  history: (id) => request(`/api/users/${id}/history`, { staleTime: STALE_TIME.medium }),
  achievements: (id) => request(`/api/users/${id}/achievements`, { staleTime: STALE_TIME.medium }),

  workouts: (params) => request(`/api/workouts${toQuery(params)}`, { staleTime: STALE_TIME.short }),
  workout: (id) => request(`/api/workouts/${id}`, { staleTime: STALE_TIME.short }),
  createWorkout: (payload) =>
    request('/api/workouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorkout: (id, payload) =>
    request(`/api/workouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  cancelWorkout: (id, reason) =>
    request(`/api/workouts/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  joinWorkout: (id) => request(`/api/workouts/${id}/requests`, { method: 'POST' }),
  workoutRequests: (id) => request(`/api/workouts/${id}/requests`),
  reviewTargets: (id) => request(`/api/workouts/${id}/reviews`),
  respondRequest: (workoutId, requestId, status) =>
    request(`/api/workouts/${workoutId}/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  cancelParticipation: (id, userId) =>
    request(`/api/workouts/${id}/participation`, {
      method: 'DELETE',
      body: JSON.stringify(userId ? { userId } : {}),
    }),
  createReview: (workoutId, payload) =>
    request(`/api/workouts/${workoutId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  notifications: () => request('/api/notifications'),
  readNotification: (id) => request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request('/api/notifications', { method: 'PATCH' }),
  reports: (params) => request(`/api/reports${toQuery(params)}`, { staleTime: STALE_TIME.short }),
  createReport: (payload) =>
    request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  moderateReport: (id, payload) =>
    request(`/api/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  activities: () => request('/api/activities', { staleTime: STALE_TIME.medium }),
  settings: () => request('/api/settings', { staleTime: STALE_TIME.settings }),
  saveSettings: (payload) =>
    request('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adminAchievements: () => request('/api/achievements', { staleTime: STALE_TIME.long }),
  createAchievement: (payload) =>
    request('/api/achievements', {
      method: 'POST',
      body: achievementBody(payload),
    }),
  updateAchievement: (id, payload) =>
    request(`/api/achievements/${id}`, {
      method: 'PATCH',
      body: achievementBody(payload),
    }),
  deleteAchievement: (id) => request(`/api/achievements/${id}`, { method: 'DELETE' }),
}
