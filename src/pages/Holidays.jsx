import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarOff } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, TextAreaField } from '../components/ui/Field'
import { getAllHolidays, addHoliday, deleteHoliday } from '../services/holidays'
import { formatLongDate } from '../utils/date'

export default function Holidays() {
    const [holidays, setHolidays] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [banner, setBanner] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)

    useEffect(() => {
        load()
    }, [])

    async function load() {
        setLoading(true)
        setError('')
        try {
            setHolidays(await getAllHolidays())
        } catch {
            setError('Could not load holidays. Check your connection.')
        } finally {
            setLoading(false)
        }
    }

    async function handleSave(form) {
        await addHoliday(form)
        setModalOpen(false)
        setBanner('Holiday added. Classes on that date will show as Holiday automatically.')
        load()
    }

    async function handleDelete() {
        await deleteHoliday(deleteTarget.id)
        setDeleteTarget(null)
        setBanner('Holiday removed.')
        load()
    }

    return (
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-10">
            <PageHeader
                title="Holidays"
                subtitle="Mark a date as a holiday and every class that day shows as Holiday — no attendance needed."
                action={
                    <button
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint transition-colors"
                    >
                        <Plus size={15} />
                        <span className="hidden sm:inline">Add Holiday</span>
                    </button>
                }
            />

            {banner && <p className="mb-4 text-sm text-sage bg-sage-light rounded-lg px-4 py-2.5">{banner}</p>}
            {error && <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>}

            {loading && <ListSkeleton />}

            {!loading && !error && holidays.length === 0 && (
                <EmptyState
                    icon={CalendarOff}
                    title="No holidays added yet"
                    description="Add school holidays here so the dashboard skips attendance for them automatically."
                    action={
                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint"
                        >
                            <Plus size={15} /> Add Holiday
                        </button>
                    }
                />
            )}

            <div className="space-y-2">
                {holidays.map((h) => (
                    <div
                        key={h.id}
                        className="bg-paper-raised border border-line rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="font-mono-data text-xs text-ink-soft">{formatLongDate(h.date)}</p>
                            <p className="font-display font-medium text-sm text-ink mt-0.5">{h.name}</p>
                            {h.description && <p className="text-xs text-ink-soft mt-0.5">{h.description}</p>}
                        </div>
                        <button
                            onClick={() => setDeleteTarget(h)}
                            className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <HolidayModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} />

            <ConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Remove this holiday?"
                message="Classes on this date will go back to being regular scheduled classes."
            />
        </div>
    )
}

function HolidayModal({ open, onClose, onSave }) {
    const [form, setForm] = useState({ date: '', name: '', description: '' })
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    useEffect(() => {
        if (open) setForm({ date: '', name: '', description: '' })
    }, [open])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.date || !form.name.trim()) {
            setErr('Date and holiday name are required.')
            return
        }
        setErr('')
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
            title="Add Holiday"
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
                {err && <p className="text-sm text-rust bg-rust-light rounded-lg px-3 py-2">{err}</p>}
                <TextField
                    label="Date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                <TextField
                    label="Holiday Name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Independence Day Celebration"
                />
                <TextAreaField
                    label="Description (optional)"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
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
