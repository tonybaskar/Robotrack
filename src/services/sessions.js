// Class sessions are the single source of truth for a conducted class:
// attendance, activity, toolkit return, remarks and photos all live on
// one session document (see project spec, section 21).
//
// A session is created (status: 'started') the moment a trainer taps
// "Start Class", then patched as they move through the workflow so
// nothing is lost on a refresh or dropped connection. "Save & Complete"
// stamps it status: 'completed'.

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from './firebase'

const COLLECTION = 'sessions'

export async function getSessionsForDate(dateStr) {
  const q = query(collection(db, COLLECTION), where('date', '==', dateStr))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Sessions between two YYYY-MM-DD strings, inclusive. Single-field range
 * query on `date` — no composite index required. This is the one query
 * every report in Phase 4 is built from; reports never hit Firestore
 * per-row, they filter/aggregate this result set locally (spec section 17).
 */
export async function getSessionsInRange(fromStr, toStr) {
  const q = query(
    collection(db, COLLECTION),
    where('date', '>=', fromStr),
    where('date', '<=', toStr),
    orderBy('date', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Completed sessions for one grade (+ optional section), regardless of
 * date — used only for cumulative curriculum/activity progress, which
 * is a running total rather than something scoped to a report's date
 * filter. Equality-only filters, so no composite index is required.
 */
export async function getCompletedSessionsForGrade(grade, section) {
  const clauses = [
    where('grade', '==', String(grade)),
    where('status', '==', 'completed'),
  ]
  if (section) clauses.push(where('section', '==', section))
  const q = query(collection(db, COLLECTION), ...clauses)
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Look up an in-progress or completed session for a given period, today. */
export async function getSessionByTimetableAndDate(timetableId, dateStr) {
  const q = query(
    collection(db, COLLECTION),
    where('timetableId', '==', timetableId),
    where('date', '==', dateStr)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function getSession(id) {
  const snap = await getDoc(doc(db, COLLECTION, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/** Most recent sessions, newest first — used by the Class Sessions list. */
export async function getRecentSessions(max = 30) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Created the moment "Start Class" is tapped. Only known-good fields, auto-filled. */
export async function createSession(data) {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    trainerId: auth.currentUser?.uid || null,
    trainerEmail: auth.currentUser?.email || null,
    attendance: null,
    activityId: null,
    activityName: '',
    activityStatus: '',
    activityNote: '',
    toolkits: [],
    photos: [],
    remarks: '',
    step: 'attendance',
    status: 'started',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Atomically fetch the existing session for this class period + date, or
 * create it if none exists yet — replaces the old "query, then addDoc if
 * empty" pattern in StartClass, which was a race condition: two calls a
 * moment apart (an effect re-running, a double-tap on "Start Class", the
 * same class opened in two tabs) could both see "nothing yet" and both
 * create a session, leaving one class period with two documents — one
 * that goes on to be completed and one orphaned "in progress" twin
 * (the Phase 3 duplicate-session bug).
 *
 * Fixed by using a deterministic document id (`${timetableId}_${date}`,
 * unique per class period per day) inside a transaction: the transaction
 * read-then-write is atomic, so a second concurrent call sees the
 * document the first call just created instead of creating its own.
 */
export async function getOrCreateSession(timetableId, dateStr, initialData) {
  const sessionId = `${timetableId}_${dateStr}`
  const ref = doc(db, COLLECTION, sessionId)

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) {
      return { id: snap.id, ...snap.data(), _existed: true }
    }
    const data = {
      ...initialData,
      timetableId,
      date: dateStr,
      trainerId: auth.currentUser?.uid || null,
      trainerEmail: auth.currentUser?.email || null,
      attendance: null,
      activityId: null,
      activityName: '',
      activityStatus: '',
      activityNote: '',
      toolkits: [],
      photos: [],
      remarks: '',
      step: 'attendance',
      status: 'started',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    tx.set(ref, data)
    return { id: sessionId, ...data, _existed: false }
  })
}

/** Patches saved as the trainer moves through each step of the workflow. */
export function updateSession(id, data) {
  return updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() })
}

export function completeSession(id, data) {
  return updateDoc(doc(db, COLLECTION, id), {
    ...data,
    status: data.status || 'completed',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// ---- Duplicate-session cleanup (Phase 3 bug fix) ----
// getOrCreateSession above stops *new* duplicates from being created.
// These helpers find and resolve duplicates that already exist from
// before the fix, without needing direct Firestore console access.

/** Every session, unfiltered — only used for the one-time duplicate scan below. */
export async function getAllSessions() {
  const snap = await getDocs(collection(db, COLLECTION))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Groups of 2+ sessions that share the same class period + date. */
export function findDuplicateSessionGroups(sessions) {
  const byKey = new Map()
  sessions.forEach((s) => {
    if (!s.timetableId || !s.date) return
    const key = `${s.timetableId}__${s.date}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(s)
  })
  return [...byKey.values()].filter((group) => group.length > 1)
}

/**
 * Resolve one duplicate group: keep the completed session if there is
 * one (it's the one with real attendance/activity/toolkit data), else
 * keep whichever was most recently updated, and delete the rest.
 */
export async function resolveDuplicateSessions(group) {
  const keeper =
    group.find((s) => s.status === 'completed') ||
    [...group].sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0]
  const toDelete = group.filter((s) => s.id !== keeper.id)
  await Promise.all(toDelete.map((s) => deleteDoc(doc(db, COLLECTION, s.id))))
  return keeper
}