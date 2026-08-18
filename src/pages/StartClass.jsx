import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Users,
  BookOpen,
  Wrench,
  Camera,
  MessageSquare,
  ClipboardList,
  Loader2,
  AlertTriangle,
  X,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { getTimetableEntry, periodMetaFor } from '../services/timetable'
import { getStudentsForClass } from '../services/students'
import { getAllKits, getActivitiesForKit } from '../services/curriculum'
import { getAllToolkits, updateToolkit } from '../services/toolkits'
import { uploadClassPhoto } from '../services/cloudinary'
import {
  getOrCreateSession,
  updateSession,
  completeSession,
} from '../services/sessions'
import { getTodayDateStr, getTodayDayName } from '../utils/date'
import { TextField, SelectField, TextAreaField } from '../components/ui/Field'
import Badge, { programTone } from '../components/ui/Badge'

const STEPS = [
  { key: 'attendance', label: 'Attendance', icon: Users },
  { key: 'activity', label: 'Activity', icon: BookOpen },
  { key: 'toolkit', label: 'Toolkit', icon: Wrench },
  { key: 'photos', label: 'Photos', icon: Camera },
  { key: 'remarks', label: 'Remarks', icon: MessageSquare },
  { key: 'summary', label: 'Complete', icon: ClipboardList },
]

const REMARK_CHIPS = [
  'Students participated actively',
  'Activity completed successfully',
  'Students needed assistance',
  'Activity partially completed',
  'Class interrupted',
  'Toolkit issue reported',
]

const TOOLKIT_STATUS_OPTIONS = [
  { value: 'returned', label: 'Returned' },
  { value: 'missing', label: 'Missing Component' },
  { value: 'damaged', label: 'Damaged' },
]

