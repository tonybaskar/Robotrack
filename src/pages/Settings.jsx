import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { TextField } from '../components/ui/Field'
import { getSettings, saveSettings } from '../services/settings'

const EMPTY = {
  schoolName: '',
  trainerName: '',
  schoolAddress: '',
  trainerEmail: '',
  trainerPhone: '',
  organizationName: '',
  academicYear: '',
  schoolLogoUrl: '',
  champsTiming: '',
  technoTiming: '',
}

export default function Settings() {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then((data) => {
        if (!cancelled && data) setForm({ ...EMPTY, ...data })
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your saved settings. Check your connection.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validate() {
    const next = {}
    if (!form.schoolName.trim()) next.schoolName = 'School name is required.'
    if (!form.trainerName.trim()) next.trainerName = 'Trainer name is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBanner('')
    if (!validate()) return
    setSaving(true)
    try {
      await saveSettings(form)
      setBanner('Settings saved successfully.')
    } catch {
      setBanner('error:Could not save settings. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-ink-soft text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading settings…
      </div>
    )
  }

  const isError = banner.startsWith('error:')

  return (
    <div className="max-w-xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <PageHeader
        title="Settings"
        subtitle="School and trainer details, used on the dashboard and in your reports."
      />

      {loadError && (
        <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{loadError}</p>
      )}

      {banner && (
        <p
          className={`mb-4 flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 ${isError ? 'text-rust bg-rust-light' : 'text-sage bg-sage-light'
            }`}
        >
          {isError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {isError ? banner.replace('error:', '') : banner}
        </p>
      )}

      <form onSubmit={handleSubmit} className="bg-paper-raised border border-line rounded-xl p-5 space-y-4">
        <div>
          <TextField
            label="School Name"
            required
            value={form.schoolName}
            onChange={(e) => update('schoolName', e.target.value)}
            placeholder="e.g. Narayana E-Techno School"
          />
          {errors.schoolName && <p className="text-xs text-rust mt-1">{errors.schoolName}</p>}
        </div>

        <div>
          <TextField
            label="Trainer Name"
            required
            value={form.trainerName}
            onChange={(e) => update('trainerName', e.target.value)}
            placeholder="e.g. Tony Baskar"
          />
          {errors.trainerName && <p className="text-xs text-rust mt-1">{errors.trainerName}</p>}
        </div>

        <TextField
          label="School Address"
          value={form.schoolAddress}
          onChange={(e) => update('schoolAddress', e.target.value)}
          placeholder="Optional"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Trainer Email"
            type="email"
            value={form.trainerEmail}
            onChange={(e) => update('trainerEmail', e.target.value)}
            placeholder="Optional"
          />
          <TextField
            label="Trainer Phone"
            value={form.trainerPhone}
            onChange={(e) => update('trainerPhone', e.target.value)}
            placeholder="Optional"
          />
        </div>

        <TextField
          label="Program / Organization Name"
          value={form.organizationName}
          onChange={(e) => update('organizationName', e.target.value)}
          placeholder="Optional — e.g. BaskarTech Robotics"
        />

        <TextField
          label="Academic Year"
          value={form.academicYear}
          onChange={(e) => update('academicYear', e.target.value)}
          placeholder="e.g. 2026-27"
        />

        <TextField
          label="School Logo URL"
          value={form.schoolLogoUrl}
          onChange={(e) => update('schoolLogoUrl', e.target.value)}
          placeholder="Optional — paste a Cloudinary/image URL"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="CHAMPS Timing"
            value={form.champsTiming}
            onChange={(e) => update('champsTiming', e.target.value)}
            placeholder="e.g. 09:00 – 09:40"
          />
          <TextField
            label="TECHNO Timing"
            value={form.technoTiming}
            onChange={(e) => update('technoTiming', e.target.value)}
            placeholder="e.g. 10:00 – 10:40"
          />
        </div>

        <p className="text-xs text-ink-soft -mt-1">
          Working days are Tuesday, Wednesday and Thursday, set in the Timetable page.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blueprint-dark text-white font-medium text-sm py-2.5 rounded-lg hover:bg-blueprint transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}