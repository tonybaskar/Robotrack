import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  UsersRound,
  BookOpen,
  Wrench,
  PlayCircle,
  FileBarChart,
  Settings,
  LogOut,
  Cpu,
  MoreHorizontal,
} from 'lucide-react'
import { logout } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'

// Order follows the spec's data flow: Students -> Lab Groups -> Curriculum
// -> Toolkits -> Class Sessions -> Reports.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/timetable', label: 'Timetable', icon: CalendarClock },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/lab-groups', label: 'Lab Groups', icon: UsersRound },
  { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { to: '/toolkits', label: 'Toolkits', icon: Wrench },
  { to: '/sessions', label: 'Class Sessions', icon: PlayCircle },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

// The bottom bar only has room for ~5 thumb-reach slots. These four are the
// ones a trainer taps mid-classroom; everything else (including the new
// Lab Groups page) lives one tap away in "More" rather than overflowing
// the bar or scrolling it — same tap depth, no crowding.
const MOBILE_PRIMARY = ['/', '/timetable', '/sessions', '/reports']

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const mobilePrimaryItems = NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.to))
  const moreItems = NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.to))
  const isMoreActive = moreItems.some((i) => matchesRoute(i, location.pathname))

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
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
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
            {mobilePrimaryItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10.5px] ${isActive ? 'text-blueprint-dark' : 'text-ink-soft'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${isActive ? 'bg-blueprint-light' : ''
                        }`}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    {label === 'Dashboard' ? 'Today' : label}
                  </>
                )}
              </NavLink>
            ))}

            <button
              onClick={() => setMoreOpen(true)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10.5px] ${isMoreActive ? 'text-blueprint-dark' : 'text-ink-soft'
                }`}
            >
              <span
                className={`h-9 w-9 rounded-full flex items-center justify-center ${isMoreActive ? 'bg-blueprint-light' : ''
                  }`}
              >
                <MoreHorizontal size={18} strokeWidth={isMoreActive ? 2.4 : 2} />
              </span>
              More
            </button>
          </div>
        </nav>

        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          items={moreItems}
          pathname={location.pathname}
        />
      </div>
    </div>
  )
}

function matchesRoute(item, pathname) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to)
}

function MoreSheet({ open, onClose, items, pathname }) {
  return (
    <Modal open={open} onClose={onClose} title="More" size="sm">
      <div className="grid grid-cols-3 gap-2 -mx-1">
        {items.map(({ to, label, icon: Icon, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs text-center ${active ? 'bg-blueprint-light text-blueprint-dark font-medium' : 'text-ink-soft hover:bg-paper'
                }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              {label}
            </NavLink>
          )
        })}
      </div>
    </Modal>
  )
}