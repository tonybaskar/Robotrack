import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, SelectField } from '../components/ui/Field'
import Badge from '../components/ui/Badge'
import {
  getAllToolkits,
  addToolkit,
  updateToolkit,
  deleteToolkit,
  TOOLKIT_STATUSES,
} from '../services/toolkits'

const STATUS_TONE = {
  available: 'sage',
  'in-use': 'champs',
  missing: 'rust',
  damaged: 'rust',
}

const STATUS_LABEL = {
  available: 'Available',
  'in-use': 'In Use',
  missing: 'Missing',
  damaged: 'Damaged',
}

export default function Toolkits() {
  const [toolkits, setToolkits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingToolkit, setEditingToolkit] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setToolkits(await getAllToolkits())
    } catch {
      setError('Could not load toolkits. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(
    () => (statusFilter ? toolkits.filter((t) => t.status === statusFilter) : toolkits),
    [toolkits, statusFilter]
  )

  const issueCount = toolkits.filter((t) => t.status === 'missing' || t.status === 'damaged').length

  function openAdd() {
    setEditingToolkit(null)
    setModalOpen(true)
  }

  function openEdit(toolkit) {
    setEditingToolkit(toolkit)
    setModalOpen(true)
  }

  async function handleSave(form) {
    if (editingToolkit) {
      await updateToolkit(editingToolkit.id, form)
    } else {
      await addToolkit(form)
    }
    setModalOpen(false)
    setBanner(editingToolkit ? 'Toolkit updated.' : 'Toolkit added.')
    load()
  }

  async function handleDelete() {
    await deleteToolkit(deleteTarget.id)
    setDeleteTarget(null)
    setBanner('Toolkit removed.')
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader
        title="Toolkits"
        subtitle={
          issueCount > 0
            ? `${issueCount} toolkit${issueCount === 1 ? '' : 's'} need attention`
            : 'All toolkits accounted for'
        }
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Toolkit</span>
          </button>
        }
      />

      {banner && <p className="mb-4 text-sm text-sage bg-sage-light rounded-lg px-4 py-2.5">{banner}</p>}
      {error && <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>}

      <div className="flex gap-1 mb-6 border border-line rounded-lg p-1 bg-paper-raised w-fit flex-wrap">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            statusFilter === '' ? 'bg-blueprint-dark text-white' : 'text-ink-soft hover:text-ink'
          }`}
        >
          All
        </button>
        {TOOLKIT_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-blueprint-dark text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading && <ListSkeleton />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={Wrench}
          title="No toolkits yet"
          description="Add toolkits like MEX-001, MEX-002 so you can track who has what."
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint"
            >
              <Plus size={15} /> Add Toolkit
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((t) => (
          <div key={t.id} className="bg-paper-raised border border-line rounded-xl p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono-data font-medium text-sm text-ink">{t.toolkitId}</p>
              <p className="text-xs text-ink-soft mt-0.5">{t.kitType}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge tone={STATUS_TONE[t.status] || 'neutral'}>{STATUS_LABEL[t.status] || t.status}</Badge>
                {t.assignedGroup && <Badge tone="neutral">{t.assignedGroup}</Badge>}
              </div>
              {t.issueNote && <p className="text-xs text-rust mt-2">{t.issueNote}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => openEdit(t)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setDeleteTarget(t)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ToolkitModal
        open={modalOpen}
        toolkit={editingToolkit}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove this toolkit?"
        message={`This removes ${deleteTarget?.toolkitId} from tracking.`}
      />
    </div>
  )
}

function ToolkitModal({ open, toolkit, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(
      toolkit
        ? {
            toolkitId: toolkit.toolkitId,
            kitType: toolkit.kitType || '',
            status: toolkit.status || 'available',
            assignedGroup: toolkit.assignedGroup || '',
            issueNote: toolkit.issueNote || '',
          }
        : emptyForm()
    )
  }, [toolkit, open])

  function emptyForm() {
    return { toolkitId: '', kitType: '', status: 'available', assignedGroup: '', issueNote: '' }
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
      title={toolkit ? 'Edit Toolkit' : 'Add Toolkit'}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft hover:bg-paper">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.toolkitId}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          label="Toolkit ID"
          required
          value={form.toolkitId}
          onChange={(e) => setForm({ ...form, toolkitId: e.target.value.toUpperCase() })}
          placeholder="e.g. MEX-001"
        />
        <TextField
          label="Kit Type"
          value={form.kitType}
          onChange={(e) => setForm({ ...form, kitType: e.target.value })}
          placeholder="e.g. MEX Starter Kit"
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {TOOLKIT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </SelectField>
          <TextField
            label="Assigned Group"
            value={form.assignedGroup}
            onChange={(e) => setForm({ ...form, assignedGroup: e.target.value })}
            placeholder="Group 1"
          />
        </div>
        {(form.status === 'missing' || form.status === 'damaged') && (
          <TextField
            label="Issue Note"
            value={form.issueNote}
            onChange={(e) => setForm({ ...form, issueNote: e.target.value })}
            placeholder="e.g. Missing axle"
          />
        )}
      </form>
    </Modal>
  )
}

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-xl bg-paper-raised border border-line" />
      ))}
    </div>
  )
}
