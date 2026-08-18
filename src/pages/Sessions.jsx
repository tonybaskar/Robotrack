import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, AlertTriangle, CopyX } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Badge, { programTone } from '../components/ui/Badge'
import {
  getRecentSessions,
  getAllSessions,
  findDuplicateSessionGroups,
  resolveDuplicateSessions,
} from '../services/sessions'
import { formatShortDate } from '../utils/date'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [duplicateGroups, setDuplicateGroups] = useState([])
  const [resolvingKey, setResolvingKey] = useState(null)

  useEffect(() => {
    load()
    checkForDuplicates()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setSessions(await getRecentSessions())
    } catch {
      setError('Could not load class sessions. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * One-time scan for the Phase 3 duplicate-session bug (see
   * getOrCreateSession in services/sessions.js for the fix and the
   * explanation of why these could exist). Silent when clean — only
   * surfaces a banner if it actually finds something.
   */
  async function checkForDuplicates() {
    try {
      const all = await getAllSessions()
      setDuplicateGroups(findDuplicateSessionGroups(all))
    } catch {
      // Non-critical — the page still works without this check.
    }
  }

  async function handleResolve(group) {
    const key = group[0].timetableId + group[0].date
    setResolvingKey(key)
    try {
      await resolveDuplicateSessions(group)
      setDuplicateGroups((prev) => prev.filter((g) => g[0].timetableId + g[0].date !== key))
      load()
    } catch {
      setError('Could not resolve that duplicate. Check your connection and try again.')
    } finally {
      setResolvingKey(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader
        title="Class Sessions"
        subtitle="Every class you've started or completed, most recent first."
      />

      {duplicateGroups.length > 0 && (
        <DuplicateBanner groups={duplicateGroups} resolvingKey={resolvingKey} onResolve={handleResolve} />
      )}

      {error && (
        <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {loading && <ListSkeleton />}

      {!loading && !error && sessions.length === 0 && (
        <EmptyState
          icon={PlayCircle}
          title="No sessions yet"
          description="Start today's class from the Dashboard and it will show up here automatically."
        />
      )}

      <div className="space-y-2.5">
        {sessions.map((s) => (
          <Link
            key={s.id}
            to={`/sessions/${s.id}`}
            className="flex items-center gap-3 bg-paper-raised border border-line rounded-xl p-4 hover:border-blueprint transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono-data text-xs text-ink-soft">
                {s.day}, {s.date} · {s.periodLabel || `Period ${s.period}`}
              </p>
              <p className="font-display font-medium text-sm text-ink mt-0.5">
                Grade {s.grade}{s.section}{s.activityName ? ` · ${s.activityName}` : ''}
              </p>
            </div>
            <Badge tone={programTone(s.program)}>{s.program}</Badge>
            <Badge tone={s.status === 'completed' ? 'sage' : 'neutral'}>
              {s.status === 'completed' ? 'Completed' : 'In Progress'}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}

function DuplicateBanner({ groups, resolvingKey, onResolve }) {
  return (
    <div className="mb-6 border border-amber/50 bg-amber-light rounded-xl p-4">
      <div className="flex items-start gap-2.5">
        <CopyX size={17} className="text-ink shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-medium text-sm text-ink">
            {groups.length} duplicate {groups.length === 1 ? 'session' : 'sessions'} found
          </p>
          <p className="text-xs text-ink-soft mt-0.5 mb-3">
            From a past bug where the same class could be saved twice — one completed, one stuck
            "in progress". Resolving keeps the completed copy (or the most recent one) and removes
            the duplicate.
          </p>
          <div className="space-y-2">
            {groups.map((group) => {
              const key = group[0].timetableId + group[0].date
              const s = group[0]
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 bg-paper-raised border border-line rounded-lg px-3 py-2"
                >
                  <p className="text-xs text-ink-soft min-w-0 truncate">
                    Grade {s.grade}{s.section} · {formatShortDate(s.date)} · {s.periodLabel || `Period ${s.period}`}
                    <span className="text-ink-soft/70"> — {group.length} copies</span>
                  </p>
                  <button
                    onClick={() => onResolve(group)}
                    disabled={resolvingKey === key}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
                  >
                    {resolvingKey === key ? 'Resolving…' : 'Resolve'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}