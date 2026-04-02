import { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid
} from 'recharts'
import { getTimeSeries, getTopicTrend } from '../api/client.js'
import { Search } from 'lucide-react'

const tabs = ['Post Volume', 'Score Trend', 'Topic Explorer']

export default function TimeSeriesPanel() {
  const [activeTab, setActiveTab] = useState(tabs[0])
  const [granularity, setGranularity] = useState('day')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [topicInput, setTopicInput] = useState('')
  const [topicData, setTopicData] = useState(null)

  useEffect(() => {
    setLoading(true)
    getTimeSeries(granularity)
      .then((res) => {
        setData(res)
      })
      .finally(() => setLoading(false))
  }, [granularity])

  const handleTopicSearch = async (e) => {
    e.preventDefault()
    if (!topicInput.trim()) return
    const res = await getTopicTrend(topicInput.trim())
    setTopicData(res)
  }

  if (loading || !data) {
    return <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-pulse h-96" />
  }

  const volumeData =
    granularity === 'week'
      ? data.posts_per_week.map((d) => ({ date: d.week, count: d.count }))
      : data.posts_per_day

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    borderColor: 'var(--border)',
    color: 'var(--card-foreground)',
    borderRadius: '0.5rem',
    boxShadow: 'var(--tw-shadow)',
    fontSize: '0.875rem'
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Time Series Analysis</h2>
          <p className="text-sm text-foreground/50 mt-1">Temporal signals with automated narrative summaries.</p>
        </div>
        <div className="flex bg-foreground/5 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab 
                  ? 'bg-card text-foreground shadow-sm' 
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Post Volume' && (
        <div className="space-y-6">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setGranularity('day')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                granularity === 'day' ? 'bg-primary/10 text-primary' : 'text-foreground/50 hover:bg-foreground/5'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setGranularity('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                granularity === 'week' ? 'bg-primary/10 text-primary' : 'text-foreground/50 hover:bg-foreground/5'
              }`}
            >
              Weekly
            </button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="countFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} fill="url(#countFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl bg-foreground/[0.02] border border-border/50 p-5 mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-2">Automated Insight</h4>
            <p className="text-sm text-foreground/80 leading-relaxed font-serif italic">
              {granularity === 'week' ? data.summaries?.posts_per_week : data.summaries?.posts_per_day}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'Score Trend' && (
        <div className="space-y-6">
          <div className="h-[300px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.score_trend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border)' }} />
                <Line type="monotone" dataKey="avg_score" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl bg-foreground/[0.02] border border-border/50 p-5 mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-2">Trend Analysis</h4>
            <p className="text-sm text-foreground/80 leading-relaxed font-serif italic">
              {data.summaries?.score_trend}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'Topic Explorer' && (
        <div className="space-y-6">
          <form onSubmit={handleTopicSearch} className="flex gap-3 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Query a topic keyword..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
            </div>
            <button className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-sm hover:opacity-90 transition-opacity">
              Explore
            </button>
          </form>

          {topicData && (
            <div className="space-y-6 mt-8 animate-in fade-in duration-500">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicData.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis tick={{ fill: 'var(--foreground)', opacity: 0.5, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--foreground)', opacity: 0.05 }} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topicData.summary && (
                  <div className="rounded-xl bg-foreground/[0.02] border border-border/50 p-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-2">Topic Context</h4>
                    <p className="text-sm text-foreground/80 leading-relaxed font-serif italic">{topicData.summary}</p>
                  </div>
                )}
                <div className="rounded-xl bg-foreground/[0.02] border border-border/50 p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-3">Matching Titles</h4>
                  <ul className="space-y-2 text-sm text-foreground/70">
                    {topicData.data.flatMap((d) => d.matching_posts_titles || []).slice(0, 5).map((title, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="line-clamp-2">{title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