export default function StartClass() {
  const { timetableId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [entry, setEntry] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [students, setStudents] = useState([])
  const [kit, setKit] = useState(null)
  const [activities, setActivities] = useState([])
  const [toolkitOptions, setToolkitOptions] = useState([])

  const [step, setStep] = useState('attendance')
  const [furthestStep, setFurthestStep] = useState(0)

  // Attendance
  const [attendance, setAttendance] = useState({}) // studentId -> boolean present

  // Activity
  const [activityId, setActivityId] = useState('')
  const [customActivity, setCustomActivity] = useState('')
  const [activityStatus, setActivityStatus] = useState('completed')
  const [activityNote, setActivityNote] = useState('')

  // Toolkits
  const [toolkitRows, setToolkitRows] = useState([])

  // Photos
  const [photos, setPhotos] = useState([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef(null)

  // Remarks
  const [remarks, setRemarks] = useState('')

  const [stepSaving, setStepSaving] = useState(false)
  const [stepError, setStepError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState('')

  useEffect(() => {
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetableId])

  async function initialize() {
    setLoading(true)
    setLoadError('')
    try {
      const dateStr = getTodayDateStr()
      const dayName = getTodayDayName()

      const entryData = await getTimetableEntry(timetableId)
      if (!entryData) {
        setLoadError('This class could not be found. It may have been removed from the timetable.')
        setLoading(false)
        return
      }
      setEntry(entryData)

      const periodMeta = periodMetaFor(entryData.period)

      const [existingLookup, kits, allToolkits, studentList] = await Promise.all([
        getOrCreateSession(timetableId, dateStr, {
          day: dayName,
          grade: entryData.grade,
          section: entryData.section,
          program: entryData.program,
          period: entryData.period,
          periodLabel: periodMeta?.label || `Period ${entryData.period}`,
          startTime: entryData.startTime || periodMeta?.start || '',
          endTime: entryData.endTime || periodMeta?.end || '',
          room: entryData.room || '',
          kitName: entryData.kitName || '',
          curriculumId: null, // patched below once the matching kit is known
        }),
        getAllKits(),
        getAllToolkits(),
        getStudentsForClass(entryData.grade, entryData.section),
      ])

      setToolkitOptions(allToolkits)
      setStudents(studentList)

      const matchedKit =
        kits.find((k) => k.kitName === entryData.kitName && k.program === entryData.program) || null
      setKit(matchedKit)
      if (matchedKit) {
        setActivities(await getActivitiesForKit(matchedKit.id))
        // The transaction couldn't know the kit id yet (it needs `kits`,
        // fetched in this same Promise.all), so patch it on now — only
        // relevant the first time this class period is ever started.
        if (!existingLookup._existed && matchedKit.id) {
          updateSession(existingLookup.id, { curriculumId: matchedKit.id }).catch(() => { })
        }
      }

      if (existingLookup.status === 'completed') {
        navigate(`/sessions/${existingLookup.id}`, { replace: true })
        return
      }

      if (existingLookup._existed) {
        hydrate(existingLookup, studentList)
      } else {
        setAttendance(Object.fromEntries(studentList.map((s) => [s.id, true])))
      }
      setSessionId(existingLookup.id)
    } catch {
      setLoadError('Unable to load this class. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }

  function hydrate(session, studentList) {
    if (session.attendance?.records?.length) {
      setAttendance(Object.fromEntries(session.attendance.records.map((r) => [r.studentId, r.present])))
    } else {
      setAttendance(Object.fromEntries(studentList.map((s) => [s.id, true])))
    }
    if (session.activityId) setActivityId(session.activityId)
    if (session.activityName && !session.activityId) setCustomActivity(session.activityName)
    if (session.activityStatus) setActivityStatus(session.activityStatus)
    if (session.activityNote) setActivityNote(session.activityNote)
    if (session.toolkits?.length) setToolkitRows(session.toolkits)
    if (session.photos?.length) setPhotos(session.photos)
    if (session.remarks) setRemarks(session.remarks)

    const resumeKey = session.step || 'attendance'
    const resumeIdx = Math.max(0, STEPS.findIndex((s) => s.key === resumeKey))
    setStep(resumeKey)
    setFurthestStep(resumeIdx)
  }

  function goToStep(key) {
    const idx = STEPS.findIndex((s) => s.key === key)
    if (idx <= furthestStep) setStep(key)
  }

  function advance(nextKey) {
    const idx = STEPS.findIndex((s) => s.key === nextKey)
    setFurthestStep((f) => Math.max(f, idx))
    setStep(nextKey)
    setStepError('')
  }

  async function persist(patch, nextKey) {
    setStepSaving(true)
    setStepError('')
    try {
      await updateSession(sessionId, nextKey ? { ...patch, step: nextKey } : patch)
      if (nextKey) advance(nextKey)
    } catch {
      setStepError('Unable to save. Please try again.')
    } finally {
      setStepSaving(false)
    }
  }

  // ---- Attendance ----
  const presentCount = students.filter((s) => attendance[s.id] !== false).length
  const totalStudents = students.length

  function toggleStudent(id) {
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === false }))
  }

  function markAllPresent() {
    setAttendance(Object.fromEntries(students.map((s) => [s.id, true])))
  }

  function submitAttendance() {
    const records = students.map((s) => ({
      studentId: s.id,
      name: s.name,
      present: attendance[s.id] !== false,
    }))
    const attendanceData = {
      total: students.length,
      present: records.filter((r) => r.present).length,
      absent: records.filter((r) => !r.present).length,
      records,
    }
    persist({ attendance: attendanceData }, 'activity')
  }

  // ---- Activity ----
  function submitActivity() {
    const selected = activities.find((a) => a.id === activityId)
    const name = selected ? selected.name : customActivity.trim()
    persist(
      {
        activityId: selected ? selected.id : null,
        activityName: name,
        activityStatus,
        activityNote,
      },
      'toolkit'
    )
  }

  // ---- Toolkits ----
  function addToolkitRow() {
    setToolkitRows((rows) => [
      ...rows,
      { group: `Group ${rows.length + 1}`, toolkitId: '', status: 'returned', issueNote: '' },
    ])
  }

  function updateToolkitRow(idx, patch) {
    setToolkitRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeToolkitRow(idx) {
    setToolkitRows((rows) => rows.filter((_, i) => i !== idx))
  }

  async function submitToolkits() {
    setStepSaving(true)
    setStepError('')
    try {
      // Best-effort sync back to the master toolkit list; a failure here
      // shouldn't block the session save.
      await Promise.allSettled(
        toolkitRows
          .filter((r) => r.toolkitId)
          .map((r) => {
            const match = toolkitOptions.find(
              (t) => t.toolkitId?.toLowerCase() === r.toolkitId.toLowerCase()
            )
            if (!match) return Promise.resolve()
            return updateToolkit(match.id, {
              status: r.status === 'returned' ? 'available' : r.status,
              assignedGroup: r.group,
              issueNote: r.status === 'returned' ? '' : r.issueNote || '',
            })
          })
      )
      await updateSession(sessionId, { toolkits: toolkitRows, step: 'photos' })
      advance('photos')
    } catch {
      setStepError('Unable to save toolkit status. Please try again.')
    } finally {
      setStepSaving(false)
    }
  }

  // ---- Photos ----
  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return
    setPhotoError('')
    setUploadingCount(files.length)

    for (const file of files) {
      try {
        const { imageUrl, publicId } = await uploadClassPhoto(file)
        setPhotos((prev) => {
          const next = [...prev, { url: imageUrl, publicId, caption: '', uploadedAt: new Date().toISOString() }]
          updateSession(sessionId, { photos: next }).catch(() => { })
          return next
        })
      } catch {
        setPhotoError('Photo upload failed. Retry.')
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1))
      }
    }
  }

  function updateCaption(idx, caption) {
    setPhotos((prev) => {
      const next = prev.map((p, i) => (i === idx ? { ...p, caption } : p))
      updateSession(sessionId, { photos: next }).catch(() => { })
      return next
    })
  }

  function removePhoto(idx) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      updateSession(sessionId, { photos: next }).catch(() => { })
      return next
    })
  }

  function submitPhotos() {
    persist({ photos }, 'remarks')
  }

  // ---- Remarks ----
  function toggleChip(chip) {
    setRemarks((prev) => {
      if (prev.includes(chip)) {
        return prev
          .split('. ')
          .filter((part) => part.trim() && part.trim() !== chip)
          .join('. ')
      }
      return prev ? `${prev.replace(/\.?\s*$/, '')}. ${chip}` : chip
    })
  }

  function submitRemarks() {
    persist({ remarks }, 'summary')
  }

  // ---- Complete ----
  async function handleComplete() {
    setCompleting(true)
    setCompleteError('')
    try {
      await completeSession(sessionId, {
        attendance: {
          total: students.length,
          present: presentCount,
          absent: students.length - presentCount,
          records: students.map((s) => ({ studentId: s.id, name: s.name, present: attendance[s.id] !== false })),
        },
        activityId: activities.find((a) => a.id === activityId)?.id || null,
        activityName: activities.find((a) => a.id === activityId)?.name || customActivity.trim(),
        activityStatus,
        activityNote,
        toolkits: toolkitRows,
        photos,
        remarks,
      })
      navigate(`/sessions/${sessionId}`, { replace: true })
    } catch {
      setCompleteError('Unable to complete session. Your information has not been lost — retry when ready.')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) return <CenteredMessage>Loading class…</CenteredMessage>

  if (loadError) {
    return (
      <CenteredMessage>
        <AlertTriangle size={24} className="text-rust mb-2" />
        <p className="text-sm text-ink text-center max-w-xs mb-4">{loadError}</p>
        <div className="flex gap-2">
          <button onClick={initialize} className="px-4 py-2 rounded-lg text-sm font-medium bg-blueprint-dark text-white">
            Retry
          </button>
          <Link to="/" className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-line">
            Back to Dashboard
          </Link>
        </div>
      </CenteredMessage>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 md:py-8">
      <ClassHeader entry={entry} />
      <StepNav steps={STEPS} current={step} furthest={furthestStep} onSelect={goToStep} />

      {stepError && (
        <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} /> {stepError}
        </p>
      )}

      {step === 'attendance' && (
        <AttendanceStep
          students={students}
          attendance={attendance}
          onToggle={toggleStudent}
          onMarkAllPresent={markAllPresent}
          presentCount={presentCount}
          totalStudents={totalStudents}
          onContinue={submitAttendance}
          saving={stepSaving}
        />
      )}

      {step === 'activity' && (
        <ActivityStep
          kit={kit}
          entry={entry}
          activities={activities}
          activityId={activityId}
          setActivityId={setActivityId}
          customActivity={customActivity}
          setCustomActivity={setCustomActivity}
          activityStatus={activityStatus}
          setActivityStatus={setActivityStatus}
          activityNote={activityNote}
          setActivityNote={setActivityNote}
          onBack={() => goToStep('attendance')}
          onContinue={submitActivity}
          saving={stepSaving}
        />
      )}

      {step === 'toolkit' && (
        <ToolkitStep
          rows={toolkitRows}
          options={toolkitOptions}
          onAdd={addToolkitRow}
          onUpdate={updateToolkitRow}
          onRemove={removeToolkitRow}
          onBack={() => goToStep('activity')}
          onContinue={submitToolkits}
          saving={stepSaving}
        />
      )}

      {step === 'photos' && (
        <PhotosStep
          photos={photos}
          uploadingCount={uploadingCount}
          error={photoError}
          fileInputRef={fileInputRef}
          onPick={() => fileInputRef.current?.click()}
          onFiles={handleFiles}
          onCaption={updateCaption}
          onRemove={removePhoto}
          onBack={() => goToStep('toolkit')}
          onContinue={submitPhotos}
          saving={stepSaving}
        />
      )}

      {step === 'remarks' && (
        <RemarksStep
          remarks={remarks}
          setRemarks={setRemarks}
          onToggleChip={toggleChip}
          onBack={() => goToStep('photos')}
          onContinue={submitRemarks}
          saving={stepSaving}
        />
      )}

      {step === 'summary' && (
        <SummaryStep
          entry={entry}
          presentCount={presentCount}
          totalStudents={totalStudents}
          activityName={activities.find((a) => a.id === activityId)?.name || customActivity}
          activityStatus={activityStatus}
          toolkitRows={toolkitRows}
          photos={photos}
          remarks={remarks}
          onBack={() => goToStep('remarks')}
          onComplete={handleComplete}
          completing={completing}
          error={completeError}
        />
      )}
    </div>
  )
}

