import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { ClockIcon } from '@heroicons/react/24/outline'

const SLA_HOURS = { critical: 4, high: 24, medium: 48, low: 72 }

export default function SLATimer({ slaDeadline, status, priority, createdAt }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  if (status === 'closed' || status === 'resolved') return null

  let deadline = slaDeadline ? new Date(slaDeadline).getTime() : null

  // Calculate from creation + priority hours if no explicit deadline
  if (!deadline && createdAt && priority) {
    const hours = SLA_HOURS[priority] || 48
    deadline = new Date(createdAt).getTime() + hours * 3600000
  }

  if (!deadline) return null

  const diffMs = deadline - now
  const diffHours = diffMs / 3600000
  const absDiffHours = Math.abs(diffHours)
  const hours = Math.floor(absDiffHours)
  const minutes = Math.floor((absDiffHours - hours) * 60)

  // Determine total SLA window to calculate percentage remaining
  const totalHours = SLA_HOURS[priority] || 48
  const percentRemaining = (diffHours / totalHours) * 100

  let colorClass
  if (diffMs < 0) {
    colorClass = 'bg-red-100 text-red-700'
  } else if (percentRemaining < 20) {
    colorClass = 'bg-red-100 text-red-700'
  } else if (percentRemaining < 50) {
    colorClass = 'bg-yellow-100 text-yellow-700'
  } else {
    colorClass = 'bg-green-100 text-green-700'
  }

  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', colorClass)}>
      <ClockIcon className="w-3 h-3" />
      {diffMs < 0
        ? `BREACHED ${hours}h ${minutes}m ago`
        : `${hours}h ${minutes}m left`}
    </span>
  )
}
