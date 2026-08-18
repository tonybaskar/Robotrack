export function TextField({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs font-medium text-ink-soft mb-1.5 block">{label}</span>}
      <input
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink placeholder:text-ink-soft/60 focus:border-blueprint focus:ring-1 focus:ring-blueprint outline-none transition-colors"
      />
    </label>
  )
}

export function SelectField({ label, className = '', children, ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs font-medium text-ink-soft mb-1.5 block">{label}</span>}
      <select
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink focus:border-blueprint focus:ring-1 focus:ring-blueprint outline-none transition-colors"
      >
        {children}
      </select>
    </label>
  )
}

export function TextAreaField({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="text-xs font-medium text-ink-soft mb-1.5 block">{label}</span>}
      <textarea
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink placeholder:text-ink-soft/60 focus:border-blueprint focus:ring-1 focus:ring-blueprint outline-none transition-colors resize-none"
      />
    </label>
  )
}
