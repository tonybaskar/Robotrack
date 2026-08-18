import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'toolkits'

export const TOOLKIT_STATUSES = ['available', 'in-use', 'missing', 'damaged']

export async function getAllToolkits() {
  const snap = await getDocs(collection(db, COLLECTION))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.toolkitId || '').localeCompare(b.toolkitId || ''))
}

export function addToolkit(toolkit) {
  return addDoc(collection(db, COLLECTION), { status: 'available', ...toolkit })
}

export function updateToolkit(id, toolkit) {
  return updateDoc(doc(db, COLLECTION, id), toolkit)
}

export function deleteToolkit(id) {
  return deleteDoc(doc(db, COLLECTION, id))
}
