import { useEffect, useState } from 'react'
import { getPosts } from '../api/client.js'
import { Search, ChevronLeft, ChevronRight, MessageSquare, ArrowUpRight, Clock } from 'lucide-react'

export default function PostTable() {
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('score')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)
  const perPage = 20

  useEffect(() => {
    getPosts(page, perPage, sortBy)
      .then((data) => {
        setPosts(data.posts || [])
        setTotal(data.total || 0)
      })
      .catch(() => {
        setPosts([])
        setTotal(0)
      })
  }, [page, sortBy])

  const filtered = posts.filter((p) => {
    if (!query) return true
    const hay = `${p.title || ''} ${p.text || ''}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  })

  const totalPages = Math.max(Math.ceil(total / perPage), 1)

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="p-6 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Dataset Explorer</h2>
          <p className="text-sm text-foreground/50 mt-1">Browse and filter the indexed {total} documents.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter page..."
              className="w-48 pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
          >
            <option value="score">Top Score</option>
            <option value="comments">Most Comments</option>
            <option value="date">Most Recent</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-foreground/60 uppercase tracking-wider bg-foreground/5">
            <tr>
              <th className="px-6 py-4 font-medium">Document Title</th>
              <th className="px-6 py-4 font-medium">Domain</th>
              <th className="px-6 py-4 font-medium text-right">Score</th>
              <th className="px-6 py-4 font-medium text-right">Comments</th>
              <th className="px-6 py-4 font-medium text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((post) => (
              <tr
                key={post.id}
                className={`hover:bg-foreground/[0.05] cursor-pointer transition-colors ${expanded === post.id ? 'bg-primary/[0.02]' : ''}`}
                onClick={() => setExpanded(expanded === post.id ? null : post.id)}
              >
                <td className="px-6 py-4 text-foreground">
                  <div className="font-medium flex items-center gap-2">
                    {post.title}
                    {expanded === post.id && <ArrowUpRight className="w-3 h-3 text-primary" />}
                  </div>
                  {expanded === post.id && (
                    <div className="mt-3 text-foreground/70 text-sm leading-relaxed max-w-2xl bg-foreground/5 p-4 rounded-lg border border-border/50">
                      {post.text || <span className="italic text-foreground/40">No text body provided.</span>}
                      {post.url && (
                        <a href={post.url} target="_blank" rel="noreferrer" className="block mt-3 text-primary hover:text-primary/80 font-medium truncate">
                          {post.url}
                        </a>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-foreground/60">
                  <span className="px-2 py-1 bg-foreground/5 rounded-md text-xs font-mono">{post.domain}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-1 font-mono font-medium">
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    {post.score}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-1.5 text-foreground/60 font-mono">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {post.num_comments}
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-foreground/50 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {post.created_date}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-foreground/50">
                  No documents found matching your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-border/30 flex items-center justify-between text-sm text-foreground/60 bg-foreground/5">
        <div>
          Showing page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span>
        </div>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="p-1.5 rounded-md border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            className="p-1.5 rounded-md border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
