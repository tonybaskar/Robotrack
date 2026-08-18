import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, checkingAuth } = useAuth()

  if (checkingAuth) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-paper">
        <div className="flex items-center gap-3 text-ink-soft font-mono-data text-sm">
          <span className="h-2 w-2 rounded-full bg-blueprint animate-pulse" />
          Loading workspace…
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
