import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

export default function PolicyAdmin() {
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getPolicy().then(setPolicy).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const updateListField = (field, value) => {
    setPolicy({ ...policy, [field]: value.split('\n').map((s) => s.trim()).filter(Boolean) })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await api.updatePolicy(policy)
      setPolicy(res.policy)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-16 text-center text-mind-400">Loading policy…</div>
  if (error && !policy) return <div className="max-w-3xl mx-auto px-6 py-16 text-center text-red-500">{error}</div>
  if (!policy) return null

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-extrabold text-mind-800 mb-2">Routing Policy</h1>
      <p className="text-mind-500 mb-8 text-sm">
        Operational routing policy — how QueueMind sorts requests into staff workflow queues.
        This is not medical diagnosis logic; it's the clinic's own operational rules, editable without
        touching the AI model.
      </p>

      <div className="card p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-mind-700 mb-1">Confidence threshold</label>
          <input
            type="number" step="0.05" min="0" max="1"
            value={policy.confidence_threshold}
            onChange={(e) => setPolicy({ ...policy, confidence_threshold: parseFloat(e.target.value) })}
            className="w-40 rounded-xl border-2 border-mind-100 px-4 py-2 text-sm"
          />
          <p className="text-xs text-mind-400 mt-1">Extractions below this confidence always go to manual review.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-mind-700 mb-1">SLA threshold (minutes)</label>
          <input
            type="number" min="1"
            value={policy.sla_threshold_minutes}
            onChange={(e) => setPolicy({ ...policy, sla_threshold_minutes: parseInt(e.target.value, 10) })}
            className="w-40 rounded-xl border-2 border-mind-100 px-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="card p-6 mb-6">
        <label className="block text-sm font-semibold text-mind-700 mb-2">🚨 Urgent indicators (one per line)</label>
        <textarea
          rows={6}
          value={(policy.urgent_indicators || []).join('\n')}
          onChange={(e) => updateListField('urgent_indicators', e.target.value)}
          className="w-full rounded-xl border-2 border-mind-100 px-4 py-2 text-sm font-mono"
        />
      </div>

      <div className="card p-6 mb-6">
        <label className="block text-sm font-semibold text-mind-700 mb-2">⭐ Priority indicators (one per line)</label>
        <textarea
          rows={6}
          value={(policy.priority_indicators || []).join('\n')}
          onChange={(e) => updateListField('priority_indicators', e.target.value)}
          className="w-full rounded-xl border-2 border-mind-100 px-4 py-2 text-sm font-mono"
        />
      </div>

      {error && <div className="rounded-xl bg-red-50 text-red-600 text-sm p-4 mb-4">{error}</div>}
      {saved && <div className="rounded-xl bg-mint-400/20 text-mint-500 text-sm p-4 mb-4">✓ Policy saved.</div>}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save Policy'}
      </button>
    </div>
  )
}
