// The frontend NEVER calls Gemini directly. It only ever talks to our own
// FastAPI backend, which is the sole holder of GEMINI_API_KEY / DATABASE_URL.
const API_URL = import.meta.env.VITE_API_URL || 'https://queuemind-backend.onrender.com'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || JSON.stringify(body)
    } catch (_) {}
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const api = {
  submitIntake: (payload) =>
    request('/api/intake', { method: 'POST', body: JSON.stringify(payload) }),

  getQueue: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request(`/api/queue${qs ? `?${qs}` : ''}`)
  },

  getReview: (id) => request(`/api/review/${id}`),

  approve: (id, payload) =>
    request(`/api/review/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) }),

  override: (id, payload) =>
    request(`/api/review/${id}/override`, { method: 'POST', body: JSON.stringify(payload) }),

  getAnalytics: () => request('/api/analytics'),

  getPolicy: () => request('/api/policy'),

  updatePolicy: (policy) =>
    request('/api/policy', { method: 'PUT', body: JSON.stringify({ policy }) }),

  health: () => request('/api/health'),
}

export { API_URL }
