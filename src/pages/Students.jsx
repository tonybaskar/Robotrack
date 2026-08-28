import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { Plus, Search, Upload, Pencil, Trash2, Users, UserX, Loader2, ClipboardList, IdCard } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, SelectField, TextAreaField } from '../components/ui/Field'
import Badge from '../components/ui/Badge'
import {
  getAllStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  toggleStudentActive,
  bulkImportStudents,
} from '../services/students'
import { getCompletedSessionsForGrade } from '../services/sessions'
import { programForGrade } from '../services/timetable'
import { computeStudentProfile } from '../services/reports'
import {
  CHAMPS_SCALE,
  CHAMPS_CRITERIA,
  TECHNO_CRITERIA,
  addAssessment,
  getAssessmentsForStudent,
} from '../services/assessments'
import { getTodayDateStr, formatShortDate } from '../utils/date'

const GRADES = Array.from({ length: 9 }, (_, i) => String(i + 1))

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')

  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importing, setImporting] = useState(false)
  const [profileStudent, setProfileStudent] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setStudents(await getAllStudents())
    } catch {
      setError('Could not load students. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const sections = useMemo(
    () => [...new Set(students.map((s) => s.section).filter(Boolean))].sort(),
    [students]
  )

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (gradeFilter && s.grade !== gradeFilter) return false
      if (sectionFilter && s.section !== sectionFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.name?.toLowerCase().includes(q) || String(s.rollNumber || '').includes(q)
        )
      }
      return true
    })
  }, [students, search, gradeFilter, sectionFilter])

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach((s) => {
      const key = `${s.grade}${s.section || ''}`
      if (!groups[key]) groups[key] = { grade: s.grade, section: s.section, students: [] }
      groups[key].students.push(s)
    })
    return Object.values(groups).sort((a, b) => {
      if (a.grade !== b.grade) return Number(a.grade) - Number(b.grade)
      return (a.section || '').localeCompare(b.section || '')
    })
  }, [filtered])

  function openAdd() {
    setEditingStudent(null)
    setModalOpen(true)
  }

  function openEdit(student) {
    setEditingStudent(student)
    setModalOpen(true)
  }

  async function handleSave(form) {
    if (editingStudent) {
      await updateStudent(editingStudent.id, form)
    } else {
      await addStudent(form)
    }
    setModalOpen(false)
    setBanner(editingStudent ? 'Student updated.' : 'Student added.')
    load()
  }

  async function handleDelete() {
    await deleteStudent(deleteTarget.id)
    setDeleteTarget(null)
    setBanner('Student removed.')
    load()
  }

  async function handleToggleActive(student) {
    await toggleStudentActive(student.id, !student.active)
    load()
  }

  async function handleCsvSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const count = await bulkImportStudents(results.data)
          setBanner(`Imported ${count} student${count === 1 ? '' : 's'}.`)
          load()
        } catch {
          setError('Import failed. Check the CSV format and try again.')
        } finally {
          setImporting(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      },
      error: () => {
        setError('Could not read that CSV file.')
        setImporting(false)
      },
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader
        title="Students"
        subtitle={`${students.length} student${students.length === 1 ? '' : 's'} on record`}
        action={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvSelected}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-soft border border-line hover:border-blueprint hover:text-blueprint transition-colors disabled:opacity-60"
            >
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint transition-colors"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Add Student</span>
            </button>
          </div>
        }
      />

      {banner && (
        <p className="mb-4 text-sm text-sage bg-sage-light rounded-lg px-4 py-2.5">{banner}</p>
      )}
      {error && (
        <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or roll number"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-paper-raised text-sm text-ink placeholder:text-ink-soft/60 focus:border-blueprint focus:ring-1 focus:ring-blueprint outline-none"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-line bg-paper-raised text-sm text-ink outline-none focus:border-blueprint"
        >
          <option value="">All grades</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-line bg-paper-raised text-sm text-ink outline-none focus:border-blueprint"
        >
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s}>Section {s}</option>
          ))}
        </select>
      </div>

      {loading && <ListSkeleton />}

      {!loading && !error && grouped.length === 0 && (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add a student or import a CSV with name, rollNumber, grade and section columns."
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint"
            >
              <Plus size={15} /> Add Student
            </button>
          }
        />
      )}

      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={`${group.grade}${group.section}`} className="bg-paper-raised border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <p className="font-display font-semibold text-sm text-ink">
                Grade {group.grade}{group.section}
              </p>
              <span className="text-xs text-ink-soft font-mono-data">{group.students.length} students</span>
            </div>
            <ul className="divide-y divide-line">
              {group.students.map((s, idx) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${!s.active ? 'opacity-50' : ''}`}
                >
                  <span className="text-xs text-ink-soft font-mono-data w-5 shrink-0">{idx + 1}.</span>
                  <button
                    onClick={() => setProfileStudent(s)}
                    className="flex-1 min-w-0 text-left truncate text-sm text-ink hover:text-blueprint hover:underline"
                  >
                    {s.name}
                  </button>
                  {s.rollNumber && (
                    <span className="text-xs text-ink-soft font-mono-data shrink-0">#{s.rollNumber}</span>
                  )}
                  {!s.active && <Badge tone="rust">Inactive</Badge>}
                  <button
                    onClick={() => setProfileStudent(s)}
                    title="View profile"
                    className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper shrink-0"
                  >
                    <IdCard size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(s)}
                    title={s.active ? 'Deactivate' : 'Activate'}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper shrink-0"
                  >
                    <UserX size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <StudentModal
        open={modalOpen}
        student={editingStudent}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <StudentProfileModal student={profileStudent} onClose={() => setProfileStudent(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove student?"
        message={`This removes ${deleteTarget?.name} from the roster. This can't be undone.`}
      />
    </div>
  )
}

