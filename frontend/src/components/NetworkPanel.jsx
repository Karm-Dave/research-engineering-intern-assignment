import { useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { getNetwork, getRemoveTopNodeAnalysis } from '../api/client.js'

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
    <div className="glass-card rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Network Explorer</h2>
          <p className="text-sm text-slate-400">Inspect sharing dynamics and key actors.</p>
        </div>
        <button
          onClick={handleRemoveTop}
          className="px-4 py-2 rounded-lg bg-red-500/20 text-red-200 border border-red-500/40"
        >
          Remove Top Node
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="h-[520px] rounded-xl border border-slate-800">
          {loading || !graph ? (
            <div className="h-full flex items-center justify-center text-slate-400">Loading network...</div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              nodeLabel={(node) => `${node.label}
Score: ${node.score?.toFixed(4)}`}
              nodeRelSize={4}
              linkDirectionalArrowLength={4}
              nodeColor={(node) => node.color}
              nodeVal={(node) => node.size}
              linkWidth={(link) => Math.max(1, link.weight || 1)}
              linkColor={() => 'rgba(148,163,184,0.35)'}
              onNodeClick={(node) => setSelectedNode(node)}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 p-4">
            <div className="text-sm uppercase text-slate-500">Controls</div>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setType('domain')}
                  className={`px-3 py-2 rounded-lg text-xs ${type === 'domain' ? 'bg-indigo-500/30' : 'bg-slate-800/70'}`}
                >
                  Domain Network
                </button>
                <button
                  onClick={() => setType('author')}
                  className={`px-3 py-2 rounded-lg text-xs ${type === 'author' ? 'bg-indigo-500/30' : 'bg-slate-800/70'}`}
                >
                  Author Network
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMetric('pagerank')}
                  className={`px-3 py-2 rounded-lg text-xs ${metric === 'pagerank' ? 'bg-sky-500/30' : 'bg-slate-800/70'}`}
                >
                  PageRank
                </button>
                <button
                  onClick={() => setMetric('betweenness')}
                  className={`px-3 py-2 rounded-lg text-xs ${metric === 'betweenness' ? 'bg-sky-500/30' : 'bg-slate-800/70'}`}
                >
                  Betweenness
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-500">Top N nodes: {topN}</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 p-4">
            <div className="text-sm uppercase text-slate-500">Top Nodes</div>
            <div className="mt-3 space-y-2">
              {topNodes.map((node, idx) => (
                <div key={node.id} className="flex items-center gap-3">
                  <div className="text-xs text-slate-500 w-6">{idx + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-200 truncate">{node.label}</div>
                    <div className="h-1 bg-slate-800 rounded">
                      <div className="h-1 bg-indigo-400 rounded" style={{ width: `${Math.min(node.size * 2, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>


          {selectedNode && (
            <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
              <div className="text-xs uppercase text-slate-500">Selected node</div>
              <div className="mt-2 font-semibold">{selectedNode.label}</div>
              <div className="text-xs text-slate-400">Score: {selectedNode.score?.toFixed(4)}</div>
              {selectedStats && (
                <div className="text-xs text-slate-400">Links: {selectedStats.linkCount} | Weight: {selectedStats.weightSum}</div>
              )}
            </div>
          )}

          {graph?.stats && (
            <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">
              <div>Nodes: {graph.stats.num_nodes}</div>
              <div>Edges: {graph.stats.num_edges}</div>
              <div>Density: {graph.stats.density}</div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center">
          <div className="glass-card rounded-xl p-6 w-[420px]">
            <h3 className="text-lg font-semibold mb-2">Remove Top Node Analysis</h3>
            <p className="text-sm text-slate-400 mb-4">Removed node: {modal.removed_node}</p>
            <div className="text-sm text-slate-300 space-y-2">
              <div>Before: {JSON.stringify(modal.before_stats)}</div>
              <div>After: {JSON.stringify(modal.after_stats)}</div>
            </div>
            <button
              onClick={() => setModal(null)}
              className="mt-4 px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
