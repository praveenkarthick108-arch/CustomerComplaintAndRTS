import React from 'react'
import clsx from 'clsx'

const PRIORITY_STYLES = {
  low: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  medium: { badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  high: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  critical: { badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
}

export default function PriorityBadge({ priority }) {
  const styles = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium', styles.badge)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', styles.dot)} />
      {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Unknown'}
    </span>
  )
}
