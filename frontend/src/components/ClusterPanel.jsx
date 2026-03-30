import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getClusters } from '../api/client.js'

export default function ClusterPanel() {
  const [nClusters, setNClusters] = useState(8)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [message, setMessage] = useState('')

  const fetchClusters = async () => {
    let n = nClusters
    if (n < 2) {
      n = 2
      setMessage('Adjusting to valid range')
    } else if (n > 50) {
      n = 50
      setMessage('Adjusting to valid range')
    } else {
      setMessage('')
    }
    setLoading(true)
    const res = await getClusters(n)
    setData(res)
    setLoading(false)
  }

  const pieData = data
    ? data.map((c) => ({ name: c.keywords?.[0] || `Cluster ${c.cluster_id}`, value: c.size, color: c.color }))
    : []

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Topic Clusters</h2>
          <p className="text-sm text-slate-400">Tune the cluster count to reveal hidden themes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Clusters: {nClusters}</div>
          <input
            type="range"
            min="2"
            max="20"
            value={nClusters}
            onChange={(e) => setNClusters(Number(e.target.value))}
          />
          <button onClick={fetchClusters} className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100">
            Apply
          </button>
        </div>
      </div>

      {message && <div className="text-xs text-amber-300">{message}</div>}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="glass-card rounded-xl p-4 h-40 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((cluster) => (
              <div
                key={cluster.cluster_id}
                className="rounded-xl border border-slate-800 p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === cluster.cluster_id ? null : cluster.cluster_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: cluster.color }} />
                    <div className="font-semibold">Cluster {cluster.cluster_id}</div>
                  </div>
                  <div className="text-xs text-slate-400">{cluster.size} posts</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(cluster.keywords || []).map((kw) => (
                    <span key={kw} className="px-2 py-1 rounded-full bg-slate-800 text-xs text-slate-300">
                      {kw}
                    </span>
                  ))}
                </div>
                {expanded === cluster.cluster_id && (
                  <div className="mt-4 text-sm text-slate-300 space-y-3">
                    <p>{cluster.summary}</p>
                    <div>
                      <div className="text-xs uppercase text-slate-500">Top posts</div>
                      <ul className="mt-2 text-xs text-slate-400 space-y-1">
                        {cluster.posts?.slice(0, 3).map((p) => (
                          <li key={p.id}>{p.title} (score {p.score})</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 p-4">
            <div className="text-sm uppercase text-slate-500">Cluster Distribution</div>
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
