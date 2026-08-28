import { useEffect, useMemo, useState } from 'react'
import {
    UsersRound,
    Wrench,
    Search,
    ArrowRightLeft,
    Plus,
    History,
    RefreshCw,
    Loader2,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TextField, SelectField } from '../components/ui/Field'
import { getAllStudents } from '../services/students'
import { getAllToolkits } from '../services/toolkits'
import { programForGrade } from '../services/timetable'
import {
    getGroupsForClass,
    distributeIntoGroups,
    saveGroups,
    updateGroup,
    addStudentToGroup,
    moveStudent,
    getGroupHistory,
    assignRoles,
    MILESTONES,
} from '../services/labGroups'
import { formatShortDate } from '../utils/date'

export default function LabGroups() {
    const [allStudents, setAllStudents] = useState([])
    const [toolkits, setToolkits] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [banner, setBanner] = useState('')

    const [classKey, setClassKey] = useState('')
    const [groups, setGroups] = useState([])
    const [groupsLoading, setGroupsLoading] = useState(false)

    const [numGroups, setNumGroups] = useState(4)
    const [preview, setPreview] = useState(null)
    const [saving, setSaving] = useState(false)
    const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)

    const [search, setSearch] = useState('')
    const [moveTarget, setMoveTarget] = useState(null) // { student, fromGroupId }
    const [historyGroup, setHistoryGroup] = useState(null)
    const [addToGroupId, setAddToGroupId] = useState(null)

    useEffect(() => {
        load()
    }, [])

    async function load() {
        setLoading(true)
        setError('')
        try {
            const [students, allToolkits] = await Promise.all([getAllStudents(), getAllToolkits()])
            setAllStudents(students)
            setToolkits(allToolkits)
        } catch {
            setError('Could not load students. Check your connection.')
        } finally {
            setLoading(false)
        }
    }

    const classOptions = useMemo(() => {
        const map = new Map()
        allStudents
            .filter((s) => s.active !== false)
            .forEach((s) => {
                const key = `${s.grade}|${s.section || ''}`
                if (!map.has(key)) map.set(key, { grade: s.grade, section: s.section || '', count: 0 })
                map.get(key).count += 1
            })
        return [...map.values()].sort((a, b) => Number(a.grade) - Number(b.grade) || a.section.localeCompare(b.section))
    }, [allStudents])

    useEffect(() => {
        if (!classKey && classOptions.length > 0) {
            const first = classOptions[0]
            setClassKey(`${first.grade}|${first.section}`)
        }
    }, [classOptions, classKey])

    const [grade, section] = classKey.split('|')
    const classStudents = useMemo(
        () => allStudents.filter((s) => s.active !== false && s.grade === grade && (s.section || '') === section),
        [allStudents, grade, section]
    )

    useEffect(() => {
        if (!classKey) return
        let cancelled = false
        async function loadGroups() {
            setGroupsLoading(true)
            setPreview(null)
            try {
                const g = await getGroupsForClass(grade, section)
                if (!cancelled) setGroups(g)
            } catch {
                if (!cancelled) setError('Could not load lab groups for this class.')
            } finally {
                if (!cancelled) setGroupsLoading(false)
            }
        }
        loadGroups()
        return () => {
            cancelled = true
        }
    }, [classKey, grade, section])

    const assignedIds = useMemo(
        () => new Set(groups.flatMap((g) => g.studentIds || [])),
        [groups]
    )
    const unassigned = classStudents.filter((s) => !assignedIds.has(s.id))
    const studentById = useMemo(() => new Map(allStudents.map((s) => [s.id, s])), [allStudents])

    function handleGeneratePreview() {
        setPreview(distributeIntoGroups(classStudents, Number(numGroups) || 1))
    }

    async function handleSaveGroups(list) {
        setSaving(true)
        setError('')
        try {
            await saveGroups(grade, section, list)
            setBanner('Groups saved.')
            setPreview(null)
            setGroups(await getGroupsForClass(grade, section))
        } catch {
            setError('Could not save groups. Check your connection.')
        } finally {
            setSaving(false)
        }
    }

    async function handleAssignToolkit(groupId, toolkitId) {
        await updateGroup(groupId, { toolkitId })
        setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, toolkitId } : g)))
    }

    async function handleMove(targetGroupId) {
        if (!moveTarget) return
        const { student, fromGroupId } = moveTarget
        await moveStudent(fromGroupId, targetGroupId, student.id)
        setGroups(await getGroupsForClass(grade, section))
        setMoveTarget(null)
    }

    async function handleAddStudent(groupId, studentId) {
        await addStudentToGroup(groupId, studentId)
        setGroups(await getGroupsForClass(grade, section))
        setAddToGroupId(null)
    }

    const searchResults = search.trim()
        ? classStudents.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
        : []

    function groupForStudent(studentId) {
        return groups.find((g) => (g.studentIds || []).includes(studentId))
    }

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
            <PageHeader
                title="Lab Groups"
                subtitle="Organize students into groups for practical/lab work — persists across classes."
            />

            {banner && <p className="mb-4 text-sm text-sage bg-sage-light rounded-lg px-4 py-2.5">{banner}</p>}
            {error && <p className="mb-4 text-sm text-rust bg-rust-light rounded-lg px-4 py-2.5">{error}</p>}

            {loading ? (
                <p className="text-sm text-ink-soft">Loading students…</p>
            ) : classOptions.length === 0 ? (
                <EmptyState
                    icon={UsersRound}
                    title="No students yet"
                    description="Add students on the Students page first, then come back to build lab groups."
                />
            ) : (
                <>
                    <SelectField
                        label="Class / Section"
                        value={classKey}
                        onChange={(e) => setClassKey(e.target.value)}
                        className="mb-6 max-w-xs"
                    >
                        {classOptions.map((c) => (
                            <option key={`${c.grade}|${c.section}`} value={`${c.grade}|${c.section}`}>
                                Grade {c.grade}{c.section} ({c.count} students)
                            </option>
                        ))}
                    </SelectField>

                    {/* Search */}
                    <div className="relative mb-6 max-w-sm">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search a student in this class"
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-paper-raised text-sm text-ink placeholder:text-ink-soft/60 outline-none focus:border-blueprint"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-paper-raised border border-line rounded-lg shadow-lg overflow-hidden">
                                {searchResults.map((s) => {
                                    const g = groupForStudent(s.id)
                                    return (
                                        <div key={s.id} className="flex items-center gap-2 px-3 py-2 border-b border-line last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-ink truncate">{s.name}</p>
                                                <p className="text-xs text-ink-soft">
                                                    Grade {grade}{section} · {g ? g.groupName : 'Unassigned'}
                                                </p>
                                            </div>
                                            {g && (
                                                <button
                                                    onClick={() => {
                                                        setMoveTarget({ student: s, fromGroupId: g.id })
                                                        setSearch('')
                                                    }}
                                                    className="flex items-center gap-1 text-xs font-medium text-blueprint hover:text-blueprint-dark shrink-0"
                                                >
                                                    <ArrowRightLeft size={12} /> Move
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {groupsLoading ? (
                        <p className="text-sm text-ink-soft">Loading groups…</p>
                    ) : groups.length === 0 ? (
                        <GeneratorPanel
                            totalStudents={classStudents.length}
                            numGroups={numGroups}
                            setNumGroups={setNumGroups}
                            onGenerate={handleGeneratePreview}
                            preview={preview}
                            onSave={() => handleSaveGroups(preview)}
                            saving={saving}
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <StatBox label="Total Students" value={classStudents.length} />
                                <StatBox label="Groups" value={groups.length} />
                                <StatBox
                                    label="Students / Group"
                                    value={Math.round(classStudents.length / groups.length) || 0}
                                />
                            </div>

                            {unassigned.length > 0 && (
                                <p className="mb-4 text-xs text-rust bg-rust-light rounded-lg px-3 py-2">
                                    {unassigned.length} student{unassigned.length === 1 ? '' : 's'} not yet in a group.
                                </p>
                            )}

                            <div className="space-y-3 mb-6">
                                {groups.map((g) => (
                                    <GroupCard
                                        key={g.id}
                                        group={g}
                                        program={programForGrade(grade)}
                                        otherGroups={groups.filter((o) => o.id !== g.id)}
                                        studentById={studentById}
                                        toolkits={toolkits}
                                        unassigned={unassigned}
                                        onAssignToolkit={(toolkitId) => handleAssignToolkit(g.id, toolkitId)}
                                        onMoveStart={(student) => setMoveTarget({ student, fromGroupId: g.id })}
                                        onAddStudent={() => setAddToGroupId(g.id)}
                                        onViewHistory={() => setHistoryGroup(g)}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={() => setRegenConfirmOpen(true)}
                                className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-rust"
                            >
                                <RefreshCw size={13} /> Regenerate groups for this class
                            </button>
                        </>
                    )}
                </>
            )}

            {/* Move student modal */}
            <Modal
                open={!!moveTarget}
                onClose={() => setMoveTarget(null)}
                title={moveTarget ? `Move ${moveTarget.student.name}` : 'Move Student'}
                size="sm"
            >
                <p className="text-xs text-ink-soft mb-3">Choose the group to move this student into.</p>
                <div className="space-y-1.5">
                    {groups
                        .filter((g) => g.id !== moveTarget?.fromGroupId)
                        .map((g) => (
                            <button
                                key={g.id}
                                onClick={() => handleMove(g.id)}
                                className="w-full text-left px-3 py-2.5 rounded-lg border border-line hover:border-blueprint hover:bg-blueprint-light text-sm text-ink"
                            >
                                {g.groupName}
                                <span className="text-xs text-ink-soft ml-1.5">({(g.studentIds || []).length} students)</span>
                            </button>
                        ))}
                </div>
            </Modal>

            {/* Add student modal */}
            <Modal
                open={!!addToGroupId}
                onClose={() => setAddToGroupId(null)}
                title="Add Student to Group"
                size="sm"
            >
                {unassigned.length === 0 ? (
                    <p className="text-sm text-ink-soft">Every student in this class is already in a group.</p>
                ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {unassigned.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => handleAddStudent(addToGroupId, s.id)}
                                className="w-full text-left px-3 py-2.5 rounded-lg border border-line hover:border-blueprint hover:bg-blueprint-light text-sm text-ink"
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
            </Modal>

            {/* History modal */}
            <HistoryModal
                group={historyGroup}
                grade={grade}
                section={section}
                onClose={() => setHistoryGroup(null)}
            />

            <ConfirmDialog
                open={regenConfirmOpen}
                onClose={() => setRegenConfirmOpen(false)}
                onConfirm={() => {
                    setRegenConfirmOpen(false)
                    setGroups([])
                }}
                title="Regenerate groups?"
                message={`This clears the current grouping for Grade ${grade}${section}. Toolkit assignments and history from past sessions are not affected.`}
                confirmLabel="Regenerate"
            />
        </div>
    )
}

function StatBox({ label, value }) {
    return (
        <div className="bg-paper-raised border border-line rounded-xl p-3 text-center">
            <p className="font-display font-semibold text-xl text-ink">{value}</p>
            <p className="text-[10px] uppercase tracking-wide text-ink-soft font-mono-data mt-0.5">{label}</p>
        </div>
    )
}

function GeneratorPanel({ totalStudents, numGroups, setNumGroups, onGenerate, preview, onSave, saving }) {
    return (
        <div className="border border-dashed border-line rounded-xl p-6">
            {!preview ? (
                <>
                    <p className="text-sm text-ink-soft mb-4">
                        {totalStudents} students in this class. Choose how many groups to split them into.
                    </p>
                    <div className="flex items-end gap-3">
                        <TextField
                            label="Number of Groups"
                            type="number"
                            min={1}
                            max={Math.max(1, totalStudents)}
                            value={numGroups}
                            onChange={(e) => setNumGroups(e.target.value)}
                            className="w-40"
                        />
                        <button
                            onClick={onGenerate}
                            disabled={totalStudents === 0}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60"
                        >
                            Generate Groups
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-sm font-medium text-ink mb-3">Preview</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                        {preview.map((g) => (
                            <div key={g.groupName} className="bg-paper-raised border border-line rounded-lg p-3">
                                <p className="text-xs font-medium text-ink mb-1">{g.groupName}</p>
                                <p className="text-xs text-ink-soft font-mono-data">{g.studentIds.length} students</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blueprint-dark text-white hover:bg-blueprint disabled:opacity-60 flex items-center gap-1.5"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Save Groups
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

function GroupCard({
    group,
    program,
    studentById,
    toolkits,
    onAssignToolkit,
    onMoveStart,
    onAddStudent,
    onViewHistory,
}) {
    const members = (group.studentIds || []).map((id) => studentById.get(id)).filter(Boolean)
    const milestoneIndex = group.milestoneIndex || 0

    // Live preview of "who has which role right now" — same rotation math
    // StartClass uses, computed here assuming everyone is present so the
    // trainer can see the rotation without starting a class (spec: FEATURE
    // 6). The actual per-class assignment (with real attendance) is done
    // in Start Class and can differ if someone is absent that day.
    const roleByStudentId = new Map(
        assignRoles({
            memberOrder: group.studentIds || [],
            program,
            rotationOffset: group.roleRotationOffset || 0,
        }).map((r) => [r.studentId, r.role])
    )

    return (
        <div className="bg-paper-raised border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <p className="font-display font-semibold text-sm text-ink">{group.groupName}</p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onViewHistory}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper"
                        title="Activity history"
                    >
                        <History size={14} />
                    </button>
                    <button
                        onClick={onAddStudent}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-ink-soft hover:bg-paper"
                        title="Add student"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Project milestone (spec: FEATURE 7) */}
            <div className="mb-3 bg-paper rounded-lg border border-line px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono-data uppercase tracking-wide text-ink-soft">
                        Project: {MILESTONES[milestoneIndex]}
                    </span>
                    <span className="text-[11px] text-ink-soft font-mono-data">
                        {milestoneIndex + 1}/{MILESTONES.length}
                    </span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                        className="h-full bg-blueprint-dark rounded-full transition-all"
                        style={{ width: `${((milestoneIndex + 1) / MILESTONES.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
                <Wrench size={13} className="text-ink-soft shrink-0" />
                <select
                    value={group.toolkitId || ''}
                    onChange={(e) => onAssignToolkit(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-line bg-paper text-xs text-ink outline-none focus:border-blueprint"
                >
                    <option value="">No toolkit assigned</option>
                    {toolkits.map((t) => (
                        <option key={t.id} value={t.toolkitId}>{t.toolkitId}</option>
                    ))}
                </select>
            </div>

            {members.length === 0 ? (
                <p className="text-xs text-ink-soft">No students in this group yet.</p>
            ) : (
                <ul className="space-y-1.5">
                    {members.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-ink truncate">{s.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                {roleByStudentId.get(s.id) && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blueprint-light text-blueprint">
                                        {roleByStudentId.get(s.id)}
                                    </span>
                                )}
                                <button
                                    onClick={() => onMoveStart(s)}
                                    className="text-xs text-ink-soft hover:text-blueprint flex items-center gap-1"
                                >
                                    <ArrowRightLeft size={11} /> Move
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {members.length > 0 && (
                <p className="text-[11px] text-ink-soft mt-2.5">
                    Roles rotate automatically each class — see full history via the clock icon above.
                </p>
            )}
        </div>
    )
}

const STATUS_LABEL = {
    completed: 'Completed',
    working: 'Working',
    'needs-help': 'Needs Help',
    'not-started': 'Not Started',
}

function HistoryModal({ group, grade, section, onClose }) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!group) return
        let cancelled = false
        setLoading(true)
        getGroupHistory(grade, section, group.id)
            .then((h) => {
                if (!cancelled) setHistory(h)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [group, grade, section])

    return (
        <Modal open={!!group} onClose={onClose} title={group ? `${group.groupName} — History` : 'History'}>
            {loading ? (
                <p className="text-sm text-ink-soft">Loading…</p>
            ) : history.length === 0 ? (
                <p className="text-sm text-ink-soft">No completed classes recorded for this group yet.</p>
            ) : (
                <ul className="space-y-3">
                    {history.map((h, idx) => (
                        <li key={idx} className="border-b border-line pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-ink">{h.activityName || 'Untitled activity'}</p>
                                <span className="text-xs font-mono-data text-ink-soft">{formatShortDate(h.date)}</span>
                            </div>
                            <p className="text-xs text-ink-soft mt-0.5">{STATUS_LABEL[h.status] || h.status}</p>
                            {h.remarks && <p className="text-xs text-ink mt-1">{h.remarks}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    )
}