// Simple email/password auth. No roles, no multi-tenant logic yet.
// An admin role can be layered on top of this later (see users collection).

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from './firebase'

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function logout() {
  return signOut(auth)
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}
