import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileCheck2, AlertTriangle, CalendarOff, PlayCircle, Wrench, UsersRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getTodaysTimetable, WORKING_DAYS, PERIODS } from '../services/timetable'
import { getSessionsForDate } from '../services/sessions'
import { getSettings } from '../services/settings'
import { getHolidayForDate } from '../services/holidays'
import { getCancellationsForDate, cancelClass, CANCELLATION_REASONS } from '../services/cancellations'
import { getTodayDayName, getTodayDateStr, formatFriendlyDate, getGreeting } from '../utils/date'
import StatCard from '../components/ui/StatCard'
import CircuitRail from '../components/ui/CircuitRail'
import Modal from '../components/ui/Modal'
import { SelectField, TextAreaField } from '../components/ui/Field'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const dayName = getTodayDayName()
  const dateStr = getTodayDateStr()
  const isWorkingDay = WORKING_DAYS.includes(dayName)

  const [timetable, setTimetable] = useState([])
  const [sessions, setSessions] = useState([])
  const [holiday, setHoliday] = useState(null)
  const [cancellations, setCancellations] = useState(new Map())
  const [loading, setLoading] = useState(isWorkingDay)
  const [error, setError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)

  useEffect(() => {
    if (!isWorkingDay) return
    let cancelledEffect = false
    load()
    return () => {
      cancelledEffect = true
    }

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [tt, sess, hol, cancels] = await Promise.all([
          getTodaysTimetable(dayName),
          getSessionsForDate(dateStr),
          getHolidayForDate(dateStr),
          getCancellationsForDate(dateStr),
        ])
        if (!cancelledEffect) {
          setTimetable(tt)
          setSessions(sess)
          setHoliday(hol)
          setCancellations(cancels)
        }
      } catch (err) {
        if (!cancelledEffect) setError('Could not load today\u2019s classes. Check your connection.')
      } finally {
        if (!cancelledEffect) setLoading(false)
      }
    }
  }, [dayName, dateStr, isWorkingDay])

  const railItems = useMemo(
    () => buildRailItems(timetable, sessions, holiday, cancellations),
    [timetable, sessions, holiday, cancellations]
  )

  const stats = useMemo(() => computeStats(railItems, sessions), [railItems, sessions])
  const needsAttention = useMemo(() => buildNeedsAttention(sessions), [sessions])

  async function handleConfirmCancel({ reason, note }) {
    if (!cancelTarget) return
    await cancelClass({
      timetableId: cancelTarget.id,
      date: dateStr,
      grade: cancelTarget.grade,
      section: cancelTarget.section,
      program: cancelTarget.program,
      reason,
      note,
    })
    setCancellations((prev) => {
      const next = new Map(prev)
      next.set(cancelTarget.id, { timetableId: cancelTarget.id, date: dateStr, reason, note })
      return next
    })
    setCancelTarget(null)
  }

  const trainerName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Trainer')

  const [schoolName, setSchoolName] = useState('')
  useEffect(() => {
    getSettings()
      .then((s) => setSchoolName(s?.schoolName || ''))
      .catch(() => { })
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="font-display font-semibold text-2xl md:text-[28px] text-ink capitalize">
          {getGreeting()}, {trainerName} 👋
        </h1>
        <p className="text-ink-soft text-sm mt-1">
          {formatFriendlyDate()}
          {schoolName && <span className="text-ink-soft/70"> · {schoolName}</span>}
        </p>
      </header>

      {!isWorkingDay ? (
        <NonWorkingDay dayName={dayName} />
      ) : holiday ? (
        <HolidayBanner holiday={holiday} />
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

          <section className="mb-8">
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
                onCancelClass={(item) => setCancelTarget(item)}
              />
            )}
          </section>

          {!loading && !error && needsAttention.length > 0 && (
            <NeedsAttention items={needsAttention} />
          )}
        </>
      )}

      <CancelClassModal
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}

