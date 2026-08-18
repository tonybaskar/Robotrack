import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  BookOpen,
  Wrench,
  PlayCircle,
  FileBarChart,
  Settings,
  LogOut,
  Cpu,
} from 'lucide-react'
import { logout } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/timetable', label: 'Timetable', icon: CalendarClock },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { to: '/toolkits', label: 'Toolkits', icon: Wrench },
  { to: '/sessions', label: 'Class Sessions', icon: PlayCircle },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// Bottom nav keeps only what a trainer needs mid-classroom, one thumb-reach away.
const MOBILE_NAV_ITEMS = [
  { to: '/', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/timetable', label: 'Timetable', icon: CalendarClock },
  { to: '/sessions', label: 'Sessions', icon: PlayCircle },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-dvh bg-paper flex">
      {/* Desktop rail */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-line bg-paper-raised">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-line">
          <span className="h-8 w-8 rounded-md bg-blueprint-dark flex items-center justify-center">
            <Cpu size={17} className="text-amber" strokeWidth={2} />
          </span>
          <div className="leading-tight">
            <p className="font-display font-semibold text-[15px] text-ink">RoboTrack</p>
            <p className="text-[11px] text-ink-soft font-mono-data">Trainer Console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blueprint-light text-blueprint-dark font-medium'
                    : 'text-ink-soft hover:bg-paper hover:text-ink'
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <span className="h-8 w-8 rounded-full bg-amber-light flex items-center justify-center font-display font-semibold text-sm text-blueprint-dark">
              {(user?.email || 'T')[0].toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{user?.email}</p>
              <p className="text-[11px] text-ink-soft">Trainer</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-soft hover:bg-rust-light hover:text-rust transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-line bg-paper-raised sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-md bg-blueprint-dark flex items-center justify-center">
              <Cpu size={14} className="text-amber" />
            </span>
            <p className="font-display font-semibold text-[15px]">RoboTrack</p>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="h-8 w-8 rounded-md flex items-center justify-center text-ink-soft active:bg-paper"
          >
            <LogOut size={16} />
          </button>
        </header>

        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-paper-raised border-t border-line px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+4px)]">
          <div className="flex items-stretch justify-between">
            {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10.5px] ${
                    isActive ? 'text-blueprint-dark' : 'text-ink-soft'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        isActive ? 'bg-blueprint-light' : ''
                      }`}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
