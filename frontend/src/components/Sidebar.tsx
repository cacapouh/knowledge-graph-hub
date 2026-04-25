import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Database,
  Share2,
  Hexagon,
  BookOpen,
  Network,
  HardDrive,
  Bookmark,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/datasets', icon: Database, label: 'Datasets' },
  { to: '/ontology', icon: Share2, label: 'Ontology' },
  { to: '/graph', icon: Network, label: 'Graph' },
  { to: '/views', icon: Bookmark, label: 'Views' },
  { to: '/backups', icon: HardDrive, label: 'Backups' },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-64 bg-brand-950 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <Hexagon className="w-8 h-8 text-brand-400" />
        <span className="text-xl font-bold tracking-tight">KG Hub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/30 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Tutorial Link */}
      <div className="px-3 py-4 border-t border-white/10">
        <a
          href="/tutorial.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <BookOpen className="w-5 h-5" />
          Tutorial
        </a>
      </div>
    </aside>
  )
}
