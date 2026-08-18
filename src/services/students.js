import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'students'

export async function getAllStudents() {
  const snap = await getDocs(collection(db, COLLECTION))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      if (a.grade !== b.grade) return Number(a.grade) - Number(b.grade)
      if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '')
      return Number(a.rollNumber || 0) - Number(b.rollNumber || 0)
    })
}

/**
 * Students for one class, for the attendance screen.
 * Filters the existing roster client-side instead of adding a new
 * composite index — the roster is small (one trainer, a few hundred rows).
 */
export async function getStudentsForClass(grade, section) {
  const all = await getAllStudents()
  return all.filter(
    (s) =>
      s.active !== false &&
      String(s.grade) === String(grade) &&
      (s.section || '') === (section || '')
  )
}

export function addStudent(student) {
  return addDoc(collection(db, COLLECTION), { active: true, ...student })
}

export function updateStudent(id, student) {
  return updateDoc(doc(db, COLLECTION, id), student)
}

export function deleteStudent(id) {
  return deleteDoc(doc(db, COLLECTION, id))
}

export function toggleStudentActive(id, active) {
  return updateDoc(doc(db, COLLECTION, id), { active })
}

/**
 * Bulk import from parsed CSV rows.
 * Expected headers (case-insensitive): name, rollNumber, grade, section
 */
export async function bulkImportStudents(rows) {
  const batch = writeBatch(db)
  let count = 0

  rows.forEach((row) => {
    const name = row.name || row.Name
    const grade = row.grade || row.Grade
    if (!name || !grade) return

    const ref = doc(collection(db, COLLECTION))
    batch.set(ref, {
      name: String(name).trim(),
      rollNumber: String(row.rollNumber || row.RollNumber || row.roll || '').trim(),
      grade: String(grade).trim(),
      section: String(row.section || row.Section || '').trim().toUpperCase(),
      active: true,
    })
    count += 1
  })

  if (count > 0) await batch.commit()
  return count
}
