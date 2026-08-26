// Trainer/school profile, used to personalize the dashboard greeting and
// stamp reports (spec: "Settings in Reports" / "Settings in Application
// Header"). One document per trainer, keyed by their auth uid — matches
// the existing sessions.js convention of scoping data to trainerId, and
// keeps one trainer's settings invisible to another (see firestore.rules).

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase'

const COLLECTION = 'settings'

function settingsRef() {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Not signed in')
    return doc(db, COLLECTION, uid)
}

export async function getSettings() {
    const snap = await getDoc(settingsRef())
    return snap.exists() ? snap.data() : null
}

export function saveSettings(data) {
    return setDoc(
        settingsRef(),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
    )
}