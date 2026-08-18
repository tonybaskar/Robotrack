import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Cpu, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { login } from '../services/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(mapAuthError(err.code))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-blueprint-dark blueprint-grid p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blueprint-dark/40 via-transparent to-blueprint-dark/70 pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-7">
          <span className="h-12 w-12 rounded-xl bg-amber flex items-center justify-center shadow-lg shadow-amber/20 mb-4">
            <Cpu size={24} className="text-blueprint-dark" strokeWidth={2.2} />
          </span>
          <h1 className="font-display font-semibold text-2xl text-white tracking-tight">RoboTrack</h1>
          <p className="text-blueprint-light/70 text-sm mt-1 font-mono-data">Robotics Trainer Console</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-paper-raised rounded-2xl p-6 shadow-xl border border-white/10"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-soft mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink placeholder:text-ink-soft/60 focus:border-blueprint focus:ring-1 focus:ring-blueprint outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink placeholder:text-ink-soft/60 focus:border-blueprint focus:ring-1 focus:ring-blueprint outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-rust bg-rust-light rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-blueprint-dark text-white font-medium text-sm py-2.5 rounded-lg hover:bg-blueprint transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-blueprint-light/50 text-xs mt-5 font-mono-data">
          Tue · Wed · Thu — CHAMPS &amp; TECHNO
        </p>
      </div>
    </div>
  )
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a moment.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    default:
      return 'Could not sign in. Check your connection and try again.'
  }
}
