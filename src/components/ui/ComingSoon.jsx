export default function ComingSoon({ icon: Icon, title, phase, description }) {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <div className="border border-dashed border-line rounded-xl p-10 flex flex-col items-center text-center gap-3">
        {Icon && <Icon size={30} className="text-ink-soft" strokeWidth={1.6} />}
        <h1 className="font-display font-semibold text-xl text-ink">{title}</h1>
        <p className="text-sm text-ink-soft max-w-sm">{description}</p>
        <span className="mt-1 text-[11px] font-mono-data text-blueprint bg-blueprint-light px-2.5 py-1 rounded-full">
          {phase}
        </span>
      </div>
    </div>
  )
}
