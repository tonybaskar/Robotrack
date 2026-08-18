export default function StatCard({ label, value, sub, icon: Icon, tone = 'ink' }) {
  const toneClasses = {
    ink: 'text-ink',
    sage: 'text-sage',
    amber: 'text-amber',
    rust: 'text-rust',
  }

  return (
    <div className="bg-paper-raised border border-line rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-ink-soft font-mono-data">{label}</p>
        {Icon && <Icon size={15} className="text-ink-soft" strokeWidth={2} />}
      </div>
      <p className={`font-display font-semibold text-2xl leading-none ${toneClasses[tone]}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  )
}
