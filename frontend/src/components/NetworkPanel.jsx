import { useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { getNetwork, getRemoveTopNodeAnalysis } from '../api/client.js'
import { Network, Activity, Settings2, Scissors } from 'lucide-react'

export default function NetworkPanel() {
  const [type, setType] = useState('domain')
  const [metric, setMetric] = useState('pagerank')
  const [topN, setTopN] = useState(50)
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => {
    setLoading(true)
    getNetwork(type, metric, topN)
      .then(setGraph)
      .finally(() => setLoading(false))
  }, [type, metric, topN])

  const handleRemoveTop = async () => {
    const data = await getRemoveTopNodeAnalysis(type)
    setModal(data)
  }

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const linkColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const graphData = graph ? { nodes: graph.nodes || [], links: graph.edges || [] } : { nodes: [], links: [] }

  const topNodes = graph?.nodes
    ? [...graph.nodes].sort((a, b) => b.score - a.score).slice(0, 10)
    : []

  const selectedStats = (() => {
    if (!selectedNode || !graph) return null
    const edges = graph.edges || []
    const linkCount = edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length
    const weightSum = edges.reduce((sum, e) => {
      if (e.source === selectedNode.id || e.target === selectedNode.id) {
        return sum + (e.weight || 1)
      }
      return sum
    }, 0)
    return { linkCount, weightSum }
  })()

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-6 transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Network Explorer</h2>
          <p className="text-sm text-foreground/50 mt-1">Inspect sharing dynamics and key actors.</p>
        </div>
        <button
          onClick={handleRemoveTop}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 transition-colors border border-rose-500/20 font-medium text-sm"
        >
          <Scissors className="w-4 h-4" />
          Remove Top Node
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="h-[560px] rounded-xl border border-border/60 bg-foreground/[0.01] overflow-hidden flex relative">
          {loading || !graph ? (
            <div className="w-full flex flex-col items-center justify-center text-foreground/40 gap-3">
              <Network className="w-8 h-8 animate-pulse text-primary/50" />
              <span className="text-sm font-medium">Computing graph architecture...</span>
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              nodeLabel={(node) => `${node.label}\nScore: ${node.score?.toFixed(4)}`}
              nodeRelSize={5}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              nodeColor={(node) => node.color}
              nodeVal={(node) => node.size}
              linkWidth={(link) => Math.max(0.5, (link.weight || 1) * 0.5)}
              linkColor={() => linkColor}
              onNodeClick={(node) => setSelectedNode(node)}
            />
          )}
        </div>

        <div className="space-y-4 flex flex-col">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-4">
              <Settings2 className="w-4 h-4" /> Controls
            </div>
            <div className="space-y-4">
              <div className="flex bg-foreground/5 p-1 rounded-lg">
                <button
                  onClick={() => setType('domain')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    type === 'domain' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  Domain
                </button>
                <button
                  onClick={() => setType('author')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    type === 'author' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  Author
                </button>
              </div>
              <div className="flex bg-foreground/5 p-1 rounded-lg">
                <button
                  onClick={() => setMetric('pagerank')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    metric === 'pagerank' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  PageRank
                </button>
                <button
                  onClick={() => setMetric('betweenness')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    metric === 'betweenness' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  Betweenness
                </button>
              </div>
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-foreground/60">Node Limit</label>
                  <span className="text-xs font-bold text-primary">{topN}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  className="w-full accent-primary bg-foreground/10 rounded-lg appearance-none h-1.5 cursor-pointer outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-4 shrink-0">
              <Activity className="w-4 h-4" /> Top Nodes
            </div>
            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide">
              {topNodes.map((node, idx) => (
                <div key={node.id} className="flex items-center gap-3 group">
                  <div className="text-[10px] font-mono text-foreground/40 w-4 text-right">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {node.label}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-foreground/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.min(node.size * 2, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {selectedNode && (
          <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4 flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground/40">Inspecting</div>
              <div className="mt-1 font-semibold text-primary truncate text-lg">{selectedNode.label}</div>
            </div>
            <div className="flex gap-4 border-l border-border/50 pl-4 items-center">
               <div className="text-right">
                  <div className="text-[10px] uppercase text-foreground/40 font-semibold mb-0.5">Centrality Score</div>
                  <div className="font-mono text-sm">{selectedNode.score?.toFixed(4)}</div>
               </div>
               {selectedStats && (
                 <div className="text-right hidden sm:block">
                   <div className="text-[10px] uppercase text-foreground/40 font-semibold mb-0.5">Total Connections</div>
                   <div className="font-mono text-sm">{selectedStats.linkCount}</div>
                 </div>
               )}
            </div>
          </div>
        )}
        {graph?.stats && (
          <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4 flex items-center justify-between">
            <div>
               <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 mb-1">Global Nodes</div>
               <div className="font-mono font-medium">{graph.stats.num_nodes}</div>
            </div>
            <div>
               <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 mb-1">Global Edges</div>
               <div className="font-mono font-medium">{graph.stats.num_edges}</div>
            </div>
            <div>
               <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 mb-1">Topology Density</div>
               <div className="font-mono font-medium">{Number(graph.stats.density).toFixed(4)}</div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-card rounded-2xl border border-border shadow-2xl p-8 w-full max-w-md mx-4 transform scale-100 transition-all">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4">
              <Scissors className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Simulated Removal</h3>
            <p className="text-sm text-foreground/60 mb-6">
              Removed keystone actor: <span className="font-semibold text-foreground">{modal.removed_node}</span>
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="p-4 bg-foreground/[0.02] border border-border/50 rounded-xl">
                <div className="text-[10px] uppercase font-semibold text-foreground/40 mb-2">Original State</div>
                <div className="font-mono text-sm">{JSON.stringify(modal.before_stats)}</div>
              </div>
              <div className="p-4 bg-rose-500/[0.02] border border-rose-500/20 rounded-xl relative">
                <div className="text-[10px] uppercase font-semibold text-rose-500/60 mb-2">Fragmented State</div>
                <div className="font-mono text-sm text-rose-600 dark:text-rose-400">{JSON.stringify(modal.after_stats)}</div>
              </div>
            </div>
            
            <button
              onClick={() => setModal(null)}
              className="w-full py-2.5 rounded-lg bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
            >
              Dismiss Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
