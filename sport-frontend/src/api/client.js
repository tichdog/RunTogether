const API_BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }
  return data;
}

export const api = {
  register: payload => request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  login: payload => request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),

  users: params => request(`/api/users${toQuery(params)}`),
  user: id => request(`/api/users/${id}`),
  updateMe: payload => request("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
  updateRole: (id, role) => request(`/api/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  }),
  blockUser: id => request(`/api/users/${id}/block`, { method: "PATCH" }),
  deleteUser: id => request(`/api/users/${id}`, { method: "DELETE" }),
  history: id => request(`/api/users/${id}/history`),
  achievements: id => request(`/api/users/${id}/achievements`),

  workouts: params => request(`/api/workouts${toQuery(params)}`),
  workout: id => request(`/api/workouts/${id}`),
  createWorkout: payload => request("/api/workouts", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateWorkout: (id, payload) => request(`/api/workouts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
  cancelWorkout: (id, reason) => request(`/api/workouts/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  }),
  joinWorkout: id => request(`/api/workouts/${id}/requests`, { method: "POST" }),
  workoutRequests: id => request(`/api/workouts/${id}/requests`),
  respondRequest: (workoutId, requestId, status) => request(`/api/workouts/${workoutId}/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
  cancelParticipation: id => request(`/api/workouts/${id}/participation`, { method: "DELETE" }),
  createReview: (workoutId, payload) => request(`/api/workouts/${workoutId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  notifications: () => request("/api/notifications"),
  reports: () => request("/api/reports"),
  activities: () => request("/api/activities"),
  settings: () => request("/api/settings"),
  saveSettings: payload => request("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
};

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}
