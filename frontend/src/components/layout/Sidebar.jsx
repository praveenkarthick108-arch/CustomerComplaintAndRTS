import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import {
  HomeIcon,
  DocumentTextIcon,
  PlusCircleIcon,
  QueueListIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  UsersIcon,
  BellIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

function hasRole(user, ...roles) {
  return roles.includes(user?.role)
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const baseNavItems = [
    { to: '/', label: 'Dashboard', icon: HomeIcon, end: true },
    { to: '/complaints', label: hasRole(user, 'customer') ? 'My Complaints' : 'Complaints', icon: DocumentTextIcon },
    { to: '/notifications', label: 'Notifications', icon: BellIcon },
    { to: '/profile', label: 'Profile', icon: UserCircleIcon },
  ]

  const roleNavItems = []

  if (hasRole(user, 'customer')) {
    roleNavItems.push({ to: '/complaints/new', label: 'New Complaint', icon: PlusCircleIcon })
  }

  if (hasRole(user, 'agent', 'supervisor', 'admin')) {
    roleNavItems.push({ to: '/work-queue', label: 'Work Queue', icon: QueueListIcon })
  }

  if (hasRole(user, 'supervisor', 'admin')) {
    roleNavItems.push(
      { to: '/escalations', label: 'Escalations', icon: ExclamationTriangleIcon },
      { to: '/reports', label: 'Reports', icon: ChartBarIcon }
    )
  }

  if (hasRole(user, 'quality')) {
    roleNavItems.push({ to: '/reports', label: 'Reports', icon: ChartBarIcon })
  }

  if (hasRole(user, 'admin')) {
    roleNavItems.push({ to: '/users', label: 'Users', icon: UsersIcon })
  }

  const allNavItems = [
    ...baseNavItems.slice(0, 1),
    ...roleNavItems,
    ...baseNavItems.slice(1),
  ]

  return (
    <div className="w-64 bg-blue-800 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-700">
        <ShieldCheckIcon className="w-8 h-8 text-blue-200" />
        <span className="text-white font-bold text-lg leading-tight">
          Complaint<br />Tracker
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {allNavItems.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:bg-blue-700 hover:text-white'
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-blue-700">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-blue-300 text-xs capitalize truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700 hover:text-white transition-colors w-full"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