function CenteredMessage({ children }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">{children}</div>
  )
}

function ClassHeader({ entry }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink mb-2">
          <ArrowLeft size={13} /> Dashboard
        </Link>
        <h1 className="font-display font-semibold text-xl text-ink">
          Grade {entry.grade}{entry.section}
        </h1>
        <p className="text-xs text-ink-soft font-mono-data mt-0.5">
          {entry.startTime}–{entry.endTime} · {periodMetaFor(entry.period)?.label || `Period ${entry.period}`}
          {entry.room ? ` · ${entry.room}` : ''}
        </p>
      </div>
      <Badge tone={programTone(entry.program)}>{entry.program}</Badge>
    </div>
  )
}

function StepNav({ steps, current, furthest, onSelect }) {
  const currentIdx = steps.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
      {steps.map((s, idx) => {
        const Icon = s.icon
        const reached = idx <= furthest
        const isCurrent = s.key === current
        const isDone = idx < currentIdx
        return (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            disabled={!reached}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${isCurrent
                ? 'bg-blueprint-dark text-white border-blueprint-dark'
                : isDone
                  ? 'bg-sage-light text-sage border-sage/30'
                  : reached
                    ? 'text-ink-soft border-line hover:text-ink'
                    : 'text-ink-soft/40 border-line/50 cursor-not-allowed'
              }`}
          >
            {isDone ? <Check size={12} /> : <Icon size={12} />}
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

function StepFooter({ onBack, onContinue, saving, continueLabel = 'Continue', disabled = false }) {
  return (
    <div className="flex items-center gap-2 mt-6">
      {onBack && (
        <button
          onClick={onBack}
          className="px-4 py-3 rounded-xl text-sm font-medium text-ink-soft border border-line hover:bg-paper-raised"
        >
          Back
        </button>
      )}
      <button
        onClick={onContinue}
        disabled={saving || disabled}
        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60 transition-colors"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {saving ? 'Saving…' : continueLabel}
      </button>
    </div>
  )
}

// ---------------- Attendance ----------------

function AttendanceStep({ students, attendance, onToggle, onMarkAllPresent, presentCount, totalStudents, onContinue, saving }) {
  if (totalStudents === 0) {
    return (
      <div className="border border-dashed border-line rounded-xl p-8 text-center">
        <Users size={26} className="text-ink-soft mx-auto mb-2" strokeWidth={1.6} />
        <p className="font-display font-medium text-ink">No students found for this class</p>
        <p className="text-sm text-ink-soft mt-1 max-w-xs mx-auto">
          Add students for this grade and section on the Students page, or continue without attendance.
        </p>
        <StepFooter onContinue={onContinue} saving={saving} continueLabel="Continue without attendance" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-soft">{totalStudents} Students</p>
        <button
          onClick={onMarkAllPresent}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sage-light text-sage hover:opacity-90"
        >
          <CheckCircle2 size={13} /> Mark All Present
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat label="Present" value={presentCount} tone="sage" />
        <MiniStat label="Absent" value={totalStudents - presentCount} tone="rust" />
        <MiniStat label="Total" value={totalStudents} tone="ink" />
      </div>

      <div className="border border-line rounded-xl divide-y divide-line overflow-hidden bg-paper-raised">
        {students.map((s, idx) => {
          const present = attendance[s.id] !== false
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-paper transition-colors"
            >
              <span className="text-xs font-mono-data text-ink-soft w-5 shrink-0">{idx + 1}.</span>
              <span className={`flex-1 text-sm min-w-0 truncate ${present ? 'text-ink' : 'text-ink-soft line-through'}`}>
                {s.name}
              </span>
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${present ? 'bg-sage border-sage' : 'bg-rust-light border-rust'
                  }`}
              >
                {present ? <Check size={13} className="text-white" strokeWidth={3} /> : <X size={13} className="text-rust" strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>

      <StepFooter onContinue={onContinue} saving={saving} />
    </div>
  )
}

function MiniStat({ label, value, tone }) {
  const toneClasses = { sage: 'text-sage', rust: 'text-rust', ink: 'text-ink' }
  return (
    <div className="bg-paper-raised border border-line rounded-lg py-2.5 text-center">
      <p className={`font-display font-semibold text-lg ${toneClasses[tone]}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-soft font-mono-data">{label}</p>
    </div>
  )
}

// ---------------- Activity ----------------

function ActivityStep({
  kit,
  entry,
  activities,
  activityId,
  setActivityId,
  customActivity,
  setCustomActivity,
  activityStatus,
  setActivityStatus,
  activityNote,
  setActivityNote,
  onBack,
  onContinue,
  saving,
}) {
  const hasPicker = !!kit && activities.length > 0
  const canContinue = hasPicker ? !!activityId : customActivity.trim().length > 0

  return (
    <div>
      <div className="bg-paper-raised border border-line rounded-xl p-4 mb-4">
        <p className="text-xs text-ink-soft font-mono-data mb-1">Curriculum</p>
        <p className="font-display font-medium text-sm text-ink">
          {kit ? kit.kitName : entry.kitName || 'No kit linked to this class'}
        </p>
      </div>

      {hasPicker ? (
        <SelectField label="Activity" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          <option value="">Select an activity…</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </SelectField>
      ) : (
        <TextField
          label="Activity"
          value={customActivity}
          onChange={(e) => setCustomActivity(e.target.value)}
          placeholder="What did the class work on?"
        />
      )}

      <div className="mt-4">
        <span className="text-xs font-medium text-ink-soft mb-1.5 block">Status</span>
        <div className="flex gap-2">
          {[
            { value: 'completed', label: 'Completed' },
            { value: 'partial', label: 'Partially Completed' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActivityStatus(opt.value)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${activityStatus === opt.value
                  ? 'bg-blueprint-light text-blueprint-dark border-blueprint'
                  : 'text-ink-soft border-line'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <TextField
        className="mt-4"
        label="Note (optional)"
        value={activityNote}
        onChange={(e) => setActivityNote(e.target.value)}
        placeholder="e.g. Ran out of time for wiring"
      />

      <StepFooter onBack={onBack} onContinue={onContinue} saving={saving} disabled={!canContinue} />
    </div>
  )
}

// ---------------- Toolkit ----------------

function ToolkitStep({ rows, options, onAdd, onUpdate, onRemove, onBack, onContinue, saving }) {
  return (
    <div>
      {rows.length === 0 && (
        <div className="border border-dashed border-line rounded-xl p-6 text-center mb-4">
          <Wrench size={22} className="text-ink-soft mx-auto mb-2" strokeWidth={1.6} />
          <p className="text-sm text-ink-soft">No toolkits added for this class yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={idx} className="bg-paper-raised border border-line rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                value={row.group}
                onChange={(e) => onUpdate(idx, { group: e.target.value })}
                className="flex-1 min-w-0 text-sm font-medium bg-transparent outline-none text-ink"
              />
              <button
                onClick={() => onRemove(idx)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-medium text-ink-soft mb-1.5 block">Toolkit</span>
                <input
                  list="toolkit-ids"
                  value={row.toolkitId}
                  onChange={(e) => onUpdate(idx, { toolkitId: e.target.value.toUpperCase() })}
                  placeholder="e.g. MEX-001"
                  className="w-full px-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink outline-none focus:border-blueprint"
                />
              </div>
              <SelectField
                label="Status"
                value={row.status}
                onChange={(e) => onUpdate(idx, { status: e.target.value })}
              >
                {TOOLKIT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectField>
            </div>

            {row.status !== 'returned' && (
              <TextField
                className="mt-3"
                label="Issue note"
                value={row.issueNote}
                onChange={(e) => onUpdate(idx, { issueNote: e.target.value })}
                placeholder="e.g. Missing axle"
              />
            )}
          </div>
        ))}
      </div>

      <datalist id="toolkit-ids">
        {options.map((t) => (
          <option key={t.id} value={t.toolkitId} />
        ))}
      </datalist>

      <button
        onClick={onAdd}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium text-blueprint border border-dashed border-blueprint/40 hover:bg-blueprint-light"
      >
        <Plus size={15} /> Add Toolkit
      </button>

      <StepFooter onBack={onBack} onContinue={onContinue} saving={saving} />
    </div>
  )
}

// ---------------- Photos ----------------

function PhotosStep({ photos, uploadingCount, error, fileInputRef, onPick, onFiles, onCaption, onRemove, onBack, onContinue, saving }) {
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={onFiles}
        className="hidden"
      />

      {error && (
        <p className="mb-3 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      <button
        onClick={onPick}
        className="w-full flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-line text-ink-soft hover:border-blueprint hover:text-blueprint transition-colors mb-4"
      >
        <Camera size={20} />
        <span className="text-sm font-medium">Add Photos</span>
      </button>

      {uploadingCount > 0 && (
        <p className="text-xs text-ink-soft flex items-center gap-1.5 mb-3">
          <Loader2 size={13} className="animate-spin" /> Uploading {uploadingCount} photo{uploadingCount > 1 ? 's' : ''}…
        </p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {photos.map((p, idx) => (
            <div key={p.publicId || idx} className="bg-paper-raised border border-line rounded-xl overflow-hidden">
              <div className="aspect-square bg-paper">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-2 flex items-center gap-2">
                <input
                  value={p.caption}
                  onChange={(e) => onCaption(idx, e.target.value)}
                  placeholder="Caption (optional)"
                  className="flex-1 min-w-0 text-xs bg-transparent outline-none text-ink placeholder:text-ink-soft/60"
                />
                <button
                  onClick={() => onRemove(idx)}
                  aria-label="Remove photo"
                  className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-ink-soft hover:bg-rust-light hover:text-rust"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <StepFooter onBack={onBack} onContinue={onContinue} saving={saving} continueLabel={photos.length ? 'Continue' : 'Skip Photos'} />
    </div>
  )
}

// ---------------- Remarks ----------------

function RemarksStep({ remarks, setRemarks, onToggleChip, onBack, onContinue, saving }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {REMARK_CHIPS.map((chip) => {
          const active = remarks.includes(chip)
          return (
            <button
              key={chip}
              onClick={() => onToggleChip(chip)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active
                  ? 'bg-blueprint-dark text-white border-blueprint-dark'
                  : 'text-ink-soft border-line hover:border-blueprint hover:text-blueprint'
                }`}
            >
              {chip}
            </button>
          )
        })}
      </div>

      <TextAreaField
        label="Remarks"
        rows={5}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Students participated actively…"
      />

      <StepFooter onBack={onBack} onContinue={onContinue} saving={saving} continueLabel={remarks ? 'Continue' : 'Skip Remarks'} />
    </div>
  )
}