function HolidayBanner({ holiday }) {
  return (
    <div className="border border-line rounded-xl p-8 flex flex-col items-center text-center gap-2 bg-paper-raised">
      <CalendarOff size={28} className="text-ink-soft mb-1" strokeWidth={1.6} />
      <p className="font-display font-medium text-ink">{holiday.name}</p>
      <p className="text-sm text-ink-soft max-w-xs">
        {holiday.description || 'No classes today — enjoy the holiday.'}
      </p>
    </div>
  )
}

function NeedsAttention({ items }) {
  return (
    <section>
      <h2 className="font-display font-semibold text-lg text-ink mb-4">Needs Attention</h2>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 bg-paper-raised border border-line rounded-xl p-3.5"
          >
            <span className="h-7 w-7 rounded-full bg-rust-light flex items-center justify-center shrink-0">
              <item.icon size={14} className="text-rust" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{item.title}</p>
              <p className="text-xs text-ink-soft">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CancelClassModal({ target, onClose, onConfirm }) {
  const [reason, setReason] = useState(CANCELLATION_REASONS[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) {
      setReason(CANCELLATION_REASONS[0])
      setNote('')
    }
  }, [target])

  async function handleSubmit() {
    setSaving(true)
    try {
      await onConfirm({ reason, note })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target ? `Cancel Grade ${target.grade}${target.section}?` : ''}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper">
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-rust text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Cancelling…' : 'Cancel Class'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-soft">
          No attendance will be recorded and this class will be excluded from attendance calculations.
        </p>
        <SelectField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {CANCELLATION_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </SelectField>
        <TextAreaField
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Additional detail…"
        />
      </div>
    </Modal>
  )
}

function buildRailItems(timetable, sessions, holiday, cancellations) {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return timetable
    .map((entry) => {
      const periodMeta = PERIODS.find((p) => p.period === entry.period)
      const startTime = entry.startTime || periodMeta?.start || ''
      const endTime = entry.endTime || periodMeta?.end || ''
      const session = sessions.find((s) => s.timetableId === entry.id)
      const cancellation = cancellations?.get(entry.id)

      const startMin = toMinutes(startTime)
      const endMin = toMinutes(endTime)

      let status = 'upcoming'
      if (holiday) status = 'holiday'
      else if (cancellation) status = 'cancelled'
      else if (session?.status === 'completed') status = 'completed'
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
        cancellation,
      }
    })
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
}

function computeStats(railItems, sessions) {
  // Cancelled/holiday periods are excluded from every count below — they
  // were never conducted, so they shouldn't count against "classes" or
  // dilute the attendance/reports ratios (spec: FEATURE 4).
  const conducted = railItems.filter((i) => i.status !== 'cancelled' && i.status !== 'holiday')
  const totalClasses = conducted.length
  const completedClasses = conducted.filter((i) => i.status === 'completed').length
  const attendanceMarked = sessions.filter((s) => s.attendance?.total > 0).length
  const toolkitIssues = sessions.reduce((count, s) => {
    const issues = (s.toolkits || []).filter((t) => t.status && t.status !== 'returned')
    return count + issues.length
  }, 0)

  return { totalClasses, completedClasses, attendanceMarked, toolkitIssues }
}

/** Simple "Needs Attention" feed (spec: FEATURE 16) — derived entirely from
 * today's sessions, no extra collection or writes required. */
function buildNeedsAttention(sessions) {
  const items = []

  sessions.forEach((s) => {
    ; (s.groupProgress || [])
      .filter((g) => g.status === 'needs-help')
      .forEach((g) => {
        items.push({
          icon: UsersRound,
          title: `${g.groupName || 'Group'} · Grade ${s.grade}${s.section}`,
          detail: g.remarks || 'Marked as needing help.',
        })
      })
      ; (s.toolkits || [])
        .filter((t) => t.status && t.status !== 'returned')
        .forEach((t) => {
          items.push({
            icon: Wrench,
            title: `Toolkit ${t.toolkitId || t.group}`,
            detail: t.issueNote || (t.status === 'missing' ? 'Missing component' : 'Damaged'),
          })
        })
  })

  return items
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