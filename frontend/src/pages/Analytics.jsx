import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { api } from '../api/client.js'

const COLORS = ['#7c3aed', '#a78bfa', '#2dd4bf', '#fb923c', '#f87171']

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getAnalytics()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-16 text-center text-mind-400">Loading analytics…</div>
  if (error) return <div className="max-w-5xl mx-auto px-6 py-16 text-center text-red-500">{error}</div>

  if (!data?.has_data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h1 className="font-display text-2xl font-bold text-mind-800 mb-2">No analytics yet</h1>
        <p className="text-mind-500">{data?.message || 'Submit some requests (or seed demo data) to see analytics here.'}</p>
      </div>
    )
  }

  const queueData = Object.entries(data.queue_volume || {}).map(([name, value]) => ({
    name: name.replaceAll('_', ' '), value,
  }))
  const priorityData = Object.entries(data.priority_distribution || {}).map(([name, value]) => ({
    name, value,
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-extrabold text-mind-800 mb-2">Analytics</h1>
      <p className="text-mind-500 mb-8 text-sm">
        Computed live from stored requests, extractions, recommendations and staff decisions. No fabricated numbers.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Metric label="Total Requests" value={data.total_requests} />
        <Metric label="Pending Review" value={data.pending_review} />
        <Metric label="Routing Accuracy" value={fmtPct(data.routing_accuracy_pct)} hint="% of AI+policy recommendations approved as-is" />
        <Metric label="Override Rate" value={fmtPct(data.override_rate_pct)} hint="% of decisions where staff overrode" />
        <Metric label="Urgency Recall" value={fmtPct(data.urgency_recall_pct)} hint="Of requests finally marked urgent, % the engine also flagged urgent" />
        <Metric label="Urgent False Negatives" value={data.urgent_false_negatives} hint="Urgent (per staff) but engine missed it — safety metric" warn />
        <Metric label="Avg Gemini Latency" value={fmtMs(data.avg_gemini_latency_ms)} />
        <Metric label="Avg Processing Time" value={fmtMs(data.avg_total_processing_ms)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-display font-bold text-mind-800 mb-4">Queue Volume</h2>
          {queueData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={queueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ede9fe" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-mind-800 mb-4">Priority Distribution</h2>
          {priorityData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={priorityData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {priorityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, hint, warn }) {
  return (
    <div className="card p-4">
      <div className={`font-display font-extrabold text-2xl ${warn && value > 0 ? 'text-red-500' : 'text-mind-800'}`}>
        {value ?? '—'}
      </div>
      <div className="text-xs font-semibold text-mind-500">{label}</div>
      {hint && <div className="text-[10px] text-mind-400 mt-1">{hint}</div>}
    </div>
  )
}

function EmptyChart() {
  return <div className="h-[260px] flex items-center justify-center text-mind-300 text-sm">Not enough data yet</div>
}

function fmtPct(v) { return v == null ? '—' : `${v}%` }
function fmtMs(v) { return v == null ? '—' : `${Math.round(v)}ms` }
