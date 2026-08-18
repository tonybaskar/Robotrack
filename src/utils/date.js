export function getTodayDayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' })
}

export function getTodayDateStr() {
  // YYYY-MM-DD, matches the `date` field stored on session docs
  return new Date().toISOString().split('T')[0]
}

export function formatFriendlyDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ---- Date range helpers (Reports, Phase 4) ----
// Sessions are stored with `date` as a YYYY-MM-DD string, so every range
// helper here works in that same string space to keep queries simple
// (single-field range query, no composite index needed).

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDaysToStr(dateStr, days) {
  const d = parseDateStr(dateStr)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/** Monday–Sunday range (as strings) for the week containing `base`. */
export function getWeekRange(base = new Date()) {
  const d = new Date(base)
  const day = d.getDay() // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toDateStr(monday), to: toDateStr(sunday) }
}

/** First–last day of the month containing `base`. */
export function getMonthRange(base = new Date()) {
  const d = new Date(base)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: toDateStr(first), to: toDateStr(last) }
}

/** Every date string from `from` to `to`, inclusive. */
export function enumerateDates(from, to) {
  const dates = []
  let cur = from
  let guard = 0
  while (cur <= to && guard < 366) {
    dates.push(cur)
    cur = addDaysToStr(cur, 1)
    guard += 1
  }
  return dates
}

export function dayNameForDateStr(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString('en-US', { weekday: 'long' })
}

/** e.g. "18 Aug 2026" */
export function formatShortDate(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** e.g. "Tuesday, 18 August 2026" */
export function formatLongDate(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatMonthLabel(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/**
 * Resolve a preset ('today' | 'week' | 'month') or an explicit custom
 * { from, to } into a concrete { from, to, label } range.
 */
export function resolveRange(preset, custom) {
  if (preset === 'today') {
    const today = getTodayDateStr()
    return { from: today, to: today, label: formatLongDate(today) }
  }
  if (preset === 'week') {
    const { from, to } = getWeekRange()
    return { from, to, label: `${formatShortDate(from)} – ${formatShortDate(to)}` }
  }
  if (preset === 'month') {
    const { from, to } = getMonthRange()
    return { from, to, label: formatMonthLabel(from) }
  }
  // custom
  const from = custom?.from || getTodayDateStr()
  const to = custom?.to || from
  return { from, to, label: `${formatShortDate(from)} – ${formatShortDate(to)}` }
}
