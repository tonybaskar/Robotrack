// Lab groups organize a class's students for practical/lab work:
//   students (existing roster) -> labGroups (this file) -> toolkits (existing,
//   referenced by toolkitId string, same convention StartClass already uses
//   for its per-class toolkit rows) -> session.groupProgress (per-class-day
//   status/remarks, written from StartClass — see sessions.js)
//
// Groups are scoped to one grade+section and persist across class days
// (spec: "Do NOT regenerate groups every time the page loads"). Only
// equality filters are used below, so no composite index is required —
// same pattern as getStudentsForClass / getCompletedSessionsForGrade.

import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch,
    runTransaction,
} from 'firebase/firestore'
import { db } from './firebase'
import { getCompletedSessionsForGrade } from './sessions'

const COLLECTION = 'labGroups'

export async function getGroupsForClass(grade, section) {
    const q = query(
        collection(db, COLLECTION),
        where('grade', '==', String(grade)),
        where('section', '==', section || '')
    )
    const snap = await getDocs(q)
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
}

/**
 * Pure distribution helper — no Firestore. Splits `students` into
 * `numGroups` groups as evenly as possible, largest groups first, so no
 * student is ever left unassigned (spec section 2).
 */
export function distributeIntoGroups(students, numGroups) {
    const n = Math.max(1, Math.min(numGroups, students.length || 1))
    const base = Math.floor(students.length / n)
    const remainder = students.length % n

    const groups = []
    let cursor = 0
    for (let i = 0; i < n; i += 1) {
        const size = base + (i < remainder ? 1 : 0)
        groups.push({
            groupName: `Group ${i + 1}`,
            order: i + 1,
            studentIds: students.slice(cursor, cursor + size).map((s) => s.id),
            toolkitId: '',
        })
        cursor += size
    }
    return groups
}

/**
 * Replaces any existing grouping for this class with a freshly generated
 * one. Called from "Save Groups" — the preview itself is only ever held
 * in local component state until the trainer confirms.
 */
export async function saveGroups(grade, section, groups) {
    const existing = await getGroupsForClass(grade, section)
    const batch = writeBatch(db)
    existing.forEach((g) => batch.delete(doc(db, COLLECTION, g.id)))
    groups.forEach((g) => {
        const ref = doc(collection(db, COLLECTION))
        batch.set(ref, {
            grade: String(grade),
            section: section || '',
            groupName: g.groupName,
            order: g.order,
            studentIds: g.studentIds,
            toolkitId: g.toolkitId || '',
            milestoneIndex: 0,
            roleRotationOffset: 0,
            roleHistory: {},
        })
    })
    await batch.commit()
}

export function updateGroup(id, patch) {
    return updateDoc(doc(db, COLLECTION, id), patch)
}

export function deleteGroup(id) {
    return deleteDoc(doc(db, COLLECTION, id))
}

export function addGroup(grade, section, order) {
    return addDoc(collection(db, COLLECTION), {
        grade: String(grade),
        section: section || '',
        groupName: `Group ${order}`,
        order,
        studentIds: [],
        toolkitId: '',
        milestoneIndex: 0,
        roleRotationOffset: 0,
        roleHistory: {},
    })
}

/** Adds a student to a group without touching any other group's membership. */
export async function addStudentToGroup(groupId, studentId) {
    const snap = await getDoc(doc(db, COLLECTION, groupId))
    if (!snap.exists()) return
    const current = snap.data().studentIds || []
    if (current.includes(studentId)) return
    await updateDoc(doc(db, COLLECTION, groupId), { studentIds: [...current, studentId] })
}

export async function removeStudentFromGroup(groupId, studentId) {
    const snap = await getDoc(doc(db, COLLECTION, groupId))
    const current = snap.exists() ? snap.data().studentIds || [] : []
    await updateDoc(doc(db, COLLECTION, groupId), {
        studentIds: current.filter((id) => id !== studentId),
    })
}

/**
 * Moves one student between two groups atomically — a transaction so a
 * student can never end up duplicated (in both groups) or dropped
 * (in neither) if two updates raced (same class of bug the sessions
 * duplicate-write fix in services/sessions.js addresses).
 */
export async function moveStudent(fromGroupId, toGroupId, studentId) {
    await runTransaction(db, async (tx) => {
        const fromRef = doc(db, COLLECTION, fromGroupId)
        const toRef = doc(db, COLLECTION, toGroupId)
        const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)])
        if (!fromSnap.exists() || !toSnap.exists()) return

        const fromIds = (fromSnap.data().studentIds || []).filter((id) => id !== studentId)
        const toIds = toSnap.data().studentIds || []
        tx.update(fromRef, { studentIds: fromIds })
        if (!toIds.includes(studentId)) {
            tx.update(toRef, { studentIds: [...toIds, studentId] })
        }
    })
}

