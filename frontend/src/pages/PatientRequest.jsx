import { useState } from 'react'
import { api } from '../api/client.js'

const PROCESSING_STEPS = [
  'QueueMind is understanding your request…',
  'Applying clinic routing policy…',
  'Ready for staff review.',
]

export default function PatientRequest() {
  const [form, setForm] = useState({ patient_name: '', patient_age: '', raw_text: '' })
  const [status, setStatus] = useState('idle') // idle | processing | done | error
  const [processingStep, setProcessingStep] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('processing')
    setError(null)
    setProcessingStep(0)

    // Real UX cue that mirrors actual backend stages, not a fake animation
    // decoupled from what's happening.
    const stepTimer = setInterval(() => {
      setProcessingStep((s) => Math.min(s + 1, 1))
    }, 900)

    try {
      const payload = {
        patient_name: form.patient_name,
        patient_age: form.patient_age ? parseInt(form.patient_age, 10) : null,
        raw_text: form.raw_text,
      }
      const res = await api.submitIntake(payload)
      clearInterval(stepTimer)
      setProcessingStep(2)
      setResult(res)
      setStatus('done')
    } catch (err) {
      clearInterval(stepTimer)
      setError(err.message || 'Something went wrong submitting your request.')
      setStatus('error')
    }
  }

  const reset = () => {
    setForm({ patient_name: '', patient_age: '', raw_text: '' })
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-extrabold text-mind-800 mb-2">Tell us what you need help with</h1>
      <p className="text-mind-500 mb-8">
        Write naturally — there's no need to pick clinical categories. This is a demo, please don't
        submit real personal health information.
      </p>

      {status === 'idle' || status === 'error' ? (
        <form onSubmit={handleSubmit} className="card p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-mind-700 mb-1">Patient name</label>
            <input
              required
              name="patient_name"
              value={form.patient_name}
              onChange={handleChange}
              className="w-full rounded-xl border-2 border-mind-100 focus:border-mind-400 outline-none px-4 py-3"
              placeholder="e.g. Jordan Lee"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mind-700 mb-1">Age</label>
            <input
              type="number"
              name="patient_age"
              value={form.patient_age}
              onChange={handleChange}
              min="0"
              max="130"
              className="w-full rounded-xl border-2 border-mind-100 focus:border-mind-400 outline-none px-4 py-3"
              placeholder="e.g. 34"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mind-700 mb-1">Your request</label>
            <textarea
              required
              name="raw_text"
              value={form.raw_text}
              onChange={handleChange}
              rows={6}
              className="w-full rounded-xl border-2 border-mind-100 focus:border-mind-400 outline-none px-4 py-3"
              placeholder="Tell us what you need help with..."
            />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 text-red-600 text-sm p-4 border border-red-100">{error}</div>
          )}
          <button type="submit" className="btn-primary w-full justify-center text-lg">
            Submit Request
          </button>
        </form>
      ) : null}

      {status === 'processing' && (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-6 animate-pulse-soft">🧠</div>
          <p className="font-display font-semibold text-mind-700 text-lg mb-6">
            {PROCESSING_STEPS[processingStep]}
          </p>
          <div className="flex justify-center gap-2">
            {PROCESSING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-16 rounded-full transition-colors ${
                  i <= processingStep ? 'bg-mind-500' : 'bg-mind-100'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {status === 'done' && result && (
        <div className="card p-8 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="font-display text-2xl font-bold text-mind-800">Request received!</h2>
          <p className="text-mind-500">
            Your request ID is <span className="font-mono font-semibold text-mind-700">{result.request_id}</span>.
            A staff member will review it shortly.
          </p>
          {result.warning && (
            <div className="rounded-xl bg-amber-50 text-amber-700 text-sm p-4 border border-amber-100">
              {result.warning}
            </div>
          )}
          {result.recommendation && (
            <div className="rounded-xl bg-mind-50 p-4 text-sm text-mind-700">
              Preliminary suggested queue:{' '}
              <span className="font-semibold">{result.recommendation.recommended_queue?.replaceAll('_', ' ')}</span>
              {' · '}Priority: <span className="font-semibold">{result.recommendation.priority}</span>
              <br />
              <span className="text-xs text-mind-500">This is an AI-assisted suggestion, pending human review.</span>
            </div>
          )}
          <button onClick={reset} className="btn-secondary mt-4">
            Submit another request
          </button>
        </div>
      )}
    </div>
  )
}
