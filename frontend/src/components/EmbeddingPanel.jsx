import { useEffect, useMemo, useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getEmbeddingsViz } from '../api/client.js'
import { Box, Filter, ExternalLink } from 'lucide-react'

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
          : (p.is_self ? '#10b981' : '#f59e0b')
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
      <div className="bg-card border border-border shadow-premium rounded-xl p-4 max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">{p.title}</div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <span className="text-foreground/40 uppercase font-semibold tracking-wider block">Score</span>
            <span className="font-mono text-foreground/80 mt-0.5 block">{p.score}</span>
          </div>
          <div>
            <span className="text-foreground/40 uppercase font-semibold tracking-wider block">Cluster</span>
            <span className="font-mono text-foreground/80 mt-0.5 block">#{p.cluster_id}</span>
          </div>
        </div>
        {cluster?.keywords && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex flex-wrap gap-1.5">
              {cluster.keywords.slice(0, 4).map(kw => (
                 <span key={kw} className="bg-foreground/[0.03] border border-border/40 text-[10px] uppercase font-semibold text-foreground/60 px-1.5 py-0.5 rounded">
                   {kw}
                 </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!data) {
    return <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-pulse h-96" />
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6 transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Embedding Space</h2>
          <p className="text-sm text-foreground/50 mt-1">UMAP projection highlighting dense narrative formations.</p>
        </div>
        <div className="flex items-center bg-foreground/[0.02] border border-border/50 p-1.5 rounded-xl">
          <div className="px-3 text-xs font-semibold uppercase tracking-wider text-foreground/40 hidden sm:block">Color By</div>
          <div className="flex">
            {['cluster', 'score', 'type'].map((mode) => (
              <button
                key={mode}
                onClick={() => setColorBy(mode)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                  colorBy === mode 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="h-[520px] rounded-xl border border-border/60 bg-foreground/[0.01]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: -20 }}>
              <XAxis dataKey="x" type="number" name="UMAP-1" tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="y" type="number" name="UMAP-2" tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'var(--foreground)', opacity: 0.2 }} content={<CustomTooltip />} />
              <Scatter name="Posts" data={points} shape={renderDot} />
              {/* Highlight Centroids if coloring by cluster */}
              {colorBy === 'cluster' && <Scatter name="Centroids" data={centroidPoints} fill="var(--foreground)" />}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-4">
              <Filter className="w-4 h-4" /> Filter Visibilities
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-2">
              {data.clusters.map((c) => (
                <label key={c.cluster_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/5 cursor-pointer transition-colors border border-transparent hover:border-border/50">
                  <input
                    type="checkbox"
                    checked={selectedClusters.includes(c.cluster_id)}
                    onChange={() => toggleCluster(c.cluster_id)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                     <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ background: c.color }} />
                     <span className="text-sm font-medium text-foreground/80 truncate">
                        {c.keywords?.[0] || `Cluster ${c.cluster_id}`}
                     </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-primary/5 p-4 flex items-start gap-3">
            <Box className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground/70 leading-relaxed">
              Export full high-dimensional vectors to <a className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors" href="https://projector.tensorflow.org/" target="_blank" rel="noreferrer">TensorFlow Projector <ExternalLink className="w-3 h-3" /></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