// ---- Dynamic roles (spec: FEATURE 6) ----
// Role *rotation state* (roleRotationOffset, roleHistory) lives on the
// labGroup doc itself, since — like toolkitId — it's a property of the
// group that persists across class days, not something that belongs on a
// single session. Which roles were actually assigned *this* class period
// is session-scoped and saved onto session.roleAssignments (same pattern
// as session.groupProgress), so a completed session still shows who held
// which role that day even if the group's rotation later moves on.

export const CHAMPS_ROLES = ['Builder', 'Programmer', 'Tester', 'Recorder', 'Toolkit Manager']
export const TECHNO_ROLES = ['Builder', 'Programmer', 'Tester', 'Recorder', 'Toolkit Manager', 'Presenter']

export const ROLE_DESCRIPTIONS = {
    Builder: 'Builds the project.',
    Programmer: 'Handles the coding.',
    Tester: 'Tests and debugs.',
    Recorder: 'Maintains records.',
    'Toolkit Manager': 'Checks the toolkit.',
    Presenter: 'Explains the project.',
}

export function rolesForProgram(program) {
    return program === 'TECHNO' ? TECHNO_ROLES : CHAMPS_ROLES
}

/**
 * Roles for a group of `size` students, per the spec's fixed table
 * (2 -> Builder/Programmer, 3 -> +Tester, ... 6 -> +Presenter for TECHNO).
 * Unused roles are simply not returned ("Do not show unused roles").
 */
export function rolesForGroupSize(program, size) {
    const all = rolesForProgram(program)
    return all.slice(0, Math.max(0, Math.min(size, all.length)))
}

/**
 * Assign roles for this session using the group's stable member order and
 * its running `rotationOffset` (0 the first time a group is ever assigned
 * roles). Role for the student at position i is roles[(i + offset) % n] —
 * so each student moves one role forward every session and the whole
 * pattern wraps automatically (see spec's Session 1 -> Session 2 example).
 *
 * Absent students keep their position (so rotation for everyone else is
 * untouched) but come back with `role: null` — the caller can leave that
 * slot unassigned or temporarily fill it without disturbing `memberOrder`.
 */
export function assignRoles({ memberOrder, program, presentStudentIds, rotationOffset = 0 }) {
    const roles = rolesForGroupSize(program, memberOrder.length)
    const n = roles.length
    const presentSet = presentStudentIds ? new Set(presentStudentIds) : null

    return memberOrder.map((studentId, i) => ({
        studentId,
        role: n && i < n ? roles[(i + rotationOffset) % n] : null,
        present: presentSet ? presentSet.has(studentId) : true,
    }))
}

/** Persist the next rotation offset once a class's roles are confirmed. */
export function nextRotationOffset(currentOffset, roleCount) {
    if (!roleCount) return currentOffset || 0
    return ((currentOffset || 0) + 1) % roleCount
}

/**
 * Best-effort tally update — one role assignment per student per session,
 * so a student's profile can show "Builder: 4, Programmer: 3, ...".
 * Mirrors the toolkit-status-sync pattern in StartClass: never blocks the
 * session save if it fails.
 */
export async function recordRoleHistory(groupId, assignments) {
    const snap = await getDoc(doc(db, COLLECTION, groupId))
    if (!snap.exists()) return
    const history = { ...(snap.data().roleHistory || {}) }
    assignments.forEach(({ studentId, role }) => {
        if (!role) return
        const studentHistory = { ...(history[studentId] || {}) }
        studentHistory[role] = (studentHistory[role] || 0) + 1
        history[studentId] = studentHistory
    })
    await updateDoc(doc(db, COLLECTION, groupId), { roleHistory: history })
}

// ---- Project milestones (spec: FEATURE 7) ----
// Milestone progress lives on the labGroup doc (one group can be mid-way
// through a multi-session build while another group is further ahead), so
// "Continue from: Wiring" next session is just reading this field back.

export const MILESTONES = [
    'Introduction',
    'Planning',
    'Components',
    'Assembly',
    'Wiring',
    'Programming',
    'Testing',
    'Completed',
]

export function setGroupMilestone(groupId, milestoneIndex) {
    return updateDoc(doc(db, COLLECTION, groupId), {
        milestoneIndex: Math.max(0, Math.min(milestoneIndex, MILESTONES.length - 1)),
    })
}

/**
 * Activity history for one group, built entirely from existing completed
 * sessions (spec: "Do not create unnecessary duplicate history records").
 * Relies on session.groupProgress, written by StartClass's Lab Groups step.
 */
export async function getGroupHistory(grade, section, groupId) {
    const sessions = await getCompletedSessionsForGrade(grade, section)
    return sessions
        .map((s) => {
            const entry = (s.groupProgress || []).find((g) => g.groupId === groupId)
            if (!entry) return null
            return {
                date: s.date,
                activityName: s.activityName,
                status: entry.status || 'not-started',
                remarks: entry.remarks || '',
            }
        })
        .filter(Boolean)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
}