function StudentModal({ open, student, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(student ? { name: student.name, rollNumber: student.rollNumber || '', grade: student.grade, section: student.section || '' } : emptyForm())
  }, [student, open])

  function emptyForm() {
    return { name: '', rollNumber: '', grade: '1', section: '' }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, section: form.section.toUpperCase() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? 'Edit Student' : 'Add Student'}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Student name"
        />
        <TextField
          label="Roll Number"
          value={form.rollNumber}
          onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
          placeholder="e.g. 14"
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Grade"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </SelectField>
          <TextField
            label="Section"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            placeholder="A"
            maxLength={2}
          />
        </div>
      </form>
    </Modal>
  )
}

function StudentProfileModal({ student, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [showAssessForm, setShowAssessForm] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    if (!student) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id])

  async function load() {
    setLoading(true)
    setError('')
    setShowAssessForm(false)
    setBanner('')
    try {
      const [sessions, studentAssessments] = await Promise.all([
        getCompletedSessionsForGrade(student.grade, student.section),
        getAssessmentsForStudent(student.id),
      ])
      setProfile(computeStudentProfile(sessions, student.id))
      setAssessments(studentAssessments)
    } catch {
      setError('Could not load this student\u2019s profile. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAssessment(scores, remark) {
    const program = programForGrade(student.grade)
    await addAssessment({
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      section: student.section,
      program,
      date: getTodayDateStr(),
      scores,
      remark,
    })
    setBanner('Assessment saved.')
    setShowAssessForm(false)
    load()
  }

  if (!student) return null
  const program = programForGrade(student.grade)

  return (
    <Modal open={!!student} onClose={onClose} title={student.name} size="lg">
      {loading && <p className="text-sm text-ink-soft py-6 text-center">Loading profile…</p>}
      {error && <p className="text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>}

      {!loading && !error && profile && (
        <div className="space-y-5">
          <p className="text-xs text-ink-soft font-mono-data">
            Grade {student.grade}{student.section} · {program}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-paper-raised border border-line rounded-xl p-3">
              <p className="text-[11px] text-ink-soft font-mono-data uppercase tracking-wide mb-1">Attendance</p>
              <p className="text-lg font-display font-semibold text-ink">
                {profile.attendancePct === null ? '—' : `${profile.attendancePct}%`}
              </p>
              <p className="text-[11px] text-ink-soft">{profile.present}/{profile.total} classes</p>
            </div>
            <div className="bg-paper-raised border border-line rounded-xl p-3">
              <p className="text-[11px] text-ink-soft font-mono-data uppercase tracking-wide mb-1">Projects</p>
              <p className="text-lg font-display font-semibold text-ink">{profile.projects.length}</p>
              <p className="text-[11px] text-ink-soft">tracked activities</p>
            </div>
          </div>

          {Object.keys(profile.roleTally).length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-soft mb-2">Role History</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(profile.roleTally).map(([role, count]) => (
                  <Badge key={role} tone="neutral">{role}: {count}</Badge>
                ))}
              </div>
            </div>
          )}

          {profile.projects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-soft mb-2">Projects</p>
              <ul className="space-y-1">
                {profile.projects.map((p) => (
                  <li key={p.name} className="text-sm text-ink flex items-center gap-1.5">
                    <span>{p.status === 'completed' ? '✓' : '→'}</span> {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.observations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-soft mb-2">Observations</p>
              <ul className="space-y-1.5">
                {profile.observations.slice(0, 5).map((o, idx) => (
                  <li key={idx} className="text-xs text-ink-soft">
                    <span className="font-mono-data">{formatShortDate(o.date)}</span> — {o.tags.join(', ')}
                    {o.note ? ` · ${o.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-ink-soft">Assessments</p>
              <button
                onClick={() => setShowAssessForm((v) => !v)}
                className="text-xs font-medium text-blueprint hover:underline"
              >
                {showAssessForm ? 'Cancel' : '+ New Assessment'}
              </button>
            </div>

            {banner && <p className="text-xs text-sage bg-sage-light rounded-lg px-3 py-2 mb-2">{banner}</p>}

            {showAssessForm && (
              <AssessmentForm program={program} onSave={handleAddAssessment} />
            )}

            {assessments.length === 0 && !showAssessForm && (
              <p className="text-xs text-ink-soft">No assessments recorded yet.</p>
            )}

            <div className="space-y-2 mt-2">
              {assessments.map((a) => (
                <div key={a.id} className="bg-paper-raised border border-line rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono-data text-ink-soft">{formatShortDate(a.date)}</span>
                    <Badge tone="sage">
                      Overall: {typeof a.overall === 'number' ? a.overall : a.overall || '—'}
                    </Badge>
                  </div>
                  {a.remark && <p className="text-xs text-ink">{a.remark}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AssessmentForm({ program, onSave }) {
  const criteria = program === 'TECHNO' ? TECHNO_CRITERIA : CHAMPS_CRITERIA
  const [scores, setScores] = useState({})
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    try {
      await onSave(scores, remark)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-paper border border-line rounded-lg p-3 mb-3 space-y-3">
      {criteria.map((c) => (
        <div key={c.key} className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-soft">{c.label}</span>
          {program === 'TECHNO' ? (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                  className={`h-7 w-7 rounded-md text-xs font-medium border ${scores[c.key] === n
                    ? 'bg-blueprint-dark text-white border-blueprint-dark'
                    : 'text-ink-soft border-line hover:border-blueprint'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1">
              {CHAMPS_SCALE.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScores((s) => ({ ...s, [c.key]: opt.value }))}
                  title={opt.label}
                  className={`h-7 w-7 rounded-md text-sm border ${scores[c.key] === opt.value
                    ? 'bg-blueprint-dark border-blueprint-dark'
                    : 'border-line hover:border-blueprint'
                    }`}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <TextAreaField
        label="Trainer Remark"
        rows={2}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
        placeholder="e.g. Excellent practical skills."
      />
      <button
        onClick={handleSubmit}
        disabled={saving || Object.keys(scores).length === 0}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
      >
        <ClipboardList size={13} /> {saving ? 'Saving…' : 'Save Assessment'}
      </button>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="h-32 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}
