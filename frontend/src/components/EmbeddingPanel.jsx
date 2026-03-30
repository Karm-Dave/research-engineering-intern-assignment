import { useEffect, useMemo, useState } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { getEmbeddingsViz } from '../api/client.js'

const colorScale = (score) => {
  const clamped = Math.max(0, Math.min(score / 500, 1))
  const r = Math.floor(239 - clamped * 100)
  const g = Math.floor(68 + clamped * 120)
  const b = Math.floor(68 + clamped * 120)
  return `rgb(${r}, ${g}, ${b})`
}

const renderDot = (props) => {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined) return null
  return <circle cx={cx} cy={cy} r={4} fill={payload.color} fillOpacity={0.7} />
}

export default function EmbeddingPanel() {
  const [data, setData] = useState(null)
  const [colorBy, setColorBy] = useState('cluster')
  const [selectedClusters, setSelectedClusters] = useState([])

  useEffect(() => {
    getEmbeddingsViz().then(setData)
  }, [])

  const clusterMap = useMemo(() => {
    const map = new Map()
    data?.clusters?.forEach((c) => map.set(c.cluster_id, c))
    return map
  }, [data])

  const points = useMemo(() => {
    if (!data?.points) return []
    let pts = data.points
    if (selectedClusters.length > 0) {
      pts = pts.filter((p) => selectedClusters.includes(p.cluster_id))
    }
    return pts.map((p) => ({
      ...p,
      color: colorBy === 'cluster'
        ? clusterMap.get(p.cluster_id)?.color || '#94a3b8'
        : colorBy === 'score'
          ? colorScale(p.score || 0)
          : (p.is_self ? '#22c55e' : '#f59e0b')
    }))
  }, [data, selectedClusters, colorBy, clusterMap])

  const centroidPoints = data?.clusters?.map((c) => ({
    x: c.centroid_x,
    y: c.centroid_y,
    label: `Cluster ${c.cluster_id}`,
    color: c.color
  })) || []

  const toggleCluster = (id) => {
    setSelectedClusters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }


  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null
    const p = payload[0].payload
    const cluster = clusterMap.get(p.cluster_id)
    return (
      <div className="rounded-lg bg-slate-900/90 border border-slate-700 px-3 py-2 text-xs text-slate-200">
        <div className="font-semibold">{p.title}</div>
        <div>Score: {p.score}</div>
        <div>Cluster: {p.cluster_id}</div>
        <div className="text-slate-400">{cluster?.keywords?.slice(0, 4).join(', ')}</div>
      </div>
    )
  }

  if (!data) {
    return <div className="glass-card rounded-xl p-6 animate-pulse h-64" />
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Embedding Space</h2>
          <p className="text-sm text-slate-400">UMAP projection of post embeddings.</p>
        </div>
        <div className="flex gap-2">
          {['cluster', 'score', 'type'].map((mode) => (
            <button
              key={mode}
              onClick={() => setColorBy(mode)}
              className={`px-3 py-2 rounded-lg text-xs ${
                colorBy === mode ? 'bg-indigo-500/30 text-indigo-100' : 'bg-slate-800/70'
              }`}
            >
              Color by {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="h-[520px] rounded-xl border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <XAxis dataKey="x" type="number" name="UMAP-1" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis dataKey="y" type="number" name="UMAP-2" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
              <Legend />
              <Scatter name="Posts" data={points} shape={renderDot} />
              <Scatter name="Centroids" data={centroidPoints} fill="#facc15" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="text-sm uppercase text-slate-500">Filter clusters</div>
          <div className="grid grid-cols-2 gap-2">
            {data.clusters.map((c) => (
              <label key={c.cluster_id} className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedClusters.includes(c.cluster_id)}
                  onChange={() => toggleCluster(c.cluster_id)}
                />
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.keywords?.[0] || `Cluster ${c.cluster_id}`}
              </label>
            ))}
          </div>
          <div className="text-xs text-slate-400">
            View in TensorFlow Projector: export embeddings and metadata (see README).
          </div>
        </div>
      </div>
    </div>
  )
}
