import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { Plus, Search, Upload, Pencil, Trash2, Users, UserX, Loader2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, SelectField } from '../components/ui/Field'
import Badge from '../components/ui/Badge'
import {
  getAllStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  toggleStudentActive,
  bulkImportStudents,
} from '../services/students'

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
                  <span className="flex-1 min-w-0 truncate text-sm text-ink">{s.name}</span>
                  {s.rollNumber && (
                    <span className="text-xs text-ink-soft font-mono-data shrink-0">#{s.rollNumber}</span>
                  )}
                  {!s.active && <Badge tone="rust">Inactive</Badge>}
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

function ListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="h-32 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}
