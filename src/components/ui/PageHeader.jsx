export default function PageHeader({ title, subtitle, action }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display font-semibold text-2xl text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-soft mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
