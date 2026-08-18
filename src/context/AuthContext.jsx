import { createContext, useContext, useEffect, useState } from 'react'
import { watchAuthState } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const unsubscribe = watchAuthState((firebaseUser) => {
      setUser(firebaseUser)
      setCheckingAuth(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, checkingAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
