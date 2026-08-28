// A cancellation marks one specific class period, on one specific date, as
// not conducted (spec: FEATURE 3). Unlike a holiday (which blanks out every
// class for a date) a cancellation is scoped to a single timetable entry +
// date, so a doc id of `${timetableId}_${date}` keeps lookups to a single
// equality query and guarantees at most one cancellation record per class
// period per day — the same deterministic-id idea sessions.js already uses
// for the start-class race condition.

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    doc,
    serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from './firebase'

const COLLECTION = 'cancellations'

export const CANCELLATION_REASONS = [
    'Exam',
    'Sports Activity',
    'School Function',
    'Special Event',
    'Trainer Unavailable',
    'Timetable Change',
    'Other',
]

function cancellationId(timetableId, dateStr) {
    return `${timetableId}_${dateStr}`
}

/** The cancellation for one class period on one date, or null. */
export async function getCancellation(timetableId, dateStr) {
    const snap = await getDoc(doc(db, COLLECTION, cancellationId(timetableId, dateStr)))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
}

/**
 * Every cancellation for a date, keyed by timetableId — one read for the
 * whole day's timetable instead of one query per period (used by the
 * Dashboard, which already loads the full day's timetable in one shot).
 */
export async function getCancellationsForDate(dateStr) {
    const q = query(collection(db, COLLECTION), where('date', '==', dateStr))
    const snap = await getDocs(q)
    const byTimetableId = new Map()
    snap.docs.forEach((d) => byTimetableId.set(d.data().timetableId, { id: d.id, ...d.data() }))
    return byTimetableId
}

/** Cancellation history, most recent first — used by Reports / Timetable. */
export async function getAllCancellations() {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function cancelClass({ timetableId, date, grade, section, program, reason, note }) {
    return setDoc(doc(db, COLLECTION, cancellationId(timetableId, date)), {
        timetableId,
        date,
        grade,
        section: section || '',
        program,
        reason,
        note: (note || '').trim(),
        cancelledBy: auth.currentUser?.email || null,
        createdAt: serverTimestamp(),
    })
}

/** Undo a cancellation — the class becomes startable again. */
export function uncancelClass(timetableId, dateStr) {
    return deleteDoc(doc(db, COLLECTION, cancellationId(timetableId, dateStr)))
}