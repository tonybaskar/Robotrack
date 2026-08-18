import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

const KITS = 'curriculum'
const ACTIVITIES = 'activities'

export async function getAllKits() {
  const snap = await getDocs(collection(db, KITS))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.gradeRange || '').localeCompare(b.gradeRange || '') || (a.order || 0) - (b.order || 0))
}

export async function getActivitiesForKit(kitId) {
  const q = query(collection(db, ACTIVITIES), where('curriculumId', '==', kitId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
}

export async function getAllActivities() {
  const snap = await getDocs(collection(db, ACTIVITIES))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function addKit(kit) {
  return addDoc(collection(db, KITS), kit)
}

export function updateKit(id, kit) {
  return updateDoc(doc(db, KITS, id), kit)
}

export async function deleteKit(id) {
  const activities = await getActivitiesForKit(id)
  const batch = writeBatch(db)
  activities.forEach((a) => batch.delete(doc(db, ACTIVITIES, a.id)))
  batch.delete(doc(db, KITS, id))
  await batch.commit()
}

export function addActivity(activity) {
  return addDoc(collection(db, ACTIVITIES), activity)
}

export function updateActivity(id, activity) {
  return updateDoc(doc(db, ACTIVITIES, id), activity)
}

export function deleteActivity(id) {
  return deleteDoc(doc(db, ACTIVITIES, id))
}

// ---- Term 1 seed data (project spec, section 10) ----

const TERM1_KITS = [
  {
    gradeRange: '1-2',
    program: 'CHAMPS',
    kitName: 'OMOTOOLS Early Electronics',
    order: 1,
    activities: [
      'Basic Circuit of LED and Bulb Glow',
      'Electric Fan',
      'Magnet Controlled Lamp & Motor',
      'Charging & Discharging',
      'Humidity Tester',
      'Simple Street Electric Lamp',
      'Sound Controlled Flashing Color Lamp',
      'Blow Fan',
      'Capstone Project 1',
      'Flashing Colour Lamp & Birthday Music',
      'Darkness Controlled Light Music',
    ],
  },
  {
    gradeRange: '3-4',
    program: 'CHAMPS',
    kitName: 'MEX Starter Kit',
    order: 1,
    activities: ['Introduction to the Kit', 'Mobile', 'Crane', 'Snow Sweeper', 'Forklift', 'Dobby'],
  },
  {
    gradeRange: '3-4',
    program: 'CHAMPS',
    kitName: 'MEX Explorer Kit',
    order: 2,
    activities: ['Introduction to the Kit', 'Mountain Bike (MTB)', 'Retro Car'],
  },
  {
    gradeRange: '5-6',
    program: 'CHAMPS',
    kitName: 'School Mech Building with Automation',
    order: 1,
    activities: [
      'Introduction',
      'Hit the Ball',
      'Fence Gate',
      'Paper Shredder',
      'Cable Car',
      'Smart Axe',
      'Foldable Bridge',
      'Clap Based Race Car',
      'Line Follower',
      'Bump Bot',
      'Sweeper Bot',
      'Welcome Robot',
    ],
  },
  {
    gradeRange: '7-9',
    program: 'TECHNO',
    kitName: 'Avishkaar IoT Kit / Wireless RGB Mood Lamp',
    order: 1,
    activities: [
      'Introduction to the IoT Kit & Wireless RGB Mood Lamp',
      'Control Method – Avishkaar Maker Studio (AMS)',
      'Digital Dice',
      'Air Quality Monitor',
      'Animated Dragon',
      'Visitor Counter',
    ],
  },
  {
    gradeRange: '7-9',
    program: 'TECHNO',
    kitName: 'School Mech Building with Automation',
    order: 2,
    activities: [
      'Introduction to Mech Building with Automation',
      'Ferris Wheel',
      'Fun with Circle',
      'Fence Gate',
      'Smart Axe',
      'Automatic Door',
    ],
  },
]

/** Returns true if Term 1 has already been seeded. */
export async function isTerm1Seeded() {
  const q = query(collection(db, KITS), where('term', '==', 'Term 1'))
  const snap = await getDocs(q)
  return !snap.empty
}

/** One-time write of the Term 1 curriculum from the project spec. */
export async function seedTerm1Curriculum() {
  const alreadySeeded = await isTerm1Seeded()
  if (alreadySeeded) return 0

  const batch = writeBatch(db)
  let kitCount = 0

  TERM1_KITS.forEach((kit) => {
    const kitRef = doc(collection(db, KITS))
    batch.set(kitRef, {
      term: 'Term 1',
      gradeRange: kit.gradeRange,
      program: kit.program,
      kitName: kit.kitName,
      order: kit.order,
    })
    kitCount += 1

    kit.activities.forEach((name, idx) => {
      const activityRef = doc(collection(db, ACTIVITIES))
      batch.set(activityRef, {
        curriculumId: kitRef.id,
        name,
        order: idx + 1,
      })
    })
  })

  await batch.commit()
  return kitCount
}
