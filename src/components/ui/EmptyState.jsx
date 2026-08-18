export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="border border-dashed border-line rounded-xl p-10 flex flex-col items-center text-center gap-2">
      {Icon && <Icon size={28} className="text-ink-soft mb-1" strokeWidth={1.6} />}
      <p className="font-display font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-ink-soft max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
