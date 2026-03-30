import { useEffect, useState } from 'react'
import { getPosts } from '../api/client.js'

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
    <div className="glass-card rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Recent Posts</h2>
          <p className="text-sm text-slate-400">Sorted by {sortBy}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter this page..."
            className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="score">Score</option>
            <option value="comments">Comments</option>
            <option value="date">Date</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-xs uppercase">
            <tr className="text-left border-b border-slate-700/60">
              <th className="py-2">Title</th>
              <th className="py-2">Score</th>
              <th className="py-2">Comments</th>
              <th className="py-2">Date</th>
              <th className="py-2">Domain</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post) => (
              <tr
                key={post.id}
                className="border-b border-slate-800/70 hover:bg-slate-800/40 cursor-pointer"
                onClick={() => setExpanded(expanded === post.id ? null : post.id)}
              >
                <td className="py-3 pr-3">
                  <div className="font-medium text-slate-100">{post.title}</div>
                  {expanded === post.id && (
                    <div className="mt-2 text-slate-400 text-xs leading-relaxed">
                      {post.text || 'No text body'}
                      {post.url && (
                        <div className="mt-2 text-indigo-300">{post.url}</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-3">{post.score}</td>
                <td className="py-3">{post.num_comments}</td>
                <td className="py-3">{post.created_date}</td>
                <td className="py-3">{post.domain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="px-3 py-1 rounded-lg border border-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            className="px-3 py-1 rounded-lg border border-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
