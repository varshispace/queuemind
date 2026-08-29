import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

const QUEUE_META = {
  general_consultation: { label: 'General Consultation', emoji: '🩺', color: 'bg-mind-100 text-mind-700' },
  priority_review: { label: 'Priority Review', emoji: '⭐', color: 'bg-peach-300/30 text-peach-400' },
  urgent_review: { label: 'Urgent Review', emoji: '🚨', color: 'bg-red-100 text-red-600' },
  administrative: { label: 'Administrative', emoji: '🗂️', color: 'bg-mint-400/20 text-mint-500' },
  manual_review: { label: 'Manual Review', emoji: '🔍', color: 'bg-amber-100 text-amber-700' },
}

const SLA_THRESHOLD_SECONDS = 5 * 60 // mirrors demo policy default

function timeAgo(seconds) {
  if (seconds == null) return null
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}

export default function StaffDashboard() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [queueFilter, setQueueFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getQueue({ search: search || undefined, queue: queueFilter || undefined, status: statusFilter || undefined })
      setRequests(res.requests)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, queueFilter, statusFilter]) // eslint-disable-line

  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === 'pending_review').length
    const priority = requests.filter((r) => r.recommended_queue === 'priority_review').length
    const urgent = requests.filter((r) => r.recommended_queue === 'urgent_review').length
    const admin = requests.filter((r) => r.recommended_queue === 'administrative').length
    return { total, pending, priority, urgent, admin }
  }, [requests])

  const sorted = useMemo(() => {
    const copy = [...requests]
    if (sortBy === 'newest') copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'oldest') copy.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortBy === 'confidence') copy.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    if (sortBy === 'waiting') copy.sort((a, b) => (b.waiting_seconds ?? 0) - (a.waiting_seconds ?? 0))
    return copy
  }, [requests, sortBy])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-extrabold text-mind-800">Staff Dashboard</h1>
        <button onClick={load} className="btn-secondary text-sm">↻ Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Requests" value={stats.total} emoji="📥" />
        <StatCard label="Pending Review" value={stats.pending} emoji="⏳" />
        <StatCard label="Priority" value={stats.priority} emoji="⭐" />
        <StatCard label="Urgent" value={stats.urgent} emoji="🚨" />
        <StatCard label="Administrative" value={stats.admin} emoji="🗂️" />
        <StatCard label="Total" value={requests.length} emoji="📊" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {Object.entries(QUEUE_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setQueueFilter(queueFilter === key ? '' : key)}
            className={`card p-4 text-center transition-all ${
              queueFilter === key ? 'ring-2 ring-mind-500' : 'hover:-translate-y-0.5'
            }`}
          >
            <div className="text-2xl mb-1">{meta.emoji}</div>
            <div className="text-xs font-semibold text-mind-700">{meta.label}</div>
          </button>
        ))}
      </div>

      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or request text…"
          className="flex-1 min-w-[220px] rounded-xl border-2 border-mind-100 focus:border-mind-400 outline-none px-4 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border-2 border-mind-100 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="overridden">Overridden</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-xl border-2 border-mind-100 px-3 py-2 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="confidence">Confidence</option>
          <option value="waiting">Longest waiting</option>
        </select>
      </div>

      {error && <div className="rounded-xl bg-red-50 text-red-600 text-sm p-4 mb-6">{error}</div>}
      {loading && <div className="text-mind-400 text-sm">Loading requests…</div>}

      {!loading && sorted.length === 0 && (
        <div className="card p-12 text-center text-mind-400">
          <div className="text-4xl mb-3">📭</div>
          No requests yet. Submit a patient request or seed demo data on the backend.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((r) => {
          const meta = QUEUE_META[r.recommended_queue] || { label: r.recommended_queue, emoji: '❔', color: 'bg-gray-100 text-gray-600' }
          const isSla = r.status === 'pending_review' && r.waiting_seconds > SLA_THRESHOLD_SECONDS
          return (
            <Link
              key={r.id}
              to={`/review/${r.id}`}
              className="card p-5 flex flex-wrap items-center gap-4 hover:-translate-y-0.5 transition-transform block"
            >
              <div className="font-mono text-xs text-mind-400 w-20">{r.id}</div>
              <div className="flex-1 min-w-[180px]">
                <div className="font-semibold text-mind-800">{r.patient_name}</div>
                <div className="text-sm text-mind-500 truncate max-w-md">{r.summary || r.raw_text}</div>
              </div>
              {r.recommended_queue && (
                <span className={`badge ${meta.color}`}>{meta.emoji} {meta.label}</span>
              )}
              {r.priority && (
                <span className="badge bg-white border border-mind-200 text-mind-600 capitalize">{r.priority}</span>
              )}
              {r.confidence != null && (
                <span className="badge bg-white border border-mind-200 text-mind-600">
                  {(r.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
              <span className={`badge ${
                r.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                r.status === 'approved' ? 'bg-mint-400/20 text-mint-500' :
                'bg-mind-100 text-mind-700'
              }`}>
                {r.status?.replaceAll('_', ' ')}
              </span>
              {r.waiting_seconds != null && (
                <span className={`badge ${isSla ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                  {isSla ? '⚠️ SLA breach · ' : '⏱ '}{timeAgo(r.waiting_seconds)}
                </span>
              )}
              {r.is_demo_seed && <span className="badge bg-mind-50 text-mind-400">demo</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value, emoji }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-xl mb-1">{emoji}</div>
      <div className="font-display font-extrabold text-2xl text-mind-800">{value}</div>
      <div className="text-xs text-mind-500">{label}</div>
    </div>
  )
}
