import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, MapPin } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, SelectField } from '../components/ui/Field'
import Badge, { programTone } from '../components/ui/Badge'
import {
  getAllTimetable,
  addTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  programForGrade,
  WORKING_DAYS,
  PERIODS,
} from '../services/timetable'
import { getAllKits } from '../services/curriculum'

const CLASS_PERIODS = PERIODS.filter((p) => typeof p.period === 'number')
const GRADES = Array.from({ length: 9 }, (_, i) => String(i + 1))

export default function Timetable() {
  const [entries, setEntries] = useState([])
  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [activeDay, setActiveDay] = useState(WORKING_DAYS[0])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [tt, k] = await Promise.all([getAllTimetable(), getAllKits()])
      setEntries(tt)
      setKits(k)
    } catch {
      setError('Could not load the timetable. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const dayEntries = useMemo(
    () => entries.filter((e) => e.day === activeDay).sort((a, b) => Number(a.period) - Number(b.period)),
    [entries, activeDay]
  )

  function openAdd() {
    setEditingEntry(null)
    setModalOpen(true)
  }

  function openEdit(entry) {
    setEditingEntry(entry)
    setModalOpen(true)
  }

  async function handleSave(form) {
    if (editingEntry) {
      await updateTimetableEntry(editingEntry.id, form)
    } else {
      await addTimetableEntry(form)
    }
    setModalOpen(false)
    setBanner(editingEntry ? 'Timetable entry updated.' : 'Timetable entry added.')
    load()
  }

  async function handleDelete() {
    await deleteTimetableEntry(deleteTarget.id)
    setDeleteTarget(null)
    setBanner('Entry removed.')
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader
        title="Timetable"
        subtitle="Set this up once — the dashboard reads today's classes straight from here."
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Entry</span>
          </button>
        }
      />

      {banner && <p className="mb-4 text-sm text-sage bg-sage-light rounded-lg px-4 py-2.5">{banner}</p>}
      {error && <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>}

      <div className="flex gap-1 mb-6 border border-line rounded-lg p-1 bg-paper-raised w-full sm:w-fit">
        {WORKING_DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeDay === day ? 'bg-blueprint-dark text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {loading && <ListSkeleton />}

      {!loading && !error && dayEntries.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title={`No classes set for ${activeDay}`}
          description="Add a period, grade and section to build out this day."
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint"
            >
              <Plus size={15} /> Add Entry
            </button>
          }
        />
      )}

      <div className="space-y-2">
        {dayEntries.map((entry) => {
          const periodMeta = CLASS_PERIODS.find((p) => p.period === Number(entry.period))
          return (
            <div
              key={entry.id}
              className="bg-paper-raised border border-line rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <div className="w-20 shrink-0">
                <p className="text-xs font-mono-data text-ink-soft">{periodMeta?.label}</p>
                <p className="text-xs font-mono-data text-ink-soft">
                  {entry.startTime}–{entry.endTime}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-medium text-sm text-ink">
                    Grade {entry.grade}{entry.section}
                  </p>
                  <Badge tone={programTone(entry.program)}>{entry.program}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-soft flex-wrap">
                  {entry.kitName && <span>{entry.kitName}</span>}
                  {entry.room && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {entry.room}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(entry)}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(entry)}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <EntryModal
        open={modalOpen}
        entry={editingEntry}
        defaultDay={activeDay}
        kits={kits}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove this entry?"
        message="This removes the class from the timetable and from the dashboard."
      />
    </div>
  )
}

function kitsForGrade(kits, grade, program) {
  const g = Number(grade)
  return kits.filter((k) => {
    if (k.program !== program) return false
    const [lo, hi] = String(k.gradeRange || '').split('-').map(Number)
    if (!lo) return true
    return g >= lo && g <= (hi || lo)
  })
}

function EntryModal({ open, entry, defaultDay, kits, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm(defaultDay))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entry) {
      setForm({
        day: entry.day,
        period: String(entry.period),
        grade: entry.grade,
        section: entry.section || '',
        program: entry.program,
        kitName: entry.kitName || '',
        room: entry.room || '',
        startTime: entry.startTime || '',
        endTime: entry.endTime || '',
      })
    } else {
      setForm(emptyForm(defaultDay))
    }
  }, [entry, open, defaultDay])

  function emptyForm(day) {
    const first = CLASS_PERIODS[0]
    return {
      day,
      period: String(first.period),
      grade: '1',
      section: '',
      program: 'CHAMPS',
      kitName: '',
      room: '',
      startTime: first.start,
      endTime: first.end,
    }
  }

  function handlePeriodChange(periodValue) {
    const meta = CLASS_PERIODS.find((p) => String(p.period) === periodValue)
    setForm({ ...form, period: periodValue, startTime: meta.start, endTime: meta.end })
  }

  function handleGradeChange(grade) {
    setForm({ ...form, grade, program: programForGrade(grade), kitName: '' })
  }

  const availableKits = kitsForGrade(kits, form.grade, form.program)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, period: Number(form.period), section: form.section.toUpperCase() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Day" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
            {WORKING_DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </SelectField>
          <SelectField label="Period" value={form.period} onChange={(e) => handlePeriodChange(e.target.value)}>
            {CLASS_PERIODS.map((p) => (
              <option key={p.period} value={p.period}>{p.label} ({p.start}–{p.end})</option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Grade" value={form.grade} onChange={(e) => handleGradeChange(e.target.value)}>
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

        <SelectField label="Program" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value, kitName: '' })}>
          <option value="CHAMPS">CHAMPS</option>
          <option value="TECHNO">TECHNO</option>
        </SelectField>

        <SelectField
          label="Curriculum / Kit"
          value={form.kitName}
          onChange={(e) => setForm({ ...form, kitName: e.target.value })}
        >
          <option value="">No kit selected</option>
          {availableKits.map((k) => (
            <option key={k.id} value={k.kitName}>{k.kitName}</option>
          ))}
          {form.kitName && !availableKits.find((k) => k.kitName === form.kitName) && (
            <option value={form.kitName}>{form.kitName}</option>
          )}
        </SelectField>

        <TextField
          label="Room"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
          placeholder="e.g. School Mech Building"
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Start Time"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <TextField
            label="End Time"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}
