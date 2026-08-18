import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileCheck2, AlertTriangle, CalendarOff, PlayCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getTodaysTimetable, WORKING_DAYS, PERIODS } from '../services/timetable'
import { getSessionsForDate } from '../services/sessions'
import { getTodayDayName, getTodayDateStr, formatFriendlyDate, getGreeting } from '../utils/date'
import StatCard from '../components/ui/StatCard'
import CircuitRail from '../components/ui/CircuitRail'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const dayName = getTodayDayName()
  const dateStr = getTodayDateStr()
  const isWorkingDay = WORKING_DAYS.includes(dayName)

  const [timetable, setTimetable] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(isWorkingDay)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isWorkingDay) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [tt, sess] = await Promise.all([
          getTodaysTimetable(dayName),
          getSessionsForDate(dateStr),
        ])
        if (!cancelled) {
          setTimetable(tt)
          setSessions(sess)
        }
      } catch (err) {
        if (!cancelled) setError('Could not load today\u2019s classes. Check your connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dayName, dateStr, isWorkingDay])

  const railItems = useMemo(
    () => buildRailItems(timetable, sessions),
    [timetable, sessions]
  )

  const stats = useMemo(() => computeStats(railItems, sessions), [railItems, sessions])

  const trainerName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Trainer')

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="font-display font-semibold text-2xl md:text-[28px] text-ink capitalize">
          {getGreeting()}, {trainerName} 👋
        </h1>
        <p className="text-ink-soft text-sm mt-1">{formatFriendlyDate()}</p>
      </header>

      {!isWorkingDay ? (
        <NonWorkingDay dayName={dayName} />
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              label="Classes"
              value={`${stats.completedClasses} / ${stats.totalClasses}`}
              sub="Completed"
              icon={PlayCircle}
              tone="ink"
            />
            <StatCard
              label="Attendance"
              value={`${stats.attendanceMarked} / ${stats.totalClasses}`}
              sub="Marked"
              icon={ClipboardCheck}
              tone="sage"
            />
            <StatCard
              label="Reports"
              value={`${stats.completedClasses} / ${stats.totalClasses}`}
              sub="Generated"
              icon={FileCheck2}
              tone="ink"
            />
            <StatCard
              label="Toolkit Issues"
              value={stats.toolkitIssues}
              sub={stats.toolkitIssues > 0 ? 'Needs attention' : 'All clear'}
              icon={AlertTriangle}
              tone={stats.toolkitIssues > 0 ? 'rust' : 'sage'}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-ink">Today's Classes</h2>
              {railItems.length > 0 && (
                <span className="text-xs text-ink-soft font-mono-data">{dayName}</span>
              )}
            </div>

            {loading && <RailSkeleton />}

            {!loading && error && (
              <p className="text-sm text-rust bg-rust-light rounded-lg px-4 py-3">{error}</p>
            )}

            {!loading && !error && railItems.length === 0 && <EmptyTimetable />}

            {!loading && !error && railItems.length > 0 && (
              <CircuitRail
                items={railItems}
                onStartClass={(item) => navigate(`/sessions/start/${item.id}`)}
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function buildRailItems(timetable, sessions) {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return timetable
    .map((entry) => {
      const periodMeta = PERIODS.find((p) => p.period === entry.period)
      const startTime = entry.startTime || periodMeta?.start || ''
      const endTime = entry.endTime || periodMeta?.end || ''
      const session = sessions.find((s) => s.timetableId === entry.id)

      const startMin = toMinutes(startTime)
      const endMin = toMinutes(endTime)

      let status = 'upcoming'
      if (session?.status === 'completed') status = 'completed'
      else if (nowMinutes >= startMin && nowMinutes < endMin) status = 'current'
      else if (nowMinutes >= endMin) status = 'upcoming' // past but not completed - still actionable

      return {
        id: entry.id,
        grade: entry.grade,
        section: entry.section,
        program: entry.program,
        room: entry.room,
        kitName: entry.kitName,
        startTime,
        endTime,
        periodLabel: periodMeta?.label || `Period ${entry.period}`,
        period: entry.period,
        status,
        session,
      }
    })
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}

function computeStats(railItems, sessions) {
  const totalClasses = railItems.length
  const completedClasses = railItems.filter((i) => i.status === 'completed').length
  const attendanceMarked = sessions.filter((s) => s.attendance?.total > 0).length
  const toolkitIssues = sessions.reduce((count, s) => {
    const issues = (s.toolkits || []).filter((t) => t.status && t.status !== 'returned')
    return count + issues.length
  }, 0)

  return { totalClasses, completedClasses, attendanceMarked, toolkitIssues }
}

function toMinutes(time) {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function NonWorkingDay({ dayName }) {
  return (
    <div className="border border-dashed border-line rounded-xl p-8 flex flex-col items-center text-center gap-2">
      <CalendarOff size={28} className="text-ink-soft mb-1" strokeWidth={1.6} />
      <p className="font-display font-medium text-ink">No classes scheduled today</p>
      <p className="text-sm text-ink-soft max-w-xs">
        Classes run Tuesday, Wednesday and Thursday. Today is {dayName} — enjoy the prep time.
      </p>
    </div>
  )
}

function EmptyTimetable() {
  return (
    <div className="border border-dashed border-line rounded-xl p-8 flex flex-col items-center text-center gap-2">
      <CalendarOff size={28} className="text-ink-soft mb-1" strokeWidth={1.6} />
      <p className="font-display font-medium text-ink">No timetable entries for today</p>
      <p className="text-sm text-ink-soft max-w-xs">
        Add today's periods in Timetable so they show up here automatically.
      </p>
    </div>
  )
}

function RailSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-7 w-7 rounded-full bg-line shrink-0" />
          <div className="flex-1 h-28 rounded-xl bg-paper-raised border border-line" />
        </div>
      ))}
    </div>
  )
}
