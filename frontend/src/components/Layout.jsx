import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { onLoadingChange } from '../api/client.js'
import { 
  LayoutDashboard, 
  LineChart, 
  Network, 
  Layers, 
  Box, 
  MessageSquare,
  Sun,
  Moon
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/timeseries', label: 'Time Series', icon: LineChart },
  { to: '/network', label: 'Network', icon: Network },
  { to: '/clusters', label: 'Topic Clusters', icon: Layers },
  { to: '/embeddings', label: 'Embedding Space', icon: Box },
  { to: '/search', label: 'Search & Chat', icon: MessageSquare }
]

export default function Layout({ children, toggleTheme, isDark }) {
  const [activeRequests, setActiveRequests] = useState(0)
  useEffect(() => {
    const unsub = onLoadingChange((count) => setActiveRequests(count))
    return () => unsub()
  }, [])

  return (
    <div className="min-h-screen flex flex-col text-foreground bg-transparent transition-colors duration-300 font-sans">
      <header className="border-b border-border/70 bg-card">
        <div className="w-full px-6 py-5 flex flex-col gap-4">
          <div className="relative flex items-center justify-center">
            <div className="text-center leading-tight">
              <div className="text-[1.1rem] uppercase tracking-[0.45em] text-primary font-semibold font-serif">ARCANUM</div>
                          </div>
            <div className="absolute right-0 flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-[0.7rem] text-foreground/60 border border-border/60 px-2.5 py-1.5 rounded-md">
                <span className="uppercase tracking-widest">API</span>
                <span className="relative flex h-2 w-2">
                  {activeRequests > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${activeRequests > 0 ? 'bg-primary' : 'bg-emerald-500'}`}></span>
                </span>
                <span>{activeRequests > 0 ? "Syncing" : "Live"}</span>
              </div>
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-md text-foreground/60 bg-foreground/5 border border-border/60 hover:bg-foreground/10 hover:text-foreground transition-colors outline-none"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <nav className="w-full">
            <div className="flex items-center justify-between gap-3 whitespace-nowrap w-full">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2 py-2 text-[0.62rem] uppercase tracking-[0.2em] font-semibold border-b-2 transition-colors ${
                        isActive
                          ? 'border-primary text-primary bg-foreground/5'
                          : 'border-transparent text-foreground/70 hover:text-foreground hover:border-border'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-transparent px-8 py-10">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
