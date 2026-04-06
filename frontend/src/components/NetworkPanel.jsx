import { useEffect, useState, useRef, useCallback } from 'react'
import { getNetwork } from '../api/client.js'
import { Network, Activity, Settings2 } from 'lucide-react'

/* ── Vivid Contrasting Palette ────────────────────────────── */
const AUTHOR_COLOR = '#e63946'
const DOMAIN_COLOR = '#f4a261'

/* ── Force layout ─────────────────────────────────────────── */
function computeLayout(nodes, edges, width, height) {
  if (!nodes.length) return { nodes: [], edges: [] }

  const nodeMap = new Map()
  const laid = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const r = Math.min(width, height) * 0.30
    const obj = {
      ...n,
      x: width / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: height / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0,
      displayColor: n.type === 'author' ? AUTHOR_COLOR : DOMAIN_COLOR,
    }
    nodeMap.set(n.id, obj)
    return obj
  })

  const laidEdges = edges
    .map((e) => ({
      ...e,
      sourceNode: nodeMap.get(typeof e.source === 'object' ? e.source.id : e.source),
      targetNode: nodeMap.get(typeof e.target === 'object' ? e.target.id : e.target),
    }))
    .filter((e) => e.sourceNode && e.targetNode)

  const iterations = 350
  const repulsion = 2000
  const springK = 0.01
  const idealLen = 70
  const damping = 0.85
  const centerPull = 0.02
  const maxForce = 8 // clamp individual forces to prevent outlier explosions

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        let dx = laid[i].x - laid[j].x
        let dy = laid[i].y - laid[j].y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        let force = Math.min(repulsion / (dist * dist), maxForce)
        let fx = (dx / dist) * force
        let fy = (dy / dist) * force
        laid[i].vx += fx; laid[i].vy += fy
        laid[j].vx -= fx; laid[j].vy -= fy
      }
    }

    // Attraction (spring to ideal length, clamped)
    for (const e of laidEdges) {
      let dx = e.targetNode.x - e.sourceNode.x
      let dy = e.targetNode.y - e.sourceNode.y
      let dist = Math.sqrt(dx * dx + dy * dy) || 1
      let disp = dist - idealLen
      let force = Math.min(Math.abs(disp * springK), maxForce) * Math.sign(disp)
      let fx = (dx / dist) * force
      let fy = (dy / dist) * force
      e.sourceNode.vx += fx; e.sourceNode.vy += fy
      e.targetNode.vx -= fx; e.targetNode.vy -= fy
    }

    // Center pull
    for (const n of laid) {
      n.vx += (width / 2 - n.x) * centerPull
      n.vy += (height / 2 - n.y) * centerPull
      n.vx *= damping; n.vy *= damping
      n.x += n.vx; n.y += n.vy
    }
  }

  // Fit to canvas — use percentile-based bounds to ignore extreme outliers
  const xs = laid.map(n => n.x).sort((a, b) => a - b)
  const ys = laid.map(n => n.y).sort((a, b) => a - b)
  const pct = (arr, p) => arr[Math.floor(arr.length * p)] || arr[0]
  // Use 5th/95th percentile to set bounds, then clamp outliers
  const p5x = pct(xs, 0.03), p95x = pct(xs, 0.97)
  const p5y = pct(ys, 0.03), p95y = pct(ys, 0.97)
  const minX = Math.min(p5x, xs[0]), maxX = Math.max(p95x, xs[xs.length - 1])
  const minY = Math.min(p5y, ys[0]), maxY = Math.max(p95y, ys[ys.length - 1])

  // Use the percentile range for scaling
  const rangeX = p95x - p5x || 1
  const rangeY = p95y - p5y || 1
  const pad = 80
  const scaleX = (width - pad * 2) / rangeX
  const scaleY = (height - pad * 2) / rangeY
  const scale = Math.min(scaleX, scaleY, 1.8)
  const cenX = (p5x + p95x) / 2
  const cenY = (p5y + p95y) / 2

  for (const n of laid) {
    n.x = width / 2 + (n.x - cenX) * scale
    n.y = height / 2 + (n.y - cenY) * scale
    // Clamp to canvas
    n.x = Math.max(pad, Math.min(width - pad, n.x))
    n.y = Math.max(pad, Math.min(height - pad, n.y))
  }

  return { nodes: laid, edges: laidEdges }
}

