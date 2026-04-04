import { useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { getNetwork } from '../api/client.js'
import { Network, Activity, Settings2 } from 'lucide-react'

export default function NetworkPanel() {
  const [type, setType] = useState('domain')
  const [metric, setMetric] = useState('pagerank')
  const [topN, setTopN] = useState(50)
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => {
    setLoading(true)
    getNetwork(type, metric, topN)
      .then(setGraph)
      .finally(() => setLoading(false))
  }, [type, metric, topN])

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const linkColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
  const linkColorActive = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.5)';
  const linkColorMuted = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

  const graphData = graph ? { nodes: graph.nodes || [], links: graph.edges || [] } : { nodes: [], links: [] }

  const topNodes = graph?.nodes
    ? [...graph.nodes].sort((a, b) => b.score - a.score).slice(0, 10)
    : []


  const getNodeId = (val) => (val && typeof val === 'object' ? val.id : val)
  const selectedId = selectedNode?.id
  const neighborIds = (() => {
    const set = new Set()
    if (!selectedId || !graph?.edges) return set
    for (const edge of graph.edges) {
      const src = getNodeId(edge.source)
      const tgt = getNodeId(edge.target)
      if (src === selectedId || tgt === selectedId) {
        if (src) set.add(src)
        if (tgt) set.add(tgt)
      }
    }
    return set
  })()
  const isLinkActive = (link) => {
    if (!selectedId) return false
    const src = getNodeId(link.source)
    const tgt = getNodeId(link.target)
    return src === selectedId || tgt === selectedId
  }
  const isNodeActive = (node) => {
    if (!selectedId) return true
    return node.id === selectedId || neighborIds.has(node.id)
  }


  const selectedStats = (() => {
    if (!selectedNode || !graph) return null
    const edges = graph.edges || []
    const linkCount = edges.filter((e) => {
      const src = getNodeId(e.source)
      const tgt = getNodeId(e.target)
      return src === selectedNode.id || tgt === selectedNode.id
    }).length
    const weightSum = edges.reduce((sum, e) => {
      const src = getNodeId(e.source)
      const tgt = getNodeId(e.target)
      if (src === selectedNode.id || tgt === selectedNode.id) {
        return sum + (e.weight || 1)
      }
      return sum
    }, 0)
    return { linkCount, weightSum }
  })()
  const metricLabel = metric === 'pagerank' ? 'PageRank' : 'Betweenness'
  const typeLabel = type === 'domain' ? 'Author to Domain' : 'Author to Author'
  const edgeLabel = type === 'domain'
    ? 'Edges represent an author posting a link to a domain.'
    : 'Edges represent crossposts or shared domains between authors.'
  const nodeLegend = type === 'domain'
    ? 'Blue nodes are authors; amber nodes are domains.'
    : 'Blue nodes are authors.'

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-6 transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10 pointer-events-auto">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Network Explorer</h2>
          <p className="text-sm text-foreground/50 mt-1">Inspect sharing dynamics and key actors.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="h-[560px] rounded-xl border border-border/60 bg-foreground/[0.01] overflow-hidden flex relative z-0">
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
              d3VelocityDecay={0.6}
              cooldownTicks={120}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              nodeColor={(node) => (isNodeActive(node) ? node.color : (isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.25)'))}
              nodeVal={(node) => node.size}
              linkWidth={(link) => {
                const w = Math.max(1.6, Math.sqrt(link.weight || 1) * 1.4)
                return isLinkActive(link) ? w * 1.9 : w
              }}
              linkColor={(link) => {
                if (selectedId) return isLinkActive(link) ? linkColorActive : linkColorMuted
                return linkColor
              }}
              onNodeClick={(node) => setSelectedNode(node)}
            />
          )}
        </div>

        <div className="space-y-4 flex flex-col relative z-10 pointer-events-auto">
        <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-5">
  <div className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-3">Narrative Summary (Groq)</div>
  <p className="text-sm text-foreground/70 leading-relaxed">
    {graph?.summary || 'Summary unavailable. Try a different metric or refresh once data loads.'}
  </p>
</div>

        <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-5">
  <div className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-3">How To Read</div>
  <p className="text-sm text-foreground/70 leading-relaxed">
    This view maps {typeLabel} relationships. Node size reflects {metricLabel} centrality; larger nodes are more influential.
  </p>
  <div className="mt-3 text-xs text-foreground/60 space-y-1">
    <div>{edgeLabel}</div>
    <div>{nodeLegend}</div>
    <div>Click a node to highlight its direct connections.</div>
  </div>
  {graph?.stats && (
    <div className="mt-3 text-xs text-foreground/60">
      Current: {graph.stats.num_nodes} nodes, {graph.stats.num_edges} edges, density {Number(graph.stats.density).toFixed(4)}, components {graph.stats.components}.
    </div>
  )}
</div>

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
    </div>
  )
}
