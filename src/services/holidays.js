// Holidays mark an entire date as a non-class day (spec: FEATURE 2).
// When a date has a holiday doc, the Dashboard shows every class for that
// date as HOLIDAY instead of Upcoming/In Progress, no session is created,
// and no attendance is recorded. Reports simply never see a session for
// that date, so holiday exclusion from attendance % is automatic.

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'holidays'

/** All holidays, most recent first — used by the Holidays management page. */
export async function getAllHolidays() {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** The holiday doc for one date, or null — used by the Dashboard's daily check. */
export async function getHolidayForDate(dateStr) {
    const q = query(collection(db, COLLECTION), where('date', '==', dateStr))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
}

export function addHoliday({ date, name, description }) {
    return addDoc(collection(db, COLLECTION), {
        date,
        name: name.trim(),
        description: (description || '').trim(),
    })
}

export function deleteHoliday(id) {
    return deleteDoc(doc(db, COLLECTION, id))
}