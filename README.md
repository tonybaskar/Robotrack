# RoboTrack — Robotics Trainer Management System

Phase 1: project setup, authentication, app shell, and the Dashboard reading
today's timetable + progress live from Firestore.

## Stack
React + Vite + Tailwind CSS v4 + React Router + Firebase (Auth + Firestore) +
Cloudinary (images only, wired in from Phase 3 onward).

## 1. Install

```bash
npm install
```

## 2. Configure Firebase

1. Create a Firebase project (or reuse one) at console.firebase.google.com.
2. Enable **Authentication -> Sign-in method -> Email/Password**.
3. Enable **Firestore Database** (production mode is fine).
4. Manually create your trainer login under Authentication -> Users
   (email + password) — there's no public sign-up screen, on purpose.
5. Project settings -> General -> "Your apps" -> add a Web app -> copy the
   config values into `.env` (copy `.env.example` to `.env` first).

## 3. Configure Cloudinary (needed from Phase 3 — class photos)

1. Create a free Cloudinary account.
2. Settings -> Upload -> Upload presets -> Add upload preset -> set
   **Signing Mode: Unsigned**. Note the preset name.
3. Put your cloud name + preset name into `.env`.

## 4. Run

```bash
npm run dev
```

## 5. Seed a timetable entry (so the Dashboard has something to show)

The Dashboard reads the `timetable` Firestore collection and filters by
today's day name. Until the Timetable page ships in Phase 2, add a document
by hand in the Firestore console under a `timetable` collection, e.g.:

```json
{
  "day": "Tuesday",
  "period": 3,
  "grade": "5",
  "section": "A",
  "program": "CHAMPS",
  "room": "School Mech Building",
  "kitName": "Paper Shredder",
  "startTime": "10:15",
  "endTime": "10:55"
}
```

Reload the Dashboard on a Tuesday (or edit `day` to match today) and it will
appear on the circuit-rail timeline automatically.

## What's built (Phase 1)

- Email/password login (Firebase Auth), protected routing
- App shell: desktop sidebar rail, mobile top bar + bottom nav
- Dashboard: greeting, today's date, today's classes pulled live from
  `timetable` + `sessions`, today's progress stats (classes / attendance /
  reports / toolkit issues)
- Service layer (`src/services`) for firebase, auth, timetable, sessions,
  cloudinary — ready for Phase 2/3 screens to build on top of
- Placeholder screens for Timetable, Students, Curriculum, Toolkits, Class
  Sessions, Reports, Settings, so navigation is complete even before those
  phases are built

## Next phases

See the original spec: Phase 2 (Students / Timetable / Curriculum /
Toolkits CRUD), Phase 3 (the Start Class workflow — attendance, activity,
toolkit return, photos, remarks, complete class), Phase 4 (Daily / Weekly /
Monthly reports + PDF/Excel export).

## Phase 3 — Class Session Workflow

The main day-to-day screen: **Today's Classes → Start Class → Attendance →
Activity → Toolkit → Photos → Remarks → Complete**, all saved to one
`sessions` document.

* `src/pages/StartClass.jsx` — the step-by-step workflow (`/sessions/start/:timetableId`).
  Each step saves to Firestore as the trainer moves forward, so nothing is
  lost on a refresh. Reopening a class that's already `started` resumes
  where you left off; reopening a `completed` one goes straight to its report.
* `src/pages/SessionReport.jsx` — the read-only Class Completion Report
  (`/sessions/:sessionId`), generated entirely from the session document.
* `src/pages/Sessions.jsx` — history list of every session, newest first
  (`/sessions`).
* `src/services/sessions.js` — session CRUD (`createSession`, `updateSession`,
  `completeSession`, lookups by timetable/date/id).
* Photos go straight from the browser to **Cloudinary** — Firestore only
  ever stores `{ url, publicId, caption, uploadedAt }`. Firebase Storage is
  not used.

### Deploy Firestore security rules

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` — everything requires a signed-in trainer; there is no
public or anonymous access to any collection. `students`, `timetable`,
`curriculum`, `activities` and `toolkits` are shared operational data
(read/write for any signed-in trainer). `sessions` are additionally scoped
to the trainer who started the class (`trainerId == request.auth.uid`) —
only they can update or delete their own sessions, and a session's
`trainerId`, `timetableId` and `date` can't be changed after creation.

`firestore.indexes.json` — one composite index, on `timetable` (`day` +
`period`), which the Dashboard's "today's classes" query needs. No other
query in the app combines a filter with an `orderBy` on a different field,
so no other composite indexes are required.
