import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Activity } from 'lucide-react'

import Layout from './components/Layout.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import StatCards from './components/StatCards.jsx'
import TimeSeriesPanel from './components/TimeSeriesPanel.jsx'
import NetworkPanel from './components/NetworkPanel.jsx'
import ClusterPanel from './components/ClusterPanel.jsx'
import EmbeddingPanel from './components/EmbeddingPanel.jsx'
import SearchChat from './components/SearchChat.jsx'
import PostTable from './components/PostTable.jsx'
import { getHealth } from './api/client.js'

const Overview = () => (
  <div className="space-y-6">
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      <p className="text-foreground/60 mt-1">Investigative reporting metrics and global data scope.</p>
    </div>
    <StatCards />
    <PostTable />
  </div>
)

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Theme Management
  const [isDark, setIsDark] = useState(() => {
    if (typeof localStorage !== 'undefined' && localStorage.theme) {
      return localStorage.theme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  // Health Check
  useEffect(() => {
    let mounted = true
    getHealth()
      .then(() => {
        if (mounted) setLoading(false)
      })
      .catch(() => {
        if (mounted) {
          setError('Backend is not reachable. Start the FastAPI server on port 8000.')
          setLoading(false)
        }
      })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent text-foreground transition-colors duration-300">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-lg font-medium tracking-tight">Booting Dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <Layout isDark={isDark} toggleTheme={toggleTheme}>
      <ErrorBoundary>
        {error && (
          <div className="mb-6 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-500 text-sm font-medium">
            {error}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/timeseries" element={<TimeSeriesPanel />} />
          <Route path="/network" element={<NetworkPanel />} />
          <Route path="/clusters" element={<ClusterPanel />} />
          <Route path="/embeddings" element={<EmbeddingPanel />} />
          <Route path="/search" element={<SearchChat />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}
