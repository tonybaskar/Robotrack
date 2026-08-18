import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, BookOpen, Sparkles, Loader2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, SelectField } from '../components/ui/Field'
import {
  getAllKits,
  getAllActivities,
  addKit,
  updateKit,
  deleteKit,
  addActivity,
  updateActivity,
  deleteActivity,
  seedTerm1Curriculum,
  isTerm1Seeded,
} from '../services/curriculum'

export default function Curriculum() {
  const [kits, setKits] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [program, setProgram] = useState('CHAMPS')
  const [expandedKit, setExpandedKit] = useState(null)
  const [seeded, setSeeded] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const [kitModalOpen, setKitModalOpen] = useState(false)
  const [editingKit, setEditingKit] = useState(null)
  const [deleteKitTarget, setDeleteKitTarget] = useState(null)

  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [activityKitId, setActivityKitId] = useState(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [k, a, wasSeeded] = await Promise.all([getAllKits(), getAllActivities(), isTerm1Seeded()])
      setKits(k)
      setActivities(a)
      setSeeded(wasSeeded)
    } catch {
      setError('Could not load the curriculum. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const visibleKits = useMemo(() => kits.filter((k) => k.program === program), [kits, program])

  function activitiesFor(kitId) {
    return activities.filter((a) => a.curriculumId === kitId).sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const count = await seedTerm1Curriculum()
      setBanner(count > 0 ? `Added ${count} Term 1 kits.` : 'Term 1 curriculum is already in place.')
      load()
    } catch {
      setError('Could not seed the curriculum. Check your connection.')
    } finally {
      setSeeding(false)
    }
  }

  function openAddKit() {
    setEditingKit(null)
    setKitModalOpen(true)
  }

  function openEditKit(kit) {
    setEditingKit(kit)
    setKitModalOpen(true)
  }

  async function handleSaveKit(form) {
    if (editingKit) {
      await updateKit(editingKit.id, form)
    } else {
      await addKit(form)
    }
    setKitModalOpen(false)
    setBanner(editingKit ? 'Kit updated.' : 'Kit added.')
    load()
  }

  async function handleDeleteKit() {
    await deleteKit(deleteKitTarget.id)
    setDeleteKitTarget(null)
    setBanner('Kit and its activities removed.')
    load()
  }

  function openAddActivity(kitId) {
    setActivityKitId(kitId)
    setEditingActivity(null)
    setActivityModalOpen(true)
  }

  function openEditActivity(activity) {
    setActivityKitId(activity.curriculumId)
    setEditingActivity(activity)
    setActivityModalOpen(true)
  }

  async function handleSaveActivity(form) {
    if (editingActivity) {
      await updateActivity(editingActivity.id, form)
    } else {
      const order = activitiesFor(activityKitId).length + 1
      await addActivity({ ...form, curriculumId: activityKitId, order })
    }
    setActivityModalOpen(false)
    setBanner(editingActivity ? 'Activity updated.' : 'Activity added.')
    load()
  }

  async function handleDeleteActivity() {
    await deleteActivity(deleteActivityTarget.id)
    setDeleteActivityTarget(null)
    setBanner('Activity removed.')
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader
        title="Curriculum"
        subtitle="Programs, kits and activities — editable any time, tracked automatically per class."
        action={
          <button
            onClick={openAddKit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Kit</span>
          </button>
        }
      />

      {banner && <p className="mb-4 text-sm text-sage bg-sage-light rounded-lg px-4 py-2.5">{banner}</p>}
      {error && <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>}

      {!loading && !seeded && (
        <div className="mb-6 border border-amber/40 bg-amber-light/50 rounded-xl p-4 flex items-start gap-3">
          <Sparkles size={17} className="text-ink shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">Load the Term 1 curriculum</p>
            <p className="text-xs text-ink-soft mt-0.5">
              Adds the OMOTOOLS, MEX, School Mech Building and Avishkaar IoT kits with their activities, ready to edit.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-ink text-white hover:bg-ink/90 disabled:opacity-60 flex items-center gap-1.5"
          >
            {seeding && <Loader2 size={13} className="animate-spin" />}
            Load Term 1
          </button>
        </div>
      )}

      <div className="flex gap-1 mb-6 border border-line rounded-lg p-1 bg-paper-raised w-fit">
        {['CHAMPS', 'TECHNO'].map((p) => (
          <button
            key={p}
            onClick={() => setProgram(p)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              program === p ? 'bg-blueprint-dark text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {p}
            <span className="ml-1.5 text-xs opacity-70">
              {p === 'CHAMPS' ? '· Grades 1–5' : '· Grades 6–9'}
            </span>
          </button>
        ))}
      </div>

      {loading && <ListSkeleton />}

      {!loading && !error && visibleKits.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={`No ${program} kits yet`}
          description="Add a kit manually, or load the Term 1 curriculum above."
          action={
            <button
              onClick={openAddKit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint"
            >
              <Plus size={15} /> Add Kit
            </button>
          }
        />
      )}

      <div className="space-y-3">
        {visibleKits.map((kit) => {
          const kitActivities = activitiesFor(kit.id)
          const isOpen = expandedKit === kit.id
          return (
            <div key={kit.id} className="bg-paper-raised border border-line rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedKit(isOpen ? null : kit.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-display font-medium text-sm text-ink">{kit.kitName}</p>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Grades {kit.gradeRange} · {kitActivities.length} activities
                  </p>
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    openEditKit(kit)
                  }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper shrink-0"
                >
                  <Pencil size={14} />
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteKitTarget(kit)
                  }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust shrink-0"
                >
                  <Trash2 size={14} />
                </span>
                <ChevronDown
                  size={16}
                  className={`text-ink-soft shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-line px-4 py-3">
                  <ul className="space-y-1.5">
                    {kitActivities.map((a, idx) => (
                      <li key={a.id} className="flex items-center gap-2 group">
                        <span className="text-xs font-mono-data text-ink-soft w-5 shrink-0">{idx + 1}.</span>
                        <span className="flex-1 min-w-0 text-sm text-ink">{a.name}</span>
                        <button
                          onClick={() => openEditActivity(a)}
                          className="h-6 w-6 rounded flex items-center justify-center text-ink-soft hover:bg-paper opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteActivityTarget(a)}
                          className="h-6 w-6 rounded flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                    {kitActivities.length === 0 && (
                      <p className="text-sm text-ink-soft py-1">No activities yet.</p>
                    )}
                  </ul>
                  <button
                    onClick={() => openAddActivity(kit.id)}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blueprint hover:text-blueprint-dark"
                  >
                    <Plus size={13} /> Add Activity
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <KitModal
        open={kitModalOpen}
        kit={editingKit}
        defaultProgram={program}
        onClose={() => setKitModalOpen(false)}
        onSave={handleSaveKit}
      />

      <ActivityModal
        open={activityModalOpen}
        activity={editingActivity}
        onClose={() => setActivityModalOpen(false)}
        onSave={handleSaveActivity}
      />

      <ConfirmDialog
        open={!!deleteKitTarget}
        onClose={() => setDeleteKitTarget(null)}
        onConfirm={handleDeleteKit}
        title="Remove this kit?"
        message={`This removes "${deleteKitTarget?.kitName}" and all of its activities.`}
      />

      <ConfirmDialog
        open={!!deleteActivityTarget}
        onClose={() => setDeleteActivityTarget(null)}
        onConfirm={handleDeleteActivity}
        title="Remove this activity?"
        message={`This removes "${deleteActivityTarget?.name}" from the kit.`}
      />
    </div>
  )
}

function KitModal({ open, kit, defaultProgram, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(
      kit
        ? { kitName: kit.kitName, program: kit.program, gradeRange: kit.gradeRange, order: kit.order || 1 }
        : { kitName: '', program: defaultProgram, gradeRange: '', order: 1 }
    )
  }, [kit, open, defaultProgram])

  function emptyForm() {
    return { kitName: '', program: defaultProgram, gradeRange: '', order: 1 }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kit ? 'Edit Kit' : 'Add Kit'}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.kitName}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Kit Name"
          required
          value={form.kitName}
          onChange={(e) => setForm({ ...form, kitName: e.target.value })}
          placeholder="e.g. MEX Starter Kit"
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Program" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
            <option value="CHAMPS">CHAMPS</option>
            <option value="TECHNO">TECHNO</option>
          </SelectField>
          <TextField
            label="Grade Range"
            value={form.gradeRange}
            onChange={(e) => setForm({ ...form, gradeRange: e.target.value })}
            placeholder="e.g. 3-4"
          />
        </div>
      </form>
    </Modal>
  )
}

function ActivityModal({ open, activity, onClose, onSave }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(activity?.name || '')
  }, [activity, open])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ name })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? 'Edit Activity' : 'Add Activity'}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <TextField
          label="Activity Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Fence Gate"
        />
      </form>
    </Modal>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}
