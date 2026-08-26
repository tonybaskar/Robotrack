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