import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellIcon, CheckCircleIcon, ExclamationTriangleIcon,
  InformationCircleIcon, ArrowPathIcon, DocumentTextIcon
} from '@heroicons/react/24/outline'
import api from '../api/axios'
import { useNotifications } from '../context/NotificationContext'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format, isValid, isToday, isYesterday } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function safeFormat(d) {
  if (!d) return ''
  const dt = new Date(d)
  return isValid(dt) ? format(dt, 'MMM dd, h:mm a') : ''
}

function getNotificationIcon(type) {
  const iconClass = 'w-5 h-5'
  switch (type) {
    case 'complaint_assigned': return <DocumentTextIcon className={clsx(iconClass, 'text-blue-500')} />
    case 'status_update': return <ArrowPathIcon className={clsx(iconClass, 'text-purple-500')} />
    case 'escalation': return <ExclamationTriangleIcon className={clsx(iconClass, 'text-red-500')} />
    case 'resolved': return <CheckCircleIcon className={clsx(iconClass, 'text-green-500')} />
    case 'sla_warning': return <ExclamationTriangleIcon className={clsx(iconClass, 'text-orange-500')} />
    default: return <InformationCircleIcon className={clsx(iconClass, 'text-gray-500')} />
  }
}

function groupNotifications(notifications) {
  const today = []
  const yesterday = []
  const earlier = []
  notifications.forEach(n => {
    const d = new Date(n.created_at)
    if (isToday(d)) today.push(n)
    else if (isYesterday(d)) yesterday.push(n)
    else earlier.push(n)
  })
  return { today, yesterday, earlier }
}

export default function Notifications() {
  const { refreshCount } = useNotifications()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      refreshCount()
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark all as read')
    }
  }

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      try {
        await api.put(`/notifications/${n.id}/read`)
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
        refreshCount()
      } catch {
        // silently fail
      }
    }
    if (n.complaint_id) {
      navigate(`/complaints/${n.complaint_id}`)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const { today, yesterday, earlier } = groupNotifications(notifications)

  const renderGroup = (label, items) => {
    if (items.length === 0) return null
    return (
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{label}</h3>
        <div className="space-y-1">
          {items.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={clsx(
                'flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-colors border',
                n.is_read
                  ? 'bg-white border-gray-100 hover:bg-gray-50'
                  : 'bg-blue-50 border-blue-100 hover:bg-blue-100'
              )}
            >
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                n.is_read ? 'bg-gray-100' : 'bg-white shadow-sm'
              )}>
                {getNotificationIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={clsx('text-sm', n.is_read ? 'text-gray-700' : 'text-gray-900 font-medium')}>
                    {n.title || n.message}
                  </p>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  )}
                </div>
                {n.title && n.message && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{safeFormat(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4" />
            Mark All as Read
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
          <BellIcon className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No notifications yet</p>
          <p className="text-gray-400 text-sm mt-1">You'll be notified of important updates here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderGroup('Today', today)}
          {renderGroup('Yesterday', yesterday)}
          {renderGroup('Earlier', earlier)}
        </div>
      )}
    </div>
  )
}
