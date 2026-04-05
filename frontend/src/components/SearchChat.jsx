import { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { chat, search, getDomains } from '../api/client.js'
import { Search, Send, Sparkles, Database, Calendar as CalendarIcon, Filter, ExternalLink } from 'lucide-react'

const sorters = {
  relevance: (a, b) => {
    const aHasText = (a.post?.text || '').trim().length > 0;
    const bHasText = (b.post?.text || '').trim().length > 0;
    if (aHasText && !bHasText) return -1;
    if (!aHasText && bHasText) return 1;
    return b.score - a.score;
  },
  score: (a, b) => (b.post?.score || 0) - (a.post?.score || 0),
  date: (a, b) => (b.post?.created_utc || 0) - (a.post?.created_utc || 0)
}

export default function SearchChat() {
  const getRedditUrl = (post) => {
    if (!post) return ''
    if (post.reddit_url) return post.reddit_url
    if (post.permalink) return `https://www.reddit.com${post.permalink}`
    if (post.subreddit && post.id) return `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}/`
    return ''
  }
  const formatAssistantContent = (content) => {
    if (typeof content !== 'string') return content
    const lines = content.split(/\r?\n/)
    const out = []
    const headingRe = /^([A-Z][A-Z\s]+):\s*(.*)$/
    for (const rawLine of lines) {
      const line = rawLine.trim()
      const match = headingRe.exec(line)
      if (match) {
        const title = match[1].trim()
        const rest = (match[2] || '').trim()
        if (out.length && out[out.length - 1] !== '') out.push('')
        out.push(`### ${title}`)
        if (rest) out.push(rest)
      } else {
        out.push(rawLine)
      }
    }
    return out.join('\n')
  }
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [related, setRelated] = useState([])
  const [queryHistory, setQueryHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [domains, setDomains] = useState([])
  const [domainFilter, setDomainFilter] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  const messagesEndRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  useEffect(() => {
    getDomains().then((data) => setDomains(data || [])).catch(() => setDomains([]))
  }, [])
  
  // Handle cross-workspace search incoming from Layout.jsx
  useEffect(() => {
    if (location.state?.query) {
      const q = location.state.query
      setInput(q)
      // Clear state so it doesn't infinite loop on refresh
      navigate('.', { replace: true, state: {} })
      // Auto trigger the search logic
      triggerSearch(q)
    }
  }, [location.state])

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

  const maxScore = useMemo(() => {
    if (!filteredResults.length) return 0
    return Math.max(...filteredResults.map((r) => r.score || 0))
  }, [filteredResults])

  const triggerSearch = async (queryText) => {
    if (!queryText) return
    if (queryText.length < 3) {
      setMessage('Query too short')
      return
    }

    setLoading(true)
    setMessage('')
    setInput('') // Clear input eagerly

    const userMsg = { role: 'user', content: queryText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    
    setMessages((prev) => [...prev, userMsg])

    const nextHistory = [...queryHistory, queryText].slice(-5)
    setQueryHistory(nextHistory)

    try {
      const [searchRes, chatRes] = await Promise.all([
        search(queryText, 100, domainFilter || null),
        chat(queryText, nextHistory)
      ])

      setResults(searchRes.results || [])
      setRelated(chatRes.related_queries || searchRes.related_queries || [])
      if (searchRes.message) {
        setMessage(searchRes.message)
      }

      const botMsg = {
        role: 'assistant',
        content: chatRes.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: chatRes.sources?.length || 0
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      setMessage("Error searching database.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    triggerSearch(input.trim())
  }

  const handleRelatedClick = (q) => {
    setInput(q)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6 max-w-screen-2xl mx-auto h-[calc(100vh-140px)]">
      
      {/* Search & Chat Panel */}
      <div className="glass-card rounded-lg flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 bg-foreground/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">AI Assistant</h2>
              <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold mt-0.5">Vector Search Augmented</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
               <div className="w-16 h-16 rounded-lg bg-foreground/5 flex items-center justify-center mb-2 shadow-sm border border-border">
                  <Database className="w-8 h-8 text-foreground/40" />
               </div>
               <h3 className="text-xl font-semibold tracking-tight">How can I help you explore?</h3>
               <p className="text-sm text-foreground/60 leading-relaxed">
                 Ask a complex question about themes in your dataset. The system will perform an approximate nearest-neighbor search to retrieve sources.
               </p>
             </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-5 py-4 rounded-lg text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-foreground text-background shadow-premium' 
                      : 'bg-foreground/[0.06] border border-border/50 text-foreground shadow-sm rounded-tl-sm'
                  } ${msg.role === 'user' ? 'rounded-tr-sm' : ''}`}
                >
                  <div className="space-y-3 font-medium">
                    <ReactMarkdown 
                      components={{
                        a: ({node, ...props}) => <a target="_blank" rel="noreferrer" className="text-primary hover:underline" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-semibold tracking-tight text-foreground mt-3" {...props} />
                      }}
                    >
                      {msg.role === 'user' ? msg.content : formatAssistantContent(msg.content)}
                    </ReactMarkdown>
                  </div>
                  
                  <div className={`mt-3 flex items-center gap-3 text-xs font-mono font-medium ${msg.role === 'user' ? 'text-background/50' : 'text-foreground/40'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.sources !== undefined && msg.role !== 'user' && (
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                        Synthesized from {msg.sources} source{msg.sources !== 1 && 's'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
               <div className="max-w-[85%] px-5 py-4 rounded-lg rounded-tl-sm text-sm bg-foreground/[0.06] border border-border/50 flex items-center gap-3 shadow-sm">
                  <span className="flex gap-1">
                     <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                     <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                  </span>
                  <span className="text-foreground/50 font-medium">Scanning vectors...</span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border/30 shrink-0 bg-transparent">
          {related.length > 0 && (
            <div className="mb-3 scrollbar-hide overflow-x-auto whitespace-nowrap pb-2">
              <div className="flex gap-2">
                {related.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleRelatedClick(q)}
                    className="px-3 py-1.5 rounded-lg bg-card border border-border text-[11px] font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm whitespace-nowrap"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="relative flex items-end rounded-lg border border-border/60 bg-foreground/5 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/60 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   handleSubmit(e);
                 }
              }}
              rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
              placeholder="Message the research agent..."
              className="w-full bg-transparent px-4 py-3.5 text-sm text-foreground focus:outline-none resize-none placeholder:text-foreground/40 leading-relaxed"
            />
            <div className="p-2 shrink-0 h-[48px] flex items-center justify-center">
               <button 
                type="submit"
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 disabled:hover:opacity-40 shadow-sm"
               >
                 <Send className="w-4 h-4 ml-0.5" />
               </button>
            </div>
          </form>
          {message && <div className="mt-2 text-xs font-medium text-amber-500 text-center">{message}</div>}
        </div>
      </div>

      {/* Database Results Panel */}
      <div className="glass-card rounded-lg flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex flex-col gap-4 bg-foreground/5 shrink-0">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Source Documents</h2>
            <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold mt-0.5">Semantic Rankings</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[120px]">
              <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40" />
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 rounded-md bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm"
              >
                <option value="">All Domains</option>
                {domains.slice(0, 50).map((d) => (
                  <option key={d.domain} value={d.domain}>{d.domain}</option>
                ))}
              </select>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-md bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="score">Sort: Karma Score</option>
              <option value="date">Sort: Recent</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 text-foreground/60">
             <CalendarIcon className="w-3.5 h-3.5" />
             <input
               type="date"
               value={dateFrom}
               onChange={(e) => setDateFrom(e.target.value)}
               className="flex-1 rounded-md bg-card border border-border px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm"
             />
             <span>to</span>
             <input
               type="date"
               value={dateTo}
               onChange={(e) => setDateTo(e.target.value)}
               className="flex-1 rounded-md bg-card border border-border px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm"
             />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-foreground/[0.04]">
          {filteredResults.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-foreground/40 text-sm">
                No matching documents.<br />Submit a query to scan the vector database.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((r, i) => (
                <div key={r.post?.id || i} className="group rounded-lg border border-border/60 bg-card p-4 hover:border-border hover:shadow-premium-hover transition-all">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="font-semibold text-sm leading-tight text-foreground line-clamp-2">
                       {r.post?.title}
                    </div>
                    <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold shadow-sm">
                      {maxScore ? Math.round((r.score / maxScore) * 100) : 0}
                    </div>
                  </div>
                  <div className="text-xs text-foreground/60 font-mono mb-3 bg-foreground/5 inline-flex p-1 px-2 rounded-md items-center gap-2">
                    <span>{r.post?.domain}</span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span>Score {r.post?.score}</span>
                  </div>
                  <div className="text-sm text-foreground/70 leading-relaxed line-clamp-3 font-serif">
                    {r.post?.text || <span className="italic opacity-50">No text content</span>}
                  </div>
{(() => {
                    const redditUrl = getRedditUrl(r.post)
                    return redditUrl ? (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <a href={redditUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:text-primary/70 transition-colors">
                          Original Source <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : null
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
