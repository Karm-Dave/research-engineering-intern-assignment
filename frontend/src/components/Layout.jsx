import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { onLoadingChange } from '../api/client.js'
import { 
  LayoutDashboard, 
  LineChart, 
  Network, 
  Layers, 
  Box, 
  MessageSquare,
  Search,
  Bell,
  User,
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
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onLoadingChange((count) => setActiveRequests(count))
    return () => unsub()
  }, [])

  const handleSearchClick = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const q = formData.get('q')
    if (q && q.trim()) {
      navigate('/search', { state: { query: q.trim() } })
      e.target.reset()
    }
  }

  return (
    <div className="min-h-screen flex text-foreground bg-background transition-colors duration-300 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col transition-colors duration-300 z-10">
        <div className="px-6 h-16 shrink-0 flex items-center border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-premium">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-primary/80 font-bold">SimPPL</div>
              <div className="text-sm font-semibold tracking-tight text-foreground">Dashboard</div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6">
          <div className="px-4 mb-2 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Analytics</div>
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-foreground/50">
            <span>API Status</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {activeRequests > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${activeRequests > 0 ? 'bg-primary' : 'bg-green-500'}`}></span>
              </span>
              <span>{activeRequests > 0 ? "Syncing..." : "Connected"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 shrink-0 transition-colors duration-300">
          <div className="flex-1 flex items-center">
            <form onSubmit={handleSearchClick} className="relative w-96 hidden md:block group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
              <input 
                name="q"
                type="text" 
                placeholder="Search across the workspace..." 
                className="w-full bg-background border border-border/80 rounded-lg pl-9 pr-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-foreground/40 tracking-tight shadow-sm"
              />
            </form>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg text-foreground/60 hover:bg-foreground/5 hover:text-foreground transition-colors outline-none"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="p-2 rounded-lg text-foreground/60 hover:bg-foreground/5 hover:text-foreground transition-colors outline-none relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-card"></span>
            </button>
            <div className="h-6 w-px bg-border mx-1"></div>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-white shadow-sm">
                <User className="w-4 h-4" />
              </div>
            </button>
          </div>
        </header>

        {/* Page Content Wrapper */}
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
