import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { onLoadingChange } from '../api/client.js'

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/timeseries', label: 'Time Series' },
  { to: '/network', label: 'Network' },
  { to: '/clusters', label: 'Topic Clusters' },
  { to: '/embeddings', label: 'Embedding Space' },
  { to: '/search', label: 'Search & Chat' }
]

export default function Layout({ children }) {
  const [activeRequests, setActiveRequests] = useState(0)

  useEffect(() => {
    const unsub = onLoadingChange((count) => setActiveRequests(count))
    return () => unsub()
  }, [])
  return (
    <div className="min-h-screen flex text-slate-100">
      <aside className="w-64 border-r border-slate-700/60 bg-slate-900/80 backdrop-blur">
        <div className="px-6 py-6">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">SimPPL</div>
          <div className="mt-2 text-xl font-semibold">Research Dashboard</div>
          <div className="mt-3 text-sm text-slate-400">Multi-subreddit narrative analysis</div>
        </div>
        <nav className="px-3">
          {navItems.map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `mb-2 flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'
                      : 'text-slate-300 hover:bg-slate-800/70'
                  }`
                }
              >
                <span className="h-2 w-2 rounded-full bg-slate-500/60" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Investigative Reporting Workspace</h1>
          <p className="text-slate-400">Explore diffusion patterns across multiple political communities.</p>
          <div className="mt-2 text-xs text-slate-500">API status: {activeRequests > 0 ? "syncing" : "idle"}</div>
        </div>
        {children}
      </main>
    </div>
  )
}
