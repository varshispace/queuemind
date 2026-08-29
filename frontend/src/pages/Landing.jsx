import { Link } from 'react-router-dom'

const steps = [
  { emoji: '💬', title: 'Patient Message', desc: 'Written in plain language, no forms to decode.' },
  { emoji: '🧠', title: 'AI Understanding', desc: 'Gemini extracts intent, summary & indicators.' },
  { emoji: '📋', title: 'Policy Routing', desc: 'A deterministic rule engine applies clinic policy.' },
  { emoji: '🧑‍⚕️', title: 'Human Review', desc: 'Staff see the why, then approve or override.' },
  { emoji: '✅', title: 'Final Decision', desc: 'Stored with a full audit trail, every time.' },
]

export default function Landing() {
  return (
    <div className="max-w-6xl mx-auto px-6">
      <section className="pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 badge bg-mint-400/20 text-mint-500 mb-6">
          ✨ Built for the hackathon — real Gemini, real Postgres, real decisions
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-extrabold text-mind-800 leading-tight mb-4 animate-float">
          Queue<span className="text-mind-500">Mind</span> <span className="text-peach-400">AI</span>
        </h1>
        <p className="text-2xl md:text-3xl font-display font-semibold text-mind-700 mb-3">
          Turn patient messages into smarter clinic workflows.
        </p>
        <p className="text-lg text-mind-500 max-w-2xl mx-auto mb-10">
          AI understands. Policy routes. People decide.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/request" className="btn-primary text-lg">
            📝 Submit a Request
          </Link>
          <Link to="/dashboard" className="btn-secondary text-lg">
            🩺 Open Staff Dashboard
          </Link>
        </div>
      </section>

      <section className="py-14">
        <h2 className="font-display text-2xl font-bold text-center text-mind-800 mb-10">
          How a request flows through QueueMind
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="card p-6 text-center relative">
              <div className="text-4xl mb-3">{s.emoji}</div>
              <div className="font-display font-bold text-mind-700 mb-1">{s.title}</div>
              <p className="text-sm text-mind-500">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 text-mind-300 text-xl">→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 grid md:grid-cols-3 gap-6">
        <div className="card p-8">
          <div className="text-3xl mb-3">🔒</div>
          <h3 className="font-display font-bold text-mind-800 mb-2">AI never decides alone</h3>
          <p className="text-sm text-mind-500">
            Gemini only extracts structured understanding. A deterministic rule engine — not the model —
            applies your clinic's routing policy. Humans always make the final call.
          </p>
        </div>
        <div className="card p-8">
          <div className="text-3xl mb-3">🧾</div>
          <h3 className="font-display font-bold text-mind-800 mb-2">Full audit trail</h3>
          <p className="text-sm text-mind-500">
            Every request stores the original text, AI extraction, rule engine recommendation, and the
            final human decision — approved or overridden, with a reason.
          </p>
        </div>
        <div className="card p-8">
          <div className="text-3xl mb-3">🛡️</div>
          <h3 className="font-display font-bold text-mind-800 mb-2">Fail-safe by design</h3>
          <p className="text-sm text-mind-500">
            Low confidence, multiple intents, or suspicious prompt-injection attempts all route straight
            to manual review — never a confident guess.
          </p>
        </div>
      </section>
    </div>
  )
}
