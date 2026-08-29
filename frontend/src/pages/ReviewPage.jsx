import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

const QUEUE_OPTIONS = [
  { value: 'general_consultation', label: '🩺 General Consultation' },
  { value: 'priority_review', label: '⭐ Priority Review' },
  { value: 'urgent_review', label: '🚨 Urgent Review' },
  { value: 'administrative', label: '🗂️ Administrative' },
  { value: 'manual_review', label: '🔍 Manual Review' },
]

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideQueue, setOverrideQueue] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getReview(id)
      setData(res)
      if (res.recommendation) setOverrideQueue(res.recommendation.recommended_queue)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      const res = await api.approve(id, { reviewer_name: reviewerName || null })
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleOverride = async () => {
    setSubmitting(true)
    try {
      const res = await api.override(id, {
        queue: overrideQueue,
        reason: overrideReason,
        reviewer_name: reviewerName || null,
      })
      setData(res)
      setShowOverride(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-16 text-center text-mind-400">Loading…</div>
  if (error && !data) return <div className="max-w-4xl mx-auto px-6 py-16 text-center text-red-500">{error}</div>
  if (!data) return null

  const { extraction, recommendation, decision } = data

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button onClick={() => navigate('/dashboard')} className="text-sm text-mind-500 hover:text-mind-700 mb-4">
        ← Back to dashboard
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-extrabold text-mind-800">
          Request {data.id} {data.is_demo_seed && <span className="badge bg-mind-50 text-mind-400 ml-2">demo</span>}
        </h1>
        <span className="badge bg-white border border-mind-200 text-mind-600">{data.patient_name}, {data.patient_age ?? '—'}</span>
      </div>

      {/* Patient request */}
      <Section title="Patient Request" emoji="💬">
        <p className="text-mind-700 whitespace-pre-wrap">{data.raw_text}</p>
      </Section>

      {/* AI Understanding */}
      <Section title="AI Understanding" emoji="🧠" subtitle="AI SUGGESTION — extraction only, not a decision">
        {extraction ? (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Summary" value={extraction.summary} full />
            <Field label="Request type" value={extraction.request_type} />
            <Field label="Department" value={extraction.department} />
            <Field label="Duration mentioned" value={extraction.duration || '—'} />
            <Field label="Confidence" value={`${(extraction.confidence * 100).toFixed(0)}%`} />
            <Field label="Intents" value={extraction.intents?.join(', ')} full />
            <Field label="Indicators" value={extraction.indicators?.join(', ') || '—'} full />
            {extraction.multiple_intents && (
              <div className="md:col-span-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 text-sm font-semibold">
                ⚠️ MULTIPLE INTENTS DETECTED — manual review required.
              </div>
            )}
            {extraction.safety_flags?.length > 0 && (
              <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-100 text-red-600 px-4 py-3 text-sm font-semibold">
                🛡️ Safety flags: {extraction.safety_flags.join(', ')}
              </div>
            )}
            {!extraction.is_valid && (
              <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-100 text-red-600 px-4 py-3 text-sm">
                Extraction failed validation and was not trusted downstream.
              </div>
            )}
          </div>
        ) : (
          <div className="text-mind-400 text-sm">No extraction available.</div>
        )}
      </Section>

      {/* Routing Recommendation */}
      <Section title="Routing Recommendation" emoji="📋" subtitle="Deterministic rule engine output">
        {recommendation ? (
          <div className="space-y-2 text-sm">
            <Field label="Suggested queue" value={recommendation.recommended_queue?.replaceAll('_', ' ')} />
            <Field label="Priority" value={recommendation.priority} />
            <Field label="Reason" value={recommendation.reason} full />
            {recommendation.manual_review_required && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 font-semibold">
                🔍 MANUAL REVIEW REQUIRED
              </div>
            )}
          </div>
        ) : (
          <div className="text-mind-400 text-sm">No recommendation available.</div>
        )}
      </Section>

      {/* Final Human Decision */}
      <Section title="Final Human Decision" emoji="🧑‍⚕️" subtitle="FINAL HUMAN DECISION">
        {decision ? (
          <div className="space-y-2 text-sm">
            <div className={`badge ${decision.action === 'approve' ? 'bg-mint-400/20 text-mint-500' : 'bg-peach-300/30 text-peach-400'}`}>
              {decision.action === 'approve' ? '✓ Approved' : '↻ Overridden'}
            </div>
            <Field label="Final queue" value={decision.final_queue?.replaceAll('_', ' ')} />
            <Field label="Final priority" value={decision.final_priority} />
            {decision.override_reason && <Field label="Override reason" value={decision.override_reason} full />}
            {decision.reviewer_name && <Field label="Reviewer" value={decision.reviewer_name} />}
            <Field label="Decided at" value={new Date(decision.decided_at).toLocaleString()} />
          </div>
        ) : (
          <div className="space-y-4">
            <input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Your name (optional)"
              className="rounded-xl border-2 border-mind-100 focus:border-mind-400 outline-none px-4 py-2 text-sm w-full max-w-xs"
            />
            <div className="flex flex-wrap gap-3">
              <button onClick={handleApprove} disabled={submitting || !recommendation} className="btn-primary">
                ✓ Approve
              </button>
              <button onClick={() => setShowOverride(!showOverride)} disabled={submitting} className="btn-secondary">
                ↻ Override
              </button>
            </div>
            {showOverride && (
              <div className="card p-5 space-y-3 bg-mind-50/60">
                <label className="block text-sm font-semibold text-mind-700">New queue</label>
                <select
                  value={overrideQueue}
                  onChange={(e) => setOverrideQueue(e.target.value)}
                  className="w-full rounded-xl border-2 border-mind-100 px-4 py-2 text-sm"
                >
                  {QUEUE_OPTIONS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
                <label className="block text-sm font-semibold text-mind-700">Reason for override</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border-2 border-mind-100 px-4 py-2 text-sm"
                  placeholder="Why are you changing the AI + policy recommendation?"
                />
                <button
                  onClick={handleOverride}
                  disabled={submitting || !overrideReason}
                  className="btn-primary"
                >
                  Confirm Override
                </button>
              </div>
            )}
            {error && <div className="rounded-xl bg-red-50 text-red-600 text-sm p-4">{error}</div>}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, emoji, subtitle, children }) {
  return (
    <div className="card p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-mind-800">{emoji} {title}</h2>
        {subtitle && <span className="text-xs uppercase tracking-wide text-mind-400 font-semibold">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="text-xs uppercase tracking-wide text-mind-400 font-semibold mb-0.5">{label}</div>
      <div className="text-mind-700 capitalize">{value ?? '—'}</div>
    </div>
  )
}
