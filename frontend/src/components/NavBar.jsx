import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/request', label: 'Submit Request' },
  { to: '/dashboard', label: 'Staff Dashboard' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/policy', label: 'Policy' },
]

export default function NavBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 border-b border-mind-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2 font-display font-extrabold text-xl text-mind-700">
          <span className="text-2xl">🧠</span>
          QueueMind <span className="text-mint-500">AI</span>
        </NavLink>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-mind-100 text-mind-700'
                    : 'text-mind-500/80 hover:bg-mind-50 hover:text-mind-700'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
