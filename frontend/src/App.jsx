import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'

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
    <StatCards />
    <PostTable />
  </div>
)

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getHealth()
      .then(() => {
        if (mounted) {
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Backend is not reachable. Start the FastAPI server on port 8000.')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-200">
        <div className="glass-card px-6 py-4 rounded-xl">
          <div className="animate-pulse text-sm uppercase tracking-widest text-slate-400">Loading</div>
          <div className="mt-2 text-lg font-semibold">Warming up the dashboards...</div>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <ErrorBoundary>
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
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