/* ── Node radius helper ───────────────────────────────────── */
function nodeRadius(size) {
  // Minimum visible radius of 5px, max ~12px
  return Math.max(5, Math.sqrt(size || 15) * 1.4)
}

/* ── Drawing ──────────────────────────────────────────────── */
function drawGraph(ctx, layout, hoveredId, selectedId, neighborIds, hoverNeighborIds, isDark, W, H, transform, graphType, metricName) {
  ctx.save()
  ctx.clearRect(0, 0, W, H)

  // Background
  ctx.fillStyle = isDark ? '#141312' : '#f0ebe2'
  ctx.fillRect(0, 0, W, H)

  // Inline legend
  const lx = 14, ly = 14
  ctx.globalAlpha = 0.92
  ctx.fillStyle = isDark ? 'rgba(30,28,25,0.88)' : 'rgba(250,246,238,0.92)'
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  const legendH = graphType === 'domain' ? 105 : 85
  roundRect(ctx, lx, ly, 195, legendH, 6)
  ctx.fill(); ctx.stroke()

  ctx.globalAlpha = 1
  const txtCol = isDark ? '#e8e0d4' : '#2c1810'
  ctx.fillStyle = txtCol
  ctx.font = 'bold 10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('LEGEND', lx + 10, ly + 15)

  ctx.fillStyle = AUTHOR_COLOR
  ctx.beginPath(); ctx.arc(lx + 20, ly + 34, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = txtCol; ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.fillText('Author', lx + 32, ly + 35)

  if (graphType === 'domain') {
    ctx.fillStyle = DOMAIN_COLOR
    ctx.beginPath(); ctx.arc(lx + 20, ly + 52, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = txtCol
    ctx.fillText('Domain', lx + 32, ly + 53)
  }

  const infoY = graphType === 'domain' ? ly + 72 : ly + 54
  ctx.fillStyle = isDark ? 'rgba(200,190,175,0.6)' : 'rgba(80,60,40,0.55)'
  ctx.font = '400 8.5px Inter, system-ui, sans-serif'
  ctx.fillText(`Size = ${metricName} centrality`, lx + 10, infoY)
  ctx.fillText('Hover node to glow edges', lx + 10, infoY + 13)

  // Transform
  ctx.translate(transform.x, transform.y)
  ctx.scale(transform.scale, transform.scale)

  const { nodes, edges } = layout
  const activeId = hoveredId || selectedId
  const activeNeighbors = hoveredId ? hoverNeighborIds : neighborIds

  // ── EDGES ── straight lines, always visible
  for (const edge of edges) {
    const src = edge.sourceNode, tgt = edge.targetNode
    const isHighlighted = activeId && (src.id === activeId || tgt.id === activeId)

    if (activeId && isHighlighted) {
      // Glow pass
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.globalAlpha = 0.4
      ctx.strokeStyle = isDark ? '#fbbf24' : '#e67e22'
      ctx.lineWidth = Math.max(5, Math.sqrt(edge.weight || 1) * 3.5)
      ctx.shadowColor = isDark ? '#fbbf24' : '#e67e22'
      ctx.shadowBlur = 15
      ctx.stroke()
      ctx.restore()

      // Sharp line
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.globalAlpha = 1
      const g = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y)
      g.addColorStop(0, src.displayColor)
      g.addColorStop(1, tgt.displayColor)
      ctx.strokeStyle = g
      ctx.lineWidth = Math.max(1.8, Math.sqrt(edge.weight || 1) * 1.3)
      ctx.stroke()
    } else if (activeId) {
      // Dimmed
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.globalAlpha = 0.05
      ctx.strokeStyle = isDark ? '#aaa' : '#555'
      ctx.lineWidth = 0.5
      ctx.stroke()
    } else {
      // Default — ALWAYS visible
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.globalAlpha = isDark ? 0.5 : 0.4
      ctx.strokeStyle = isDark ? 'rgba(220,200,170,0.7)' : 'rgba(100,80,60,0.5)'
      ctx.lineWidth = Math.max(0.8, Math.sqrt(edge.weight || 1) * 0.8)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // ── NODES ── always clearly visible
  for (const node of nodes) {
    const isActive = !activeId || node.id === activeId || activeNeighbors.has(node.id)
    const r = nodeRadius(node.size)
    const color = node.displayColor

    ctx.globalAlpha = isActive ? 1 : 0.2

    // Fill
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
    ctx.fill()

    // White ring for contrast
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Label
    if (r > 4 && transform.scale > 0.35) {
      const label = node.label || node.id
      const fontSize = Math.max(7.5, Math.min(10.5, r * 0.7))
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = isActive ? 0.9 : 0.07
      // Shadow
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'
      const t = label.length > 14 ? label.slice(0, 12) + '…' : label
      ctx.fillText(t, node.x + 0.5, node.y + r + 3.5)
      ctx.fillStyle = isDark ? '#f0ece4' : '#1a1008'
      ctx.fillText(t, node.x, node.y + r + 3)
    }
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/* ── Component ────────────────────────────────────────────── */
export default function NetworkPanel() {
  const [type, setType] = useState('domain')
  const [metric, setMetric] = useState('pagerank')
  const [topN, setTopN] = useState(50)
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const layoutRef = useRef({ nodes: [], edges: [] })
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const animFrameRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    getNetwork(type, metric, topN)
      .then(setGraph)
      .finally(() => setLoading(false))
  }, [type, metric, topN])

  useEffect(() => {
    if (!graph || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const w = rect.width || 800
    const h = rect.height || 560
    const layout = computeLayout(graph.nodes || [], graph.edges || [], w, h)
    layoutRef.current = layout
    transformRef.current = { x: 0, y: 0, scale: 1 }
    requestDraw()
  }, [graph])

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  const getNodeId = (val) => (val && typeof val === 'object' ? val.id : val)
  const selectedId = selectedNode?.id
  const hoveredId = hoveredNode?.id

  const buildNeighborSet = (nodeId) => {
    const set = new Set()
    if (!nodeId || !graph?.edges) return set
    for (const edge of graph.edges) {
      const src = getNodeId(edge.source)
      const tgt = getNodeId(edge.target)
      if (src === nodeId || tgt === nodeId) {
        if (src) set.add(src)
        if (tgt) set.add(tgt)
      }
    }
    return set
  }

  const neighborIds = buildNeighborSet(selectedId)
  const hoverNeighborIds = buildNeighborSet(hoveredId)
  const metricLabel = metric === 'pagerank' ? 'PageRank' : 'Betweenness'

  const requestDraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      ctx.scale(dpr, dpr)
      drawGraph(ctx, layoutRef.current, hoveredId, selectedId, neighborIds, hoverNeighborIds, isDark, rect.width, rect.height, transformRef.current, type, metricLabel)
    })
  }, [selectedId, hoveredId, neighborIds, hoverNeighborIds, isDark, type, metricLabel])

  useEffect(() => { requestDraw() }, [requestDraw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => requestDraw())
    ro.observe(container)
    return () => ro.disconnect()
  }, [requestDraw])

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let isPanning = false
    let lastX = 0, lastY = 0
    let didPan = false

    const handleWheel = (e) => {
      e.preventDefault()
      const t = transformRef.current
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(0.3, Math.min(5, t.scale * delta))
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      t.x = mx - (mx - t.x) * (newScale / t.scale)
      t.y = my - (my - t.y) * (newScale / t.scale)
      t.scale = newScale
      requestDraw()
    }

    const handleMouseDown = (e) => {
      isPanning = true; didPan = false
      lastX = e.clientX; lastY = e.clientY
    }

    const findNodeAt = (clientX, clientY) => {
      if (!layoutRef.current?.nodes?.length) return null
      const rect = canvas.getBoundingClientRect()
      const t = transformRef.current
      const mx = (clientX - rect.left - t.x) / t.scale
      const my = (clientY - rect.top - t.y) / t.scale
      let closest = null, closestDist = Infinity
      for (const node of layoutRef.current.nodes) {
        const r = nodeRadius(node.size) + 4
        const dx = node.x - mx, dy = node.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < r && dist < closestDist) { closest = node; closestDist = dist }
      }
      return closest
    }

    const handleMouseMove = (e) => {
      if (isPanning) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan = true
        lastX = e.clientX; lastY = e.clientY
        transformRef.current.x += dx; transformRef.current.y += dy
        requestDraw()
        return
      }
      const found = findNodeAt(e.clientX, e.clientY)
      setHoveredNode(found)
      canvas.style.cursor = found ? 'pointer' : 'grab'
    }

    const handleMouseUp = () => { isPanning = false }
    const handleMouseLeave = () => { isPanning = false; setHoveredNode(null) }

    const handleClick = (e) => {
      if (didPan) return
      setSelectedNode(findNodeAt(e.clientX, e.clientY))
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('click', handleClick)
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('click', handleClick)
    }
  }, [requestDraw])

  const topNodes = graph?.nodes
    ? [...graph.nodes].sort((a, b) => b.score - a.score).slice(0, 10)
    : []

  const selectedStats = (() => {
    if (!selectedNode || !graph) return null
    const edges = graph.edges || []
    const linkCount = edges.filter((e) => {
      const src = getNodeId(e.source), tgt = getNodeId(e.target)
      return src === selectedNode.id || tgt === selectedNode.id
    }).length
    return { linkCount }
  })()

  const typeLabel = type === 'domain' ? 'Author → Domain' : 'Author ↔ Author'
  const edgeLabel = type === 'domain'
    ? 'Each line = an author linking to a domain. Thicker = more links.'
    : 'Each line = shared domains or crossposts between authors.'

  return (
    <div className="glass-card rounded-lg p-8 transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10 pointer-events-auto">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Network Explorer</h2>
          <p className="text-sm text-foreground/70 mt-1">Who links where? Discover sharing patterns and influential actors.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div ref={containerRef} className="h-[560px] glass-subtle overflow-hidden flex items-center justify-center relative z-0 rounded-xl">
          {loading || !graph ? (
            <div className="w-full flex flex-col items-center justify-center text-foreground/70 gap-3">
              <Network className="w-8 h-8 animate-pulse text-primary/50" />
              <span className="text-sm font-medium">Computing graph architecture...</span>
            </div>
          ) : (
            <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
          )}
        </div>

        <div className="space-y-4 flex flex-col relative z-10 pointer-events-auto">
          <div className="glass-subtle p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-3">How to Read This Graph</div>
            {type === 'domain' ? (
              <div className="text-sm text-foreground/70 leading-relaxed space-y-2">
                <p>
                  This is a <b>bipartite network</b> mapping which <b>authors</b> share links to which <b>domains</b>. 
                  Each edge represents at least one post where an author linked to that domain.
                </p>
                <p>
                  Node size reflects <b>{metricLabel}</b> centrality — {metric === 'pagerank' 
                    ? 'domains receiving links from many authors rank higher, revealing the most-cited sources.' 
                    : 'nodes that act as bridges between otherwise disconnected parts of the network rank higher.'}
                </p>
              </div>
            ) : (
              <div className="text-sm text-foreground/70 leading-relaxed space-y-2">
                <p>
                  This is a <b>co-linking network</b> between <b>authors</b>. Two authors are connected if they 
                  share domains or have crossposted each other's content.
                </p>
                <p>
                  Node size reflects <b>{metricLabel}</b> centrality — {metric === 'pagerank' 
                    ? 'authors connected to many other well-connected authors rank highest, revealing key influencers.' 
                    : 'authors who bridge otherwise separate communities rank highest.'}
                </p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/50" style={{ background: AUTHOR_COLOR }} />
                <span className="text-xs text-foreground/70 font-medium">Authors</span>
              </div>
              {type === 'domain' && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/50" style={{ background: DOMAIN_COLOR }} />
                  <span className="text-xs text-foreground/70 font-medium">Domains</span>
                </div>
              )}
              <div className="text-xs text-foreground/50 ml-auto">Thicker edge = stronger relationship</div>
            </div>
            <div className="mt-2.5 text-xs text-foreground/50 italic">
              Hover a node to highlight its connections · Click to lock focus · Scroll to zoom · Drag to pan
            </div>
            {graph?.stats && (
              <div className="mt-3 pt-2.5 border-t border-border/30 text-xs text-foreground/60 flex flex-wrap gap-x-4 gap-y-1">
                <span><b>{graph.stats.num_nodes}</b> nodes</span>
                <span><b>{graph.stats.num_edges}</b> edges</span>
                <span>density <b>{Number(graph.stats.density).toFixed(4)}</b></span>
                <span><b>{graph.stats.components}</b> component{graph.stats.components !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-4">
              <Settings2 className="w-4 h-4" /> Controls
            </div>
            <div className="space-y-4">
              <div className="flex bg-foreground/5 p-1 rounded-lg">
                <button onClick={() => setType('domain')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${type === 'domain' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground'}`}>Domain</button>
                <button onClick={() => setType('author')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${type === 'author' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground'}`}>Author</button>
              </div>
              <div className="flex bg-foreground/5 p-1 rounded-lg">
                <button onClick={() => setMetric('pagerank')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${metric === 'pagerank' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground'}`}>PageRank</button>
                <button onClick={() => setMetric('betweenness')} className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${metric === 'betweenness' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/70 hover:text-foreground'}`}>Betweenness</button>
              </div>
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-foreground/70">Node Limit</label>
                  <span className="text-xs font-bold text-primary">{topN}</span>
                </div>
                <input type="range" min="10" max="100" value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="w-full accent-primary bg-foreground/10 rounded-lg appearance-none h-1.5 cursor-pointer outline-none" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-4 shrink-0">
              <Activity className="w-4 h-4" /> Top Nodes by {metricLabel}
            </div>
            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide">
              {topNodes.map((node, idx) => (
                <div key={node.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setSelectedNode(node)}>
                  <div className="text-[10px] font-mono text-foreground/70 w-4 text-right">{idx + 1}</div>
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: node.type === 'author' ? AUTHOR_COLOR : DOMAIN_COLOR }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{node.label}</div>
                    <div className="mt-1.5 h-1.5 w-full bg-foreground/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.min(node.size * 2, 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-foreground/50">{node.score?.toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {selectedNode && (
          <div className="glass-subtle p-4 flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Inspecting</div>
              <div className="mt-1 font-semibold text-primary truncate text-lg">{selectedNode.label}</div>
              <div className="text-xs text-foreground/60 mt-1">{selectedNode.type === 'author' ? 'Author' : 'Domain'}</div>
            </div>
            <div className="flex gap-4 border-l border-border/50 pl-4 items-center">
              <div className="text-right">
                <div className="text-[10px] uppercase text-foreground/70 font-semibold mb-0.5">{metricLabel}</div>
                <div className="font-mono text-sm">{selectedNode.score?.toFixed(4)}</div>
              </div>
              {selectedStats && (
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] uppercase text-foreground/70 font-semibold mb-0.5">Connections</div>
                  <div className="font-mono text-sm">{selectedStats.linkCount}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {graph?.stats && (
          <div className="glass-subtle p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">Nodes</div>
              <div className="font-mono font-medium">{graph.stats.num_nodes}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">Edges</div>
              <div className="font-mono font-medium">{graph.stats.num_edges}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">Density</div>
              <div className="font-mono font-medium">{Number(graph.stats.density).toFixed(4)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">Components</div>
              <div className="font-mono font-medium">{graph.stats.components}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
