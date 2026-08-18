// Timetable entries live in the `timetable` collection.
// Each doc: { day, period, grade, section, program, curriculumId, kitName,
//             room, startTime, endTime }
// The dashboard reads today's day-of-week and filters + sorts by period.

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'timetable'

export const WORKING_DAYS = ['Tuesday', 'Wednesday', 'Thursday']

export const PERIODS = [
  { period: 1, label: 'Period 1', start: '08:45', end: '09:25' },
  { period: 2, label: 'Period 2', start: '09:25', end: '10:05' },
  { period: 'break', label: 'Break', start: '10:05', end: '10:15' },
  { period: 3, label: 'Period 3', start: '10:15', end: '10:55' },
  { period: 4, label: 'Period 4', start: '10:55', end: '11:35' },
  { period: 5, label: 'Period 5', start: '11:35', end: '12:15' },
  { period: 'lunch', label: 'Lunch', start: '12:15', end: '12:45' },
  { period: 6, label: 'Period 6', start: '12:45', end: '13:25' },
  { period: 7, label: 'Period 7', start: '13:25', end: '14:05' },
  { period: 'diary', label: 'Diary', start: '14:05', end: '14:15' },
  { period: 8, label: 'Period 8', start: '14:15', end: '14:50' },
  { period: 9, label: 'Period 9', start: '14:50', end: '15:30' },
]

export function programForGrade(grade) {
  const g = Number(grade)
  if (!g) return 'CHAMPS'
  return g <= 5 ? 'CHAMPS' : 'TECHNO'
}

export async function getTodaysTimetable(dayName) {
  const q = query(
    collection(db, COLLECTION),
    where('day', '==', dayName),
    orderBy('period', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Single timetable entry by id — used to start a class session. */
export async function getTimetableEntry(id) {
  const snap = await getDoc(doc(db, COLLECTION, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export function periodMetaFor(period) {
  return PERIODS.find((p) => String(p.period) === String(period)) || null
}

export async function getAllTimetable() {
  const snap = await getDocs(collection(db, COLLECTION))
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return rows.sort((a, b) => {
    const dayDiff = WORKING_DAYS.indexOf(a.day) - WORKING_DAYS.indexOf(b.day)
    if (dayDiff !== 0) return dayDiff
    return Number(a.period) - Number(b.period)
  })
}

export function addTimetableEntry(entry) {
  return addDoc(collection(db, COLLECTION), entry)
}

export function updateTimetableEntry(id, entry) {
  return updateDoc(doc(db, COLLECTION, id), entry)
}

export function deleteTimetableEntry(id) {
  return deleteDoc(doc(db, COLLECTION, id))
}