// ---------------- Summary ----------------

function SummaryStep({ entry, presentCount, totalStudents, activityName, activityStatus, toolkitRows, photos, remarks, onBack, onComplete, completing, error }) {
  const returnedCount = toolkitRows.filter((r) => r.status === 'returned').length

  return (
    <div>
      <div className="bg-paper-raised border border-line rounded-xl divide-y divide-line overflow-hidden">
        <SummaryRow label="Grade" value={`${entry.grade}${entry.section}`} />
        <SummaryRow label="Attendance" value={totalStudents ? `${presentCount} / ${totalStudents}` : '—'} />
        <SummaryRow label="Activity" value={activityName || '—'} sub={activityStatus === 'partial' ? 'Partially completed' : 'Completed'} />
        <SummaryRow label="Toolkits" value={toolkitRows.length ? `${returnedCount} / ${toolkitRows.length} Returned` : 'None tracked'} />
        <SummaryRow label="Photos" value={String(photos.length)} />
        <SummaryRow label="Remarks" value={remarks || '—'} />
      </div>

      {error && (
        <p className="mt-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      <div className="flex items-center gap-2 mt-6">
        <button
          onClick={onBack}
          className="px-4 py-3 rounded-xl text-sm font-medium text-ink-soft border border-line hover:bg-paper-raised"
        >
          Back
        </button>
        <button
          onClick={onComplete}
          disabled={completing}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold bg-sage text-white hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {completing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {completing ? 'Saving…' : 'Save & Complete'}
        </button>
      </div>
      {completing && (
        <p className="text-xs text-ink-soft text-center mt-2 flex items-center justify-center gap-1">
          <RotateCcw size={11} /> Saving to Firestore…
        </p>
      )}
    </div>
  )
}

function SummaryRow({ label, value, sub }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <span className="text-xs text-ink-soft font-mono-data uppercase tracking-wide shrink-0 pt-0.5">{label}</span>
      <div className="text-right min-w-0">
        <p className="text-sm text-ink font-medium truncate">{value}</p>
        {sub && <p className="text-[11px] text-ink-soft">{sub}</p>}
      </div>
    </div>
  )
}