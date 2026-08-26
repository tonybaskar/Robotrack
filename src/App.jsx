import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Timetable from './pages/Timetable'
import Students from './pages/Students'
import Curriculum from './pages/Curriculum'
import Toolkits from './pages/Toolkits'
import LabGroups from './pages/LabGroups'
import Sessions from './pages/Sessions'
import StartClass from './pages/StartClass'
import SessionReport from './pages/SessionReport'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/students" element={<Students />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/toolkits" element={<Toolkits />} />
            <Route path="/lab-groups" element={<LabGroups />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/start/:timetableId" element={<StartClass />} />
            <Route path="/sessions/:sessionId" element={<SessionReport />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
