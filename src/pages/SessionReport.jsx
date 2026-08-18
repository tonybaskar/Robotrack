import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Wrench, Camera } from 'lucide-react'
import { getSession } from '../services/sessions'
import { periodMetaFor } from '../services/timetable'
import Badge, { programTone } from '../components/ui/Badge'

const STATUS_TONE = { returned: 'sage', missing: 'rust', damaged: 'rust' }
const STATUS_LABEL = { returned: 'Returned', missing: 'Missing Component', damaged: 'Damaged' }

export default function SessionReport() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const s = await getSession(sessionId)
      if (!s) {
        setError('This session could not be found.')
      } else {
        setSession(s)
      }
    } catch {
      setError('Unable to load this report. Retry.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-ink-soft">Loading report…</div>
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-3">
        <AlertTriangle size={24} className="text-rust" />
        <p className="text-sm text-ink">{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white">
          Retry
        </button>
      </div>
    )
  }

  const attendance = session.attendance || {}
  const isCompleted = session.status === 'completed'

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <Link to="/sessions" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink mb-4">
        <ArrowLeft size={13} /> Class Sessions
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-semibold text-2xl text-ink">Class Completion Report</h1>
          <p className="text-sm text-ink-soft mt-1">
            {session.day}, {session.date}
          </p>
        </div>
        <Badge tone={isCompleted ? 'sage' : 'neutral'}>
          {isCompleted ? 'Completed' : session.status === 'partial' ? 'Partial' : 'In Progress'}
        </Badge>
      </div>

      <div className="bg-paper-raised border border-line rounded-xl divide-y divide-line overflow-hidden mb-6">
        <ReportRow label="Trainer" value={session.trainerEmail || '—'} />
        <ReportRow
          label="Grade / Section"
          value={`Grade ${session.grade}${session.section || ''}`}
          extra={<Badge tone={programTone(session.program)}>{session.program}</Badge>}
        />
        <ReportRow
          label="Period / Time"
          value={`${session.periodLabel || periodMetaFor(session.period)?.label || `Period ${session.period}`} · ${session.startTime}–${session.endTime}`}
        />
        <ReportRow label="Curriculum" value={session.kitName || '—'} />
        <ReportRow
          label="Activity"
          value={session.activityName || '—'}
          extra={
            session.activityStatus && (
              <Badge tone={session.activityStatus === 'partial' ? 'amber' : 'sage'}>
                {session.activityStatus === 'partial' ? 'Partial' : 'Completed'}
              </Badge>
            )
          }
        />
        {session.activityNote && <ReportRow label="Activity Note" value={session.activityNote} />}
      </div>

      <Section title="Attendance">
        {attendance.total ? (
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Present" value={attendance.present} tone="sage" />
            <MiniStat label="Absent" value={attendance.absent} tone="rust" />
            <MiniStat label="Total" value={attendance.total} tone="ink" />
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Not recorded.</p>
        )}
      </Section>

      <Section title="Toolkit Status" icon={Wrench}>
        {session.toolkits?.length ? (
          <div className="space-y-2">
            {session.toolkits.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 bg-paper-raised border border-line rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink font-mono-data">{t.toolkitId || '—'}</p>
                  <p className="text-xs text-ink-soft">{t.group}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge tone={STATUS_TONE[t.status] || 'neutral'}>{STATUS_LABEL[t.status] || t.status}</Badge>
                  {t.issueNote && <p className="text-[11px] text-rust mt-1">{t.issueNote}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No toolkits tracked.</p>
        )}
      </Section>

      <Section title="Photos" icon={Camera}>
        {session.photos?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {session.photos.map((p, idx) => (
              <a key={p.publicId || idx} href={p.url} target="_blank" rel="noreferrer" className="block">
                <div className="aspect-square rounded-lg overflow-hidden border border-line bg-paper">
                  <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover" />
                </div>
                {p.caption && <p className="text-[11px] text-ink-soft mt-1 truncate">{p.caption}</p>}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No photos uploaded.</p>
        )}
      </Section>

      <Section title="Remarks">
        <p className="text-sm text-ink whitespace-pre-wrap">{session.remarks || 'No remarks added.'}</p>
      </Section>

      {isCompleted && (
        <div className="flex items-center gap-2 mt-6 text-sm text-sage">
          <CheckCircle2 size={16} /> Session saved to Firestore.
        </div>
      )}
    </div>
  )
}

function ReportRow({ label, value, extra }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <span className="text-xs text-ink-soft font-mono-data uppercase tracking-wide shrink-0 pt-0.5">{label}</span>
      <div className="text-right min-w-0 flex items-center gap-2 justify-end flex-wrap">
        <span className="text-sm text-ink font-medium">{value}</span>
        {extra}
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="mb-6">
      <h2 className="flex items-center gap-1.5 font-display font-semibold text-sm text-ink mb-3">
        {Icon && <Icon size={14} className="text-ink-soft" />}
        {title}
      </h2>
      {children}
    </section>
  )
}

function MiniStat({ label, value, tone }) {
  const toneClasses = { sage: 'text-sage', rust: 'text-rust', ink: 'text-ink' }
  return (
    <div className="bg-paper-raised border border-line rounded-lg py-2.5 text-center">
      <p className={`font-display font-semibold text-lg ${toneClasses[tone]}`}>{value ?? 0}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-soft font-mono-data">{label}</p>
    </div>
  )
}
