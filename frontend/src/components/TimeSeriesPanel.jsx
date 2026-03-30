import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { getTimeSeries, getTopicTrend } from '../api/client.js'

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
    return <div className="glass-card rounded-xl p-6 animate-pulse h-64" />
  }

  const volumeData =
    granularity === 'week'
      ? data.posts_per_week.map((d) => ({ date: d.week, count: d.count }))
      : data.posts_per_day

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Time Series Analysis</h2>
          <p className="text-sm text-slate-400">Temporal signals with narrative summaries.</p>
        </div>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-lg text-sm ${
                activeTab === tab ? 'bg-indigo-500/20 text-indigo-200' : 'bg-slate-800/70 text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Post Volume' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setGranularity('day')}
              className={`px-3 py-1 rounded-md text-xs ${
                granularity === 'day' ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800/70'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setGranularity('week')}
              className={`px-3 py-1 rounded-md text-xs ${
                granularity === 'week' ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800/70'
              }`}
            >
              Week
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="countFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#countFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg bg-slate-800/70 p-4 italic text-slate-300">
            {granularity === 'week' ? data.summaries?.posts_per_week : data.summaries?.posts_per_day}
          </div>
        </div>
      )}

      {activeTab === 'Score Trend' && (
        <div className="space-y-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.score_trend}>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_score" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg bg-slate-800/70 p-4 italic text-slate-300">
            {data.summaries?.score_trend}
          </div>
        </div>
      )}

      {activeTab === 'Topic Explorer' && (
        <div className="space-y-4">
          <form onSubmit={handleTopicSearch} className="flex gap-3">
            <input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Enter a keyword or phrase"
              className="flex-1 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm"
            />
            <button className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100">Search</button>
          </form>

          {topicData && (
            <div className="space-y-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicData.data}>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {topicData.summary && (
                <div className="rounded-lg bg-slate-800/70 p-4 italic text-slate-300">{topicData.summary}</div>
              )}
              <div className="rounded-lg bg-slate-800/70 p-4 text-slate-300">
                <div className="text-sm font-semibold mb-2">Matching titles</div>
                <ul className="space-y-1 text-xs text-slate-400">
                  {topicData.data.flatMap((d) => d.matching_posts_titles || []).slice(0, 10).map((title, idx) => (
                    <li key={idx}>{title}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
