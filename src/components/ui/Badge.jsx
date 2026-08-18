const TONES = {
  champs: 'bg-blueprint-light text-blueprint-dark',
  techno: 'bg-amber-light text-ink',
  sage: 'bg-sage-light text-sage',
  amber: 'bg-amber-light text-ink',
  rust: 'bg-rust-light text-rust',
  neutral: 'bg-paper text-ink-soft border border-line',
}

export default function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-mono-data tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function programTone(program) {
  return program === 'TECHNO' ? 'techno' : 'champs'
}
