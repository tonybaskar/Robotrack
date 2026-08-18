// Reports are calculated, not stored (project spec, Phase 4, section 16).
// Every function here reads from the existing `sessions` collection (via
// getSessionsInRange) plus the existing curriculum/activities collections,
// and derives numbers locally. Nothing here writes to Firestore.

import { getSessionsInRange, getCompletedSessionsForGrade } from './sessions'
import { getAllKits, getActivitiesForKit } from './curriculum'
import { WORKING_DAYS } from './timetable'
import { cloudinaryThumbUrl } from './cloudinary'
import { enumerateDates, dayNameForDateStr } from '../utils/date'

/** Fetch once, reuse across every card/tab on the Reports page. */
export async function loadReportData(fromStr, toStr) {
  const sessions = await getSessionsInRange(fromStr, toStr)
  return sessions
}

// ---- Summary (Reports Dashboard, Daily, Weekly, Monthly) ----

export function computeSummary(sessions) {
  const totalClasses = sessions.length
  const completedClasses = sessions.filter((s) => s.status === 'completed').length
  const pendingClasses = totalClasses - completedClasses

  let studentsHandled = 0
  let present = 0
  let absent = 0
  let champs = 0
  let techno = 0
  let activitiesCompleted = 0
  let toolkitIssues = 0

  sessions.forEach((s) => {
    if (s.attendance?.total) {
      studentsHandled += s.attendance.total
      present += s.attendance.present || 0
      absent += s.attendance.absent || 0
    }
    if (s.program === 'CHAMPS') champs += 1
    if (s.program === 'TECHNO') techno += 1
    if (s.activityStatus === 'completed') activitiesCompleted += 1
    toolkitIssues += (s.toolkits || []).filter((t) => t.status && t.status !== 'returned').length
  })

  return {
    totalClasses,
    completedClasses,
    pendingClasses,
    studentsHandled,
    present,
    absent,
    champs,
    techno,
    activitiesCompleted,
    toolkitIssues,
    attendancePct: studentsHandled ? Math.round((present / studentsHandled) * 1000) / 10 : 0,
  }
}

// ---- Day-wise breakdown (Weekly/Monthly) ----

export function computeDayBreakdown(sessions, fromStr, toStr) {
  const byDate = new Map()
  sessions.forEach((s) => {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date).push(s)
  })

  return enumerateDates(fromStr, toStr)
    .filter((dateStr) => WORKING_DAYS.includes(dayNameForDateStr(dateStr)))
    .map((dateStr) => {
      const daySessions = byDate.get(dateStr) || []
      return {
        date: dateStr,
        day: dayNameForDateStr(dateStr),
        ...computeSummary(daySessions),
      }
    })
}

// ---- Class-by-class detail (Daily Report) ----

export function buildClassDetails(sessions) {
  return [...sessions]
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    .map((s) => {
      const toolkitIssues = (s.toolkits || []).filter((t) => t.status && t.status !== 'returned')
      return {
        id: s.id,
        periodLabel: s.periodLabel || `Period ${s.period}`,
        startTime: s.startTime,
        endTime: s.endTime,
        grade: s.grade,
        section: s.section,
        program: s.program,
        activityName: s.activityName || '—',
        activityStatus: s.activityStatus,
        present: s.attendance?.present ?? null,
        total: s.attendance?.total ?? null,
        toolkitLabel: toolkitIssues.length
          ? toolkitIssues.map((t) => t.issueNote || t.status).join(', ')
          : s.toolkits?.length
            ? 'All Returned'
            : '—',
        toolkitIssueCount: toolkitIssues.length,
        status: s.status,
        photoCount: (s.photos || []).length,
        photos: (s.photos || []).map((p) => ({
          url: p.url,
          thumbUrl: cloudinaryThumbUrl(p.url, 200),
          caption: p.caption || '',
        })),
        remarks: s.remarks || '',
      }
    })
}

// ---- Attendance report ----

