import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const { isAuthenticated } = useAuth()

  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await api.get('/notifications/unread-count')
      setUnreadCount(res.data.data?.count || 0)
    } catch {
      // silently fail
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    refreshCount()
    const interval = setInterval(refreshCount, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, refreshCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

export default NotificationContext
