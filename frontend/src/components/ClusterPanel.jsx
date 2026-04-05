import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getClusters } from '../api/client.js'
import { Layers, PieChart as PieChartIcon, ChevronRight, Settings2 } from 'lucide-react'

export default function ClusterPanel() {
  const [nClusters, setNClusters] = useState(8)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [message, setMessage] = useState('')

  const fetchClusters = async () => {
    let n = nClusters
    if (n < 4) {
      n = 4
      setMessage('Adjusting to valid range (Min 4)')
    } else if (n > 10) {
      n = 10
      setMessage('Adjusting to valid range (Max 10)')
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

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    borderColor: 'var(--border)',
    color: 'var(--card-foreground)',
    borderRadius: '0.5rem',
    boxShadow: 'var(--tw-shadow)',
    fontSize: '0.875rem'
  }

  return (
    <div className="glass-card rounded-lg p-8 transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Topic Clusters</h2>
          <p className="text-sm text-foreground/50 mt-1">Tune the cluster count to reveal hidden macroscopic themes.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 glass-subtle p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <Settings2 className="w-4 h-4 text-foreground/40" />
            <span className="text-sm font-medium text-foreground/70">Clusters: {nClusters}</span>
          </div>
          <div className="flex flex-1 items-center gap-4 sm:ml-4 sm:pl-4 sm:border-l sm:border-border/50">
            <input
              type="range"
              min="4"
              max="10"
              value={nClusters}
              onChange={(e) => setNClusters(Number(e.target.value))}
              className="w-32 accent-primary bg-foreground/10 rounded-lg appearance-none h-1.5 cursor-pointer outline-none"
            />
            <button 
              onClick={fetchClusters} 
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-sm hover:opacity-90 transition-opacity"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>

      {message && <div className="text-xs text-amber-500 font-medium mb-4">{message}</div>}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-foreground/[0.05] border border-border shadow-sm rounded-lg p-4 h-40 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
            {data.map((cluster) => (
              <div
                key={cluster.cluster_id}
                className={`rounded-lg border transition-all cursor-pointer overflow-hidden ${
                  expanded === cluster.cluster_id 
                    ? 'border-primary ring-1 ring-primary shadow-sm bg-card' 
                    : 'border-border/60 hover:border-foreground/20 hover:bg-foreground/[0.04] bg-card'
                }`}
                onClick={() => setExpanded(expanded === cluster.cluster_id ? null : cluster.cluster_id)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span 
                      className="inline-block h-3.5 w-3.5 rounded-full shadow-sm ring-2 ring-background" 
                      style={{ background: cluster.color }} 
                    />
                    <div className="font-semibold text-foreground tracking-tight">Cluster {cluster.cluster_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-mono font-medium text-foreground/50 bg-foreground/5 px-2 py-0.5 rounded-md">
                      {cluster.size} posts
                    </div>
                    <ChevronRight className={`w-4 h-4 text-foreground/30 transition-transform ${expanded === cluster.cluster_id ? 'rotate-90' : ''}`} />
                  </div>
                </div>
                
                <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                  {(cluster.keywords || []).map((kw) => (
                    <span key={kw} className="px-2.5 py-1 rounded-md bg-foreground/[0.06] border border-border/50 text-xs font-medium text-foreground/70">
                      {kw}
                    </span>
                  ))}
                </div>

                {expanded === cluster.cluster_id && (
                  <div className="px-4 pb-4 border-t border-border/30 bg-foreground/[0.04] pt-4">
                    <p className="text-sm text-foreground/80 leading-relaxed font-serif italic border-l-2 border-primary/40 pl-3">
                      {cluster.summary}
                    </p>
                    <div className="mt-5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 mb-3 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" /> Top Ranked Posts
                      </div>
                      <ul className="space-y-2">
                        {cluster.posts?.slice(0, 3).map((p) => {
                          const postUrl = p.reddit_url
                          ? p.reddit_url
                          : (p.permalink
                            ? `https://www.reddit.com${p.permalink}`
                            : (p.subreddit && p.id ? `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}/` : ''))
                          return (
                            <li key={p.id} className="text-sm flex items-start gap-2 text-foreground/70 glass-subtle p-2">
                              <span className="text-primary mt-0.5">???</span>
                              <div className="min-w-0">
                                {postUrl ? (
                                  <a
                                    href={postUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="truncate block font-medium text-primary hover:text-primary/80 transition-colors"
                                  >
                                    {p.title}
                                  </a>
                                ) : (
                                  <span className="truncate block font-medium">{p.title}</span>
                                )}
                                <span className="text-xs font-mono text-emerald-500">score: {p.score}</span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="glass-subtle p-6 h-fit sticky top-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-6">
              <PieChartIcon className="w-4 h-4" /> Component Distribution
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    dataKey="value" 
                    nameKey="name" 
                    outerRadius={100} 
                    innerRadius={60} 
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--foreground)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 items-center justify-center">
                {pieData.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-foreground/60">
                    <span className="w-2 h-2 rounded-full" style={{ background: entry.color }}></span>
                    <span className="truncate max-w-[80px]">{entry.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
