import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Users,
  ClipboardCheck,
  ClipboardX,
  BookOpenCheck,
  Wrench,
  AlertTriangle,
  FileDown,
  Sheet,
  Camera,
  CalendarOff,
  Ban,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import Badge, { programTone } from '../components/ui/Badge'
import { SelectField, TextField } from '../components/ui/Field'
import {
  loadReportData,
  loadHolidaysAndCancellations,
  computeSummary,
  computeDayBreakdown,
  buildClassDetails,
  computeAttendanceByDay,
  computeStudentAttendance,
  computeActivityReport,
  computeCurriculumProgress,
  computeToolkitReport,
  distinctFilterOptions,
  filterSessions,
} from '../services/reports'
import { resolveRange, formatShortDate } from '../utils/date'
import { exportReportPdf, exportReportCsv } from '../utils/reportExport'
import { getSettings } from '../services/settings'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

export default function Reports() {
  const [preset, setPreset] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [range, setRange] = useState(() => resolveRange('today'))

  const [program, setProgram] = useState('')
  const [grade, setGrade] = useState('')
  const [section, setSection] = useState('')

  const [sessions, setSessions] = useState([])
  const [holidays, setHolidays] = useState([])
  const [cancellations, setCancellations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [progress, setProgress] = useState(null)
  const [progressLoading, setProgressLoading] = useState(false)

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to])

  async function load(r) {
    setLoading(true)
    setError('')
    try {
      const [sess, extras] = await Promise.all([
        loadReportData(r.from, r.to),
        loadHolidaysAndCancellations(r.from, r.to),
      ])
      setSessions(sess)
      setHolidays(extras.holidays)
      setCancellations(extras.cancellations)
    } catch {
      setError('Unable to generate report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function applyPreset(key) {
    setPreset(key)
    if (key !== 'custom') setRange(resolveRange(key))
  }

  function applyCustomRange() {
    if (!customFrom || !customTo || customFrom > customTo) return
    setRange(resolveRange('custom', { from: customFrom, to: customTo }))
  }

  const filtered = useMemo(
    () => filterSessions(sessions, { program, grade, section }),
    [sessions, program, grade, section]
  )

  const filteredCancellations = useMemo(
    () =>
      cancellations.filter((c) => {
        if (program && c.program !== program) return false
        if (grade && c.grade !== grade) return false
        if (section && c.section !== section) return false
        return true
      }),
    [cancellations, program, grade, section]
  )

  const summary = useMemo(
    () => computeSummary(filtered, holidays, filteredCancellations),
    [filtered, holidays, filteredCancellations]
  )
  const dayBreakdown = useMemo(
    () => computeDayBreakdown(filtered, range.from, range.to, holidays, filteredCancellations),
    [filtered, range.from, range.to, holidays, filteredCancellations]
  )
  const classDetails = useMemo(() => buildClassDetails(filtered), [filtered])
  const attendanceByDay = useMemo(() => computeAttendanceByDay(filtered), [filtered])
  const studentAttendance = useMemo(
    () => (grade && section ? computeStudentAttendance(filtered, grade, section) : []),
    [filtered, grade, section]
  )
  const activityReport = useMemo(() => computeActivityReport(filtered), [filtered])
  const toolkitReport = useMemo(() => computeToolkitReport(filtered), [filtered])
  const filterOptions = useMemo(() => distinctFilterOptions(sessions), [sessions])

  const isSingleDay = range.from === range.to
  const attendancePct = attendanceByDay.length
    ? Math.round(
      (attendanceByDay.reduce((s, r) => s + r.present, 0) /
        Math.max(1, attendanceByDay.reduce((s, r) => s + r.total, 0))) *
      1000
    ) / 10
    : 0

  useEffect(() => {
    if (!grade) {
      setProgress(null)
      return
    }
    let cancelled = false
    setProgressLoading(true)
    computeCurriculumProgress(grade, section, program)
      .then((res) => {
        if (!cancelled) setProgress(res)
      })
      .catch(() => {
        if (!cancelled) setProgress(null)
      })
      .finally(() => {
        if (!cancelled) setProgressLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [grade, section, program])

  const [exportingPdf, setExportingPdf] = useState(false)

  async function handleExportPdf() {
    const settings = await getSettings().catch(() => null)

    // Keep the school name as a dedicated report identity field.
    // This prevents it from being lost when organizationName is also configured.
    const schoolName =
      settings?.schoolName ||
      settings?.organizationName ||
      'Narayana E Techno School'

    const metaLines = [
      settings?.organizationName && settings.organizationName !== schoolName
        ? settings.organizationName
        : null,
      settings?.academicYear ? `Academic Year: ${settings.academicYear}` : null,
      settings?.trainerName ? `Trainer: ${settings.trainerName}` : null,
    ].filter(Boolean)

    const summaryRows = [
      ['Total Classes', summary.totalClasses],
      ['Completed', summary.completedClasses],
      ['Students Handled', summary.studentsHandled],
      ['Present', summary.present],
      ['Absent', summary.absent],
      ['CHAMPS Classes', summary.champs],
      ['TECHNO Classes', summary.techno],
      ['Activities Completed', summary.activitiesCompleted],
      ['Toolkit Issues', summary.toolkitIssues],
      ['Holidays', summary.holidayCount],
      ['Classes Cancelled', summary.cancelledCount],
    ]

    // Sort by raw ISO date — formatShortDate's display format isn't
    // lexically sortable, so format only after ordering.
    const holidayRows = holidays
      .map((h) => ({ date: h.date, row: [formatShortDate(h.date), h.name + (h.description ? ` — ${h.description}` : '')] }))
    const cancellationRows = filteredCancellations
      .map((c) => ({
        date: c.date,
        row: [
          formatShortDate(c.date),
          `Grade ${c.grade}${c.section} · ${c.program}`,
          c.reason + (c.note ? ` — ${c.note}` : ''),
        ],
      }))

    const extraTables = [
      {
        title: 'Holidays',
        head: ['Date', 'Holiday'],
        rows: holidayRows.sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => r.row),
        accentColor: [120, 120, 120],
      },
      {
        title: 'Cancellations',
        head: ['Date', 'Class', 'Reason'],
        rows: cancellationRows.sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => r.row),
        accentColor: [166, 74, 46], // rust — matches the Cancelled badge tone in-app
      },
    ]

    const photos = classDetails.flatMap((c) =>
      c.photos.map((p) => ({ ...p, classLabel: `Grade ${c.grade}${c.section} · ${c.activityName}` }))
    )

    // Build the PDF table as DATE -> SESSION -> CLASS.
    // buildClassDetails may not carry the source session date, so resolve it
    // from the original filtered session data using the session id. This is
    // essential for weekly/monthly exports so classes from different dates
    // can never be merged into the same session.
    const sessionById = new Map(filtered.map((s) => [s.id, s]))
    const datedClassDetails = classDetails.map((c) => ({
      ...c,
      date: c.date || sessionById.get(c.id)?.date || '',
    }))

    const groupedTableRows = buildSessionGroupedRows(datedClassDetails, isSingleDay)

    setExportingPdf(true)
    try {
      await exportReportPdf({
        title: 'ROBOTICS REPORT',
        schoolName,
        subtitle: range.label,
        logoUrl: settings?.schoolLogoUrl,
        metaLines,
        summaryRows,
        tableTitle: 'Class Details',
        tableHead: ['Date', 'Time / Session', 'Grade', 'Program', 'Activity', 'Attendance', 'Toolkit', 'Status'],
        tableRows: groupedTableRows,
        extraTables,
        photos,
        fileName: `robotics-report-${range.from}-to-${range.to}`,
      })
    } catch {
      setError('Unable to generate report. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  function buildSessionGroupedRows(classes, singleDay) {
    // Monthly/weekly PDF hierarchy:
    //   DATE (shown once in the Date column)
    //     SESSION
    //       CLASS 1
    //       CLASS 2
    //     SESSION
    //       CLASS 1
    //   NEXT DATE
    //     SESSION ...
    //
    // The date is deliberately a separate column rather than being repeated
    // in every session label. This keeps all sessions for one date together.
    const groups = new Map()

    classes.forEach((c, index) => {
      const date = c.date || ''
      const time = `${c.startTime || ''}–${c.endTime || ''}`
      const period = c.periodLabel || c.period || ''
      const key = `${date}|${period}|${time}`

      if (!groups.has(key)) {
        groups.set(key, {
          date,
          time,
          period,
          firstIndex: index,
          classes: [],
        })
      }

      groups.get(key).classes.push(c)
    })

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.firstIndex - b.firstIndex
    })

    const rows = []
    let currentDate = null

    sortedGroups.forEach((group) => {
      if (!singleDay && group.date !== currentDate) {
        currentDate = group.date
        rows.push({
          type: 'date',
          cells: [formatShortDate(group.date), '', '', '', '', '', '', ''],
        })
      }

      const sessionLabel = [
        group.period || null,
        group.time && group.time !== '–' ? group.time : null,
      ].filter(Boolean).join(' · ')

      rows.push({
        type: 'session',
        cells: ['', sessionLabel, '', '', '', '', '', ''],
      })

      group.classes.forEach((c) => {
        rows.push({
          type: 'class',
          cells: [
            '',
            '',
            `${c.grade}${c.section}`,
            c.program,
            c.activityName || '—',
            c.total != null ? `${c.present}/${c.total}` : '—',
            c.toolkitLabel || '—',
            c.status === 'completed' ? 'Completed' : 'In Progress',
          ],
        })
      })
    })

    // For a single-day report the date is already displayed in the report
    // period/header, so keep the Date column empty and preserve the same
    // session -> class structure.
    if (singleDay) {
      rows.forEach((row) => {
        if (row.type === 'session') {
          row.cells[0] = ''
        }
      })
    }

    return rows
  }


  function handleExportCsv() {
    const classRows = filtered.map((s) => {
      const total = s.attendance?.total || 0
      const present = s.attendance?.present || 0
      const issues = (s.toolkits || []).filter((t) => t.status && t.status !== 'returned')
      return {
        date: s.date,
        row: [
          s.date, 'Class', s.day || '', s.periodLabel || s.period || '',
          s.grade || '', s.section || '', s.program || '', s.activityName || '',
          total, present, s.attendance?.absent || 0,
          total ? `${Math.round((present / total) * 100)}%` : '',
          issues.length
            ? issues.map((t) => `${t.toolkitId}: ${t.issueNote || t.status}`).join('; ')
            : (s.toolkits?.length ? 'All Returned' : ''),
          (s.remarks || '').replace(/\n/g, ' '),
          s.status || '',
        ],
      }
    })

    const holidayRows = holidays.map((h) => ({
      date: h.date,
      row: [h.date, 'Holiday', '', '', '', '', '', '', '', '', '', '', '',
      h.name + (h.description ? ` — ${h.description}` : ''), 'Holiday'],
    }))

    const cancelRows = filteredCancellations.map((c) => ({
      date: c.date,
      row: [c.date, 'Cancelled', '', '', c.grade || '', c.section || '', c.program || '', '', '', '', '', '', '',
      `${c.reason}${c.note ? ` — ${c.note}` : ''}`, 'Cancelled'],
    }))

    const rows = [...classRows, ...holidayRows, ...cancelRows]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((r) => r.row)

    exportReportCsv({
      columns: [
        'Date', 'Type', 'Day', 'Period', 'Grade', 'Section', 'Program', 'Activity',
        'Total Students', 'Present', 'Absent', 'Attendance %', 'Toolkit Status', 'Remarks', 'Session Status',
      ],
      rows,
      fileName: `robotics-report-${range.from}-to-${range.to}`,
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader title="Reports" subtitle="Generated automatically from your class sessions." />

      {/* Date filter */}
      <section className="mb-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${preset === p.key
                ? 'bg-blueprint-dark text-white'
                : 'bg-paper-raised border border-line text-ink-soft hover:text-ink'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 bg-paper-raised border border-line rounded-xl p-3">
            <TextField label="From" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
            <TextField label="To" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
            <button
              onClick={applyCustomRange}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint"
            >
              Apply Filter
            </button>
          </div>
        )}

        <p className="text-xs text-ink-soft font-mono-data mt-2 flex items-center gap-1.5">
          <CalendarDays size={13} /> {range.label}
        </p>
      </section>

      {/* Program / grade / section filters */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <SelectField label="Program" value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="">All Programs</option>
          <option value="CHAMPS">CHAMPS</option>
          <option value="TECHNO">TECHNO</option>
        </SelectField>
        <SelectField label="Grade" value={grade} onChange={(e) => { setGrade(e.target.value); setSection('') }}>
          <option value="">All Grades</option>
          {filterOptions.grades.map((g) => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </SelectField>
        <SelectField label="Section" value={section} onChange={(e) => setSection(e.target.value)} disabled={!grade}>
          <option value="">All Sections</option>
          {filterOptions.sections.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </SelectField>
      </section>

      {error && (
        <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {loading && <ReportsSkeleton />}

      {!loading && !error && sessions.length === 0 && holidays.length === 0 && filteredCancellations.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No classes found"
          description="No classes, holidays or cancellations found for the selected date range."
        />
      )}

      {!loading && !error && (sessions.length > 0 || holidays.length > 0 || filteredCancellations.length > 0) && (
        <>
          {/* Summary cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard label="Total Classes" value={summary.totalClasses} sub={`${summary.completedClasses} completed`} icon={ClipboardCheck} />
            <StatCard label="Students Handled" value={summary.studentsHandled} icon={Users} />
            <StatCard label="Present" value={summary.present} sub={`${summary.attendancePct}%`} icon={ClipboardCheck} tone="sage" />
            <StatCard label="Absent" value={summary.absent} icon={ClipboardX} tone="rust" />
            <StatCard label="CHAMPS Classes" value={summary.champs} />
            <StatCard label="TECHNO Classes" value={summary.techno} />
            <StatCard label="Activities Completed" value={summary.activitiesCompleted} icon={BookOpenCheck} tone="sage" />
            <StatCard
              label="Toolkit Issues"
              value={summary.toolkitIssues}
              icon={Wrench}
              tone={summary.toolkitIssues > 0 ? 'rust' : 'sage'}
            />
            <StatCard label="Holidays" value={summary.holidayCount} icon={CalendarOff} />
            <StatCard
              label="Cancelled"
              value={summary.cancelledCount}
              icon={Ban}
              tone={summary.cancelledCount > 0 ? 'rust' : 'sage'}
            />
          </section>

          {(holidays.length > 0 || filteredCancellations.length > 0) && (
            <HolidaysAndCancellations holidays={holidays} cancellations={filteredCancellations} />
          )}

          {/* Class details (single day) OR day-wise breakdown (week/month) */}
          {isSingleDay ? (
            <ReportSection title="Class Details">
              <ClassDetailsList classes={classDetails} />
            </ReportSection>
          ) : (
            <ReportSection title="Day-wise Breakdown">
              <DayBreakdownTable rows={dayBreakdown} />
            </ReportSection>
          )}

          {/* Attendance */}
          <ReportSection title="Attendance Summary" sub={`${attendancePct}% overall`}>
            <AttendanceTable rows={attendanceByDay} />
            {grade && section && studentAttendance.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">
                  Student Attendance — Grade {grade}{section}
                </p>
                <StudentAttendanceTable rows={studentAttendance} />
              </div>
            )}
          </ReportSection>

          {/* Activity report */}
          <ReportSection title="Activity Report">
            <ActivityTable rows={activityReport} />
          </ReportSection>

          {/* Curriculum progress — only meaningful for one grade */}
          {grade && (
            <ReportSection title="Activity / Curriculum Progress">
              {progressLoading && <p className="text-sm text-ink-soft">Loading progress…</p>}
              {!progressLoading && !progress && (
                <p className="text-sm text-ink-soft">No matching curriculum kit found for this grade.</p>
              )}
              {!progressLoading && progress && <CurriculumProgress data={progress} />}
            </ReportSection>
          )}

          {/* Toolkit report */}
          <ReportSection title="Toolkit Report">
            <ToolkitSummary data={toolkitReport} />
          </ReportSection>

          {/* Export */}
          <section className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
            >
              <FileDown size={15} /> {exportingPdf ? 'Generating…' : 'Export PDF'}
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-paper-raised border border-line text-ink hover:border-blueprint"
            >
              <Sheet size={15} /> Export Excel/CSV
            </button>
          </section>
        </>
      )}
    </div>
  )
}

// ---------------- Sections ----------------

function ReportSection({ title, sub, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display font-semibold text-base text-ink">{title}</h2>
        {sub && <span className="text-xs text-ink-soft font-mono-data">{sub}</span>}
      </div>
      {children}
    </section>
  )
}

function ClassDetailsList({ classes }) {
  if (classes.length === 0) return <p className="text-sm text-ink-soft">No classes in this range.</p>
  return (
    <div className="space-y-2.5">
      {classes.map((c) => (
        <div key={c.id} className="bg-paper-raised border border-line rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono-data text-xs text-ink-soft">
                {c.startTime}–{c.endTime} · {c.periodLabel}
              </p>
              <p className="font-display font-medium text-sm text-ink mt-0.5">
                Grade {c.grade}{c.section} · {c.activityName}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={programTone(c.program)}>{c.program}</Badge>
              <Badge tone={c.status === 'completed' ? 'sage' : 'neutral'}>
                {c.status === 'completed' ? 'Completed' : 'In Progress'}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <DetailField label="Attendance" value={c.total != null ? `${c.present} / ${c.total}` : '—'} />
            <DetailField label="Toolkit" value={c.toolkitLabel} rust={c.toolkitIssueCount > 0} />
            <DetailField label="Photos" value={String(c.photoCount)} icon={c.photoCount > 0 ? Camera : null} />
          </div>
          {c.remarks && <p className="text-xs text-ink-soft mt-2">{c.remarks}</p>}
          {c.photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {c.photos.map((p, idx) => (
                <a
                  key={idx}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-16 w-16 rounded-lg overflow-hidden border border-line shrink-0"
                  title={p.caption || undefined}
                >
                  <img src={p.thumbUrl} alt={p.caption || 'Class photo'} loading="lazy" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DetailField({ label, value, rust, icon: Icon }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-soft font-mono-data">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1 ${rust ? 'text-rust font-medium' : 'text-ink'}`}>
        {Icon && <Icon size={12} />} {value}
      </p>
    </div>
  )
}

function DayBreakdownTable({ rows }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No working days in this range.</p>
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <table className="w-full text-sm min-w-[620px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft font-mono-data border-b border-line">
            <th className="py-2 pr-3">Day</th>
            <th className="py-2 pr-3">Classes</th>
            <th className="py-2 pr-3">Completed</th>
            <th className="py-2 pr-3">Students</th>
            <th className="py-2 pr-3">Present</th>
            <th className="py-2 pr-3">Absent</th>
            <th className="py-2 pr-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-b border-line/60">
              <td className="py-2 pr-3 font-medium text-ink">{r.day} <span className="text-ink-soft font-mono-data text-xs">{formatShortDate(r.date)}</span></td>
              <td className="py-2 pr-3">{r.totalClasses}</td>
              <td className="py-2 pr-3">{r.completedClasses}</td>
              <td className="py-2 pr-3">{r.studentsHandled}</td>
              <td className="py-2 pr-3 text-sage">{r.present}</td>
              <td className="py-2 pr-3 text-rust">{r.absent}</td>
              <td className="py-2 pr-3">
                {r.holiday && <Badge tone="neutral">Holiday</Badge>}
                {!r.holiday && r.cancellations?.length > 0 && (
                  <Badge tone="rust">{r.cancellations.length} Cancelled</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AttendanceTable({ rows }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No attendance recorded in this range.</p>
  const totalPresent = rows.reduce((s, r) => s + r.present, 0)
  const totalAbsent = rows.reduce((s, r) => s + r.absent, 0)
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <table className="w-full text-sm min-w-[420px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft font-mono-data border-b border-line">
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Present</th>
            <th className="py-2 pr-3">Absent</th>
            <th className="py-2 pr-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-b border-line/60">
              <td className="py-2 pr-3 font-mono-data text-xs">{formatShortDate(r.date)}</td>
              <td className="py-2 pr-3 text-sage">{r.present}</td>
              <td className="py-2 pr-3 text-rust">{r.absent}</td>
              <td className="py-2 pr-3">{r.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium text-ink">
            <td className="py-2 pr-3">Total</td>
            <td className="py-2 pr-3 text-sage">{totalPresent}</td>
            <td className="py-2 pr-3 text-rust">{totalAbsent}</td>
            <td className="py-2 pr-3">{totalPresent + totalAbsent}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function StudentAttendanceTable({ rows }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <table className="w-full text-sm min-w-[420px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft font-mono-data border-b border-line">
            <th className="py-2 pr-3">Student</th>
            <th className="py-2 pr-3">Present</th>
            <th className="py-2 pr-3">Absent</th>
            <th className="py-2 pr-3">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-b border-line/60">
              <td className="py-2 pr-3">{r.name}</td>
              <td className="py-2 pr-3 text-sage">{r.present}</td>
              <td className="py-2 pr-3 text-rust">{r.absent}</td>
              <td className="py-2 pr-3 font-mono-data text-xs">{r.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActivityTable({ rows }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No activities recorded in this range.</p>
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <table className="w-full text-sm min-w-[360px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft font-mono-data border-b border-line">
            <th className="py-2 pr-3">Activity</th>
            <th className="py-2 pr-3">Classes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line/60">
              <td className="py-2 pr-3">{r.name}</td>
              <td className="py-2 pr-3 font-mono-data">{r.classes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CurriculumProgress({ data }) {
  return (
    <div className="bg-paper-raised border border-line rounded-xl p-4">
      <p className="font-display font-medium text-sm text-ink mb-3">{data.kitName}</p>
      <ul className="space-y-1.5 mb-4">
        {data.items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-sm">
            <span className={item.done ? 'text-sage' : 'text-ink-soft'}>{item.done ? '✓' : '○'}</span>
            <span className={item.done ? 'text-ink' : 'text-ink-soft'}>{item.name}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-soft">{data.doneCount} / {data.total} Activities Completed</p>
        <p className="font-mono-data text-sm font-medium text-ink">{data.pct}%</p>
      </div>
      <div className="h-1.5 rounded-full bg-line mt-2 overflow-hidden">
        <div className="h-full bg-sage" style={{ width: `${data.pct}%` }} />
      </div>
    </div>
  )
}

function ToolkitSummary({ data }) {
  return (
    <div className="bg-paper-raised border border-line rounded-xl p-4">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <DetailField label="Toolkits Used" value={String(data.used)} />
        <DetailField label="Returned" value={String(data.returned)} />
        <DetailField label="Issues" value={String(data.issues)} rust={data.issues > 0} />
      </div>
      {data.rows.length > 0 && (
        <div className="space-y-2">
          {data.rows.map((r, idx) => (
            <div key={`${r.toolkitId}-${idx}`} className="flex items-center justify-between text-sm border-t border-line/60 pt-2">
              <div>
                <p className="font-mono-data text-ink">{r.toolkitId}</p>
                <p className="text-xs text-ink-soft">{r.issueNote} · Grade {r.grade}{r.section} · {formatShortDate(r.date)}</p>
              </div>
              <Badge tone="rust">{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HolidaysAndCancellations({ holidays, cancellations }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-semibold text-lg text-ink mb-3">Holidays & Cancellations</h2>
      <div className="space-y-2">
        {holidays.map((h) => (
          <div key={h.id} className="flex items-center gap-3 bg-paper-raised border border-line rounded-xl px-4 py-3">
            <span className="h-8 w-8 rounded-full bg-paper flex items-center justify-center shrink-0">
              <CalendarOff size={14} className="text-ink-soft" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{h.name}</p>
              {h.description && <p className="text-xs text-ink-soft">{h.description}</p>}
            </div>
            <span className="text-xs font-mono-data text-ink-soft shrink-0">{formatShortDate(h.date)}</span>
            <Badge tone="neutral">Holiday</Badge>
          </div>
        ))}
        {cancellations.map((c) => (
          <div key={c.id} className="flex items-center gap-3 bg-paper-raised border border-line rounded-xl px-4 py-3">
            <span className="h-8 w-8 rounded-full bg-rust-light flex items-center justify-center shrink-0">
              <Ban size={14} className="text-rust" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                Grade {c.grade}{c.section} <span className="text-ink-soft font-normal">· {c.reason}</span>
              </p>
              {c.note && <p className="text-xs text-ink-soft">{c.note}</p>}
            </div>
            <span className="text-xs font-mono-data text-ink-soft shrink-0">{formatShortDate(c.date)}</span>
            <Badge tone={programTone(c.program)}>{c.program}</Badge>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReportsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}