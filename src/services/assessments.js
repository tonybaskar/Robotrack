// Student assessments (spec: FEATURE 11) are periodic, trainer-entered
// evaluations — separate from a class session's attendance/activity data,
// so they get their own collection rather than living on `sessions`
// (a student is assessed occasionally, not every class).

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'assessments'

// CHAMPS (grades 1-5): qualitative 3-point scale.
export const CHAMPS_SCALE = [
    { value: 'good', label: 'Good', emoji: '🙂' },
    { value: 'developing', label: 'Developing', emoji: '😐' },
    { value: 'needs-practice', label: 'Needs Practice', emoji: '🔄' },
]
export const CHAMPS_CRITERIA = [
    { key: 'participation', label: 'Participation' },
    { key: 'building', label: 'Building' },
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'followingInstructions', label: 'Following Instructions' },
    { key: 'handlingComponents', label: 'Handling Components' },
]

// TECHNO (grades 6-9): 1-5 numeric scale.
export const TECHNO_CRITERIA = [
    { key: 'building', label: 'Building' },
    { key: 'programming', label: 'Programming' },
    { key: 'testing', label: 'Testing' },
    { key: 'problemSolving', label: 'Problem Solving' },
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'projectCompletion', label: 'Project Completion' },
]

const CHAMPS_SCORE_VALUE = { good: 3, developing: 2, 'needs-practice': 1 }

/** Overall score: average of 1-5 for TECHNO, or the modal band for CHAMPS. */
export function computeOverall(program, scores) {
    const criteria = program === 'TECHNO' ? TECHNO_CRITERIA : CHAMPS_CRITERIA
    const values = criteria
        .map((c) => scores[c.key])
        .filter((v) => v !== undefined && v !== null && v !== '')

    if (values.length === 0) return null

    if (program === 'TECHNO') {
        const avg = values.reduce((sum, v) => sum + Number(v), 0) / values.length
        return Math.round(avg * 10) / 10
    }
    const avg = values.reduce((sum, v) => sum + (CHAMPS_SCORE_VALUE[v] || 0), 0) / values.length
    if (avg >= 2.5) return 'good'
    if (avg >= 1.5) return 'developing'
    return 'needs-practice'
}

export async function getAssessmentsForStudent(studentId) {
    const q = query(
        collection(db, COLLECTION),
        where('studentId', '==', studentId),
        orderBy('date', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getAssessmentsForClass(grade, section) {
    const q = query(
        collection(db, COLLECTION),
        where('grade', '==', String(grade)),
        where('section', '==', section || '')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function addAssessment({ studentId, studentName, grade, section, program, date, scores, remark }) {
    return addDoc(collection(db, COLLECTION), {
        studentId,
        studentName,
        grade: String(grade),
        section: section || '',
        program,
        date,
        scores,
        overall: computeOverall(program, scores),
        remark: (remark || '').trim(),
        createdAt: serverTimestamp(),
    })
}

export function deleteAssessment(id) {
    return deleteDoc(doc(db, COLLECTION, id))
}