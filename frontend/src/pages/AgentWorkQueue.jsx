import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QueueListIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import StatusBadge from '../components/common/StatusBadge'
import PriorityBadge from '../components/common/PriorityBadge'
import SLATimer from '../components/common/SLATimer'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format, isValid } from 'date-fns'
import toast from 'react-hot-toast'

function hasRole(user, ...roles) { return roles.includes(user?.role) }
function safeFormat(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return isValid(dt) ? format(dt, 'MMM dd, yyyy') : 'N/A'
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_customer', label: 'Pending Customer' },
  { value: 'escalated', label: 'Escalated' },
]

export default function AgentWorkQueue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const isAdminSupervisor = hasRole(user, 'admin', 'supervisor')

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: 50 })
      if (statusFilter) params.append('status', statusFilter)
      const res = await api.get(`/complaints?${params}`)
      const data = res.data.data || []
      // Sort by SLA urgency (escalated & critical first)
      const sorted = [...data].sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      })
      setComplaints(sorted)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, isAdminSupervisor, user?.id])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const doAction = async (id, action, data) => {
    setActionLoading(id + action)
    try {
      if (action === 'start') {
        await api.patch(`/complaints/${id}/status`, { status: 'in_progress' })
        toast.success('Started working on complaint')
      } else if (action === 'resolve') {
        await api.post(`/complaints/${id}/resolve`, { resolution_notes: 'Resolved from work queue' })
        toast.success('Complaint marked resolved')
      }
      fetchQueue()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isAdminSupervisor ? 'All Complaints Queue' : 'My Work Queue'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{complaints.length} items</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading queue..." />
      ) : complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <QueueListIcon className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No complaints in queue</p>
          <p className="text-gray-400 text-sm mt-1">
            {statusFilter ? 'Try a different filter.' : 'Your queue is empty!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {c.complaint_number}
                    </span>
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                    <SLATimer
                      slaDeadline={c.sla_deadline}
                      status={c.status}
                      priority={c.priority}
                      createdAt={c.created_at}
                    />
                  </div>
                  <p className="font-semibold text-gray-800 truncate">{c.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                    <span>Customer: {c.customer?.name || 'N/A'}</span>
                    <span>Category: {c.category?.name || c.category || 'N/A'}</span>
                    <span>Created: {safeFormat(c.created_at)}</span>
                    {c.agent?.name && <span>Agent: {c.agent.name}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isAdminSupervisor && (
                    <>
                      {(c.status === 'open' || c.status === 'assigned') && (
                        <button
                          onClick={() => doAction(c.id, 'start')}
                          disabled={actionLoading === c.id + 'start'}
                          className="btn-primary text-xs py-1.5"
                        >
                          Start Working
                        </button>
                      )}
                      {c.status === 'in_progress' && (
                        <button
                          onClick={() => doAction(c.id, 'resolve')}
                          disabled={actionLoading === c.id + 'resolve'}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700 transition-colors font-medium"
                        >
                          Resolve
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/complaints/${c.id}`)}
                    className="btn-secondary text-xs py-1.5"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
