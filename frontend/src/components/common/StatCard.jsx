import React from 'react'
import clsx from 'clsx'

const COLOR_STYLES = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', text: 'text-green-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', text: 'text-red-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', text: 'text-yellow-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', text: 'text-purple-600' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', text: 'text-orange-600' },
}

export default function StatCard({ title, value, icon: Icon, color = 'blue', change, description }) {
  const styles = COLOR_STYLES[color] || COLOR_STYLES.blue

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
          {change !== undefined && change !== null && (
            <p className={clsx('text-sm mt-1 font-medium', change >= 0 ? 'text-green-600' : 'text-red-600')}>
              {change >= 0 ? '+' : ''}{change}% from last period
            </p>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-3 rounded-lg', styles.icon)}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  )
}
