import { useEffect, useState } from 'react'
import { getStats } from '../api/client.js'
import { FileText, Calendar, MessageCircle, TrendingUp } from 'lucide-react'

const Card = ({ label, value, icon: Icon, trend }) => (
  <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
    <div className="flex items-start justify-between">
      <div className="text-sm font-medium text-foreground/60">{label}</div>
      <div className="p-2 bg-primary/10 rounded-lg text-primary">
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div className="mt-4">
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
      {trend && (
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="text-emerald-500 font-medium">{trend}</span>
          <span className="text-foreground/40">vs last cycle</span>
        </div>
      )}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="glass-card rounded-lg p-6 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  const dateRange = stats.date_range
    ? `${stats.date_range.start ? stats.date_range.start.slice(5) : 'N/A'} - ${stats.date_range.end ? stats.date_range.end.slice(5) : 'N/A'}`
    : 'N/A'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card icon={FileText} label="Total Posts" value={stats.total_posts.toLocaleString()} trend="+12%" />
      <Card icon={Calendar} label="Date Range" value={dateRange} />
      <Card icon={MessageCircle} label="Total Comments" value={stats.total_comments.toLocaleString()} trend="+8%" />
      <Card icon={TrendingUp} label="Average Score" value={stats.avg_score} />
    </div>
  )
}
