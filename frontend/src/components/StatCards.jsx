import { useEffect, useState } from 'react'
import { FileText, Calendar, MessageSquare, ThumbsUp } from 'lucide-react'
import { getStats } from '../api/client.js'

const Card = ({ icon: Icon, label, value, accent }) => (
  <div className="glass-card rounded-xl p-5 flex items-center gap-4">
    <div className={`rounded-lg p-3 ${accent}`}>
      <Icon size={20} />
    </div>
    <div>
      <div className="text-sm text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  </div>
)

export default function StatCards() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => setStats(null))
  }, [])

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="glass-card rounded-xl p-5 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  const dateRange = stats.date_range
    ? `${stats.date_range.start || 'N/A'} - ${stats.date_range.end || 'N/A'}`
    : 'N/A'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card icon={FileText} label="Total Posts" value={stats.total_posts} accent="bg-indigo-500/20 text-indigo-200" />
      <Card icon={Calendar} label="Date Range" value={dateRange} accent="bg-sky-500/20 text-sky-200" />
      <Card icon={MessageSquare} label="Total Comments" value={stats.total_comments} accent="bg-emerald-500/20 text-emerald-200" />
      <Card icon={ThumbsUp} label="Average Score" value={stats.avg_score} accent="bg-amber-500/20 text-amber-200" />
    </div>
  )
}
