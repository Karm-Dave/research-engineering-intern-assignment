import { useEffect, useMemo, useState } from 'react'
import { chat, search, getDomains } from '../api/client.js'

const sorters = {
  relevance: (a, b) => b.score - a.score,
  score: (a, b) => (b.post?.score || 0) - (a.post?.score || 0),
  date: (a, b) => (b.post?.created_utc || 0) - (a.post?.created_utc || 0)
}

export default function SearchChat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(false)
  const [domains, setDomains] = useState([])
  const [domainFilter, setDomainFilter] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    getDomains().then((data) => setDomains(data || [])).catch(() => setDomains([]))
  }, [])

  const filteredResults = useMemo(() => {
    let list = [...results]
    if (domainFilter) {
      list = list.filter((r) => r.post?.domain === domainFilter)
    }
    if (dateFrom) {
      list = list.filter((r) => (r.post?.created_date || '') >= dateFrom)
    }
    if (dateTo) {
      list = list.filter((r) => (r.post?.created_date || '') <= dateTo)
    }
    return list.sort(sorters[sortBy])
  }, [results, domainFilter, dateFrom, dateTo, sortBy])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const query = input.trim()
    if (!query) {
      setMessage('Please enter a query')
      return
    }
    if (query.length < 3) {
      setMessage('Query too short')
      return
    }

    setLoading(true)
    setMessage('')

    const userMsg = { role: 'user', content: query, timestamp: new Date().toLocaleTimeString() }
    setMessages((prev) => [...prev, userMsg])

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

    const [searchRes, chatRes] = await Promise.all([
      search(query, 10, domainFilter || null),
      chat(query, history)
    ])

    setResults(searchRes.results || [])
    setRelated(searchRes.related_queries || [])
    if (searchRes.message) {
      setMessage(searchRes.message)
    }

    const botMsg = {
      role: 'assistant',
      content: chatRes.response,
      timestamp: new Date().toLocaleTimeString(),
      sources: chatRes.sources?.length || 0
    }
    setMessages((prev) => [...prev, botMsg])
    setLoading(false)
  }

  const handleRelatedClick = (q) => {
    setInput(q)
    const event = { preventDefault: () => {} }
    handleSubmit(event)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
      <div className="glass-card rounded-xl p-5 flex flex-col h-[680px]">
        <div className="flex-1 overflow-auto space-y-4 scrollbar-hide">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-xl text-sm ${
                  msg.role === 'user' ? 'bg-indigo-500/40 text-white' : 'bg-slate-700/70 text-slate-100'
                }`}
              >
                <div className="text-xs text-slate-300 mb-1">{msg.timestamp}</div>
                {msg.content}
                {msg.sources !== undefined && msg.role !== 'user' && (
                  <div className="mt-2 text-xs text-slate-300">Based on {msg.sources} posts</div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-sm text-slate-400 animate-pulse">Thinking...</div>
          )}
        </div>

        <div className="mt-4">
          {related.length > 0 && (
            <div className="mb-2 text-xs text-slate-400">Related queries:</div>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            {related.map((q) => (
              <button
                key={q}
                onClick={() => handleRelatedClick(q)}
                className="px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-300"
              >
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="Ask a question or search the dataset..."
              className="flex-1 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm"
            />
            <button className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100">Send</button>
          </form>
          {message && <div className="mt-2 text-xs text-amber-300">{message}</div>}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Search Results</h2>
          <p className="text-sm text-slate-400">Ranked by semantic relevance.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs"
          >
            <option value="">All domains</option>
            {domains.slice(0, 50).map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.domain}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs"
          >
            <option value="relevance">Relevance</option>
            <option value="score">Score</option>
            <option value="date">Date</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs"
          />
        </div>

        {filteredResults.length === 0 ? (
          <div className="text-sm text-slate-400">No relevant posts found. Try broader terms.</div>
        ) : (
          <div className="space-y-3 max-h-[540px] overflow-auto scrollbar-hide">
            {filteredResults.map((r) => (
              <div key={r.post?.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-sm">{r.post?.title}</div>
                  <div className="text-xs text-emerald-300">{Math.round(r.score * 100)}%</div>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Score {r.post?.score} | {r.post?.created_date} | {r.post?.domain}
                </div>
                <div className="text-xs text-slate-300 mt-2">
                  {(r.post?.text || '').slice(0, 160)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