/** Attendance rolled up day-by-day for one grade/section (or all, if omitted). */
export function computeAttendanceByDay(sessions, filters = {}) {
  const filtered = filterSessions(sessions, filters)
  const byDate = new Map()
  filtered.forEach((s) => {
    if (!s.attendance?.total) return
    const row = byDate.get(s.date) || { date: s.date, present: 0, absent: 0, total: 0 }
    row.present += s.attendance.present || 0
    row.absent += s.attendance.absent || 0
    row.total += s.attendance.total || 0
    byDate.set(s.date, row)
  })
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Per-student attendance across the filtered range. Requires grade+section. */
export function computeStudentAttendance(sessions, grade, section) {
  const filtered = filterSessions(sessions, { grade, section })
  const byStudent = new Map()

  filtered.forEach((s) => {
    ;(s.attendance?.records || []).forEach((r) => {
      const row = byStudent.get(r.studentId) || { studentId: r.studentId, name: r.name, present: 0, absent: 0 }
      if (r.present) row.present += 1
      else row.absent += 1
      byStudent.set(r.studentId, row)
    })
  })

  return [...byStudent.values()]
    .map((row) => {
      const total = row.present + row.absent
      return { ...row, total, pct: total ? Math.round((row.present / total) * 100) : 0 }
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export function filterSessions(sessions, { grade, section, program, activityId } = {}) {
  return sessions.filter((s) => {
    if (grade && String(s.grade) !== String(grade)) return false
    if (section && s.section !== section) return false
    if (program && s.program !== program) return false
    if (activityId && s.activityId !== activityId) return false
    return true
  })
}

// ---- Activity report (which activities ran, how often) ----

export function computeActivityReport(sessions, filters = {}) {
  const filtered = filterSessions(sessions, filters)
  const byActivity = new Map()
  filtered.forEach((s) => {
    if (!s.activityName) return
    byActivity.set(s.activityName, (byActivity.get(s.activityName) || 0) + 1)
  })
  return [...byActivity.entries()]
    .map(([name, classes]) => ({ name, classes }))
    .sort((a, b) => b.classes - a.classes)
}

// ---- Curriculum / activity progress for a grade (cumulative, not date-scoped) ----

export async function computeCurriculumProgress(grade, section, program) {
  const kits = await getAllKits()
  const kit = kits.find((k) => {
    const [lo, hi] = String(k.gradeRange || '').split('-').map(Number)
    const g = Number(grade)
    return g >= lo && g <= hi && (!program || k.program === program)
  })
  if (!kit) return null

  const [activities, completedSessions] = await Promise.all([
    getActivitiesForKit(kit.id),
    getCompletedSessionsForGrade(grade, section),
  ])

  const completedNames = new Set(
    completedSessions
      .filter((s) => s.curriculumId === kit.id && s.activityStatus === 'completed')
      .map((s) => s.activityName)
  )

  const items = activities.map((a) => ({
    name: a.name,
    done: completedNames.has(a.name),
  }))
  const doneCount = items.filter((i) => i.done).length

  return {
    kitName: kit.kitName,
    gradeRange: kit.gradeRange,
    program: kit.program,
    items,
    doneCount,
    total: items.length,
    pct: items.length ? Math.round((doneCount / items.length) * 100) : 0,
  }
}

// ---- Toolkit report ----

export function computeToolkitReport(sessions) {
  const rows = []
  let used = 0
  let returned = 0

  sessions.forEach((s) => {
    ;(s.toolkits || []).forEach((t) => {
      if (!t.toolkitId) return
      used += 1
      if (t.status === 'returned') {
        returned += 1
      } else {
        rows.push({
          toolkitId: t.toolkitId,
          status: t.status,
          issueNote: t.issueNote || (t.status === 'missing' ? 'Missing Component' : 'Damaged'),
          date: s.date,
          grade: s.grade,
          section: s.section,
        })
      }
    })
  })

  return { used, returned, issues: rows.length, rows }
}

// ---- Distinct grade/section options for filters, derived from sessions in range ----

export function distinctFilterOptions(sessions) {
  const grades = new Set()
  const sections = new Set()
  sessions.forEach((s) => {
    if (s.grade) grades.add(String(s.grade))
    if (s.section) sections.add(s.section)
  })
  return {
    grades: [...grades].sort((a, b) => Number(a) - Number(b)),
    sections: [...sections].sort(),
  }
}
