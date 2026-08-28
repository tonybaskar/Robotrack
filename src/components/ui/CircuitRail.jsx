import { MapPin, Wrench, Check, ArrowRight, CalendarOff, Ban } from 'lucide-react'
import Badge, { programTone } from './Badge'

// Renders today's classes as a vertical circuit trace: each period is a node
// on the line, wired to the next like a schematic. Node fill communicates
// state at a glance - filled sage (done), pulsing amber (now), outline (next).
export default function CircuitRail({ items, onStartClass, onCancelClass }) {
  if (items.length === 0) return null

  return (
    <div className="relative pl-2">
      {items.map((item, idx) => (
        <RailItem
          key={item.id}
          item={item}
          isLast={idx === items.length - 1}
          onStartClass={onStartClass}
          onCancelClass={onCancelClass}
        />
      ))}
    </div>
  )
}

function RailItem({ item, isLast, onStartClass, onCancelClass }) {
  const { status } = item // 'completed' | 'current' | 'upcoming' | 'cancelled' | 'holiday'

  const nodeClasses = {
    completed: 'bg-sage border-sage',
    current: 'bg-amber border-amber',
    upcoming: 'bg-paper-raised border-line',
    cancelled: 'bg-paper-raised border-rust/50',
    holiday: 'bg-paper-raised border-line',
  }[status]

  return (
    <div className="flex gap-4 relative">
      {/* trace + node */}
      <div className="flex flex-col items-center">
        <div
          className={`relative h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center ${nodeClasses}`}
        >
          {status === 'current' && (
            <span className="absolute inset-0 rounded-full bg-amber animate-ping opacity-40" />
          )}
          {status === 'completed' && <Check size={13} className="text-white" strokeWidth={3} />}
          {status === 'cancelled' && <Ban size={13} className="text-rust" strokeWidth={2.4} />}
          {status === 'holiday' && <CalendarOff size={13} className="text-ink-soft" strokeWidth={2.4} />}
          {(status === 'current' || status === 'upcoming') && (
            <span
              className={`h-2 w-2 rounded-full ${status === 'current' ? 'bg-white' : 'bg-line'
                }`}
            />
          )}
        </div>
        {!isLast && (
          <div
            className="w-px flex-1 my-1 min-h-10"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, var(--color-line) 0 4px, transparent 4px 8px)',
            }}
          />
        )}
      </div>

      {/* card */}
      <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
        <div
          className={`rounded-xl border p-4 transition-colors ${status === 'current'
              ? 'border-amber bg-amber-light/40'
              : status === 'cancelled'
                ? 'border-rust/40 bg-rust-light/30'
                : 'border-line bg-paper-raised'
            }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono-data text-xs text-ink-soft mb-1">
                {item.startTime} – {item.endTime} · {item.periodLabel}
              </p>
              <p className="font-display font-semibold text-base text-ink truncate">
                Grade {item.grade}{item.section}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {status === 'cancelled' && <Badge tone="rust">Cancelled</Badge>}
              {status === 'holiday' && <Badge tone="neutral">Holiday</Badge>}
              <Badge tone={programTone(item.program)}>{item.program}</Badge>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {item.room && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {item.room}
              </span>
            )}
            {item.kitName && (
              <span className="flex items-center gap-1">
                <Wrench size={12} /> {item.kitName}
              </span>
            )}
          </div>

          {status === 'cancelled' && (
            <p className="mt-3 text-xs text-rust font-medium">
              Reason: {item.cancellation?.reason || 'Cancelled'}
            </p>
          )}
          {status === 'holiday' && <p className="mt-3 text-xs text-ink-soft font-medium">No class today</p>}

          {(status === 'current' || status === 'upcoming') && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => onStartClass?.(item)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${status === 'current'
                    ? 'bg-blueprint-dark text-white hover:bg-blueprint'
                    : 'bg-paper text-ink-soft border border-line hover:border-blueprint hover:text-blueprint'
                  }`}
              >
                {status === 'current' ? 'Start Class' : 'Start Early'}
                <ArrowRight size={14} />
              </button>
              {onCancelClass && (
                <button
                  onClick={() => onCancelClass(item)}
                  aria-label="Cancel this class"
                  className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-ink-soft border border-line hover:border-rust hover:text-rust transition-colors"
                >
                  <Ban size={15} />
                </button>
              )}
            </div>
          )}
          {status === 'completed' && <p className="mt-3 text-xs text-sage font-medium">Class completed</p>}
        </div>
      </div>
    </div>
  )
}
