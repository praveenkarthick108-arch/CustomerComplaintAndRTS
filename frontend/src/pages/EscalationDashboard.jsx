import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ExclamationTriangleIcon, ClockIcon, UserIcon
} from '@heroicons/react/24/outline'
import api from '../api/axios'
import StatusBadge from '../components/common/StatusBadge'
import PriorityBadge from '../components/common/PriorityBadge'
import SLATimer from '../components/common/SLATimer'
import StatCard from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format, isValid } from 'date-fns'
import toast from 'react-hot-toast'

function safeFormat(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return isValid(dt) ? format(dt, 'MMM dd, yyyy HH:mm') : 'N/A'
}

export default function EscalationDashboard() {
  const navigate = useNavigate()
  const [escalated, setEscalated] = useState([])
  const [slaBreached, setSlaBreached] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [reassignModal, setReassignModal] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [escalatedRes, slaRes, agentsRes] = await Promise.all([
        api.get('/complaints?status=escalated&limit=50'),
        api.get('/complaints?slaBreached=true&limit=50'),
        api.get('/users?role=agent'),
      ])
      setEscalated(escalatedRes.data.data || [])
      setSlaBreached(slaRes.data.data || [])
      setAgents(agentsRes.data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load escalations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const criticalCount = [...escalated, ...slaBreached].filter(c => c.priority === 'critical').length

  const handleReassign = async () => {
    if (!selectedAgent || !reassignModal) return
    setActionLoading(true)
    try {
      await api.patch(`/complaints/${reassignModal}/assign`, { agent_id: selectedAgent })
      toast.success('Agent reassigned successfully')
      setReassignModal(null)
      setSelectedAgent('')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reassignment failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading escalations..." />

  const renderTable = (items, title, showEscalationInfo = false) => (
    <div className="card overflow-hidden p-0">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title} ({items.length})</h3>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <p className="text-gray-400 text-sm">No items in this category</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Complaint</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Priority</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">SLA</th>
                {showEscalationInfo && (
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Escalated</th>
                )}
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Assigned Agent</th>
                <th className="py-3 px-4 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} className="border-b border-gray-100 table-row">
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-blue-600">{c.complaint_number}</span>
                    <p className="text-gray-800 font-medium truncate max-w-xs mt-0.5">{c.title}</p>
                  </td>
                  <td className="py-3 px-4"><PriorityBadge priority={c.priority} /></td>
                  <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                  <td className="py-3 px-4">
                    <SLATimer slaDeadline={c.sla_deadline} status={c.status} priority={c.priority} createdAt={c.created_at} />
                  </td>
                  {showEscalationInfo && (
                    <td className="py-3 px-4 text-xs text-gray-500">
                      <p>{safeFormat(c.escalated_at)}</p>
                      {c.escalation_reason && (
                        <p className="text-red-500 mt-0.5 italic truncate max-w-[180px]">{c.escalation_reason}</p>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-4 text-gray-600 text-xs">
                    {c.agent?.name || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setReassignModal(c.id); setSelectedAgent(c.agent?.id || '') }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => navigate(`/complaints/${c.id}`)}
                        className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2 py-1 hover:bg-gray-50 rounded transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Escalation Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Monitor and manage escalated and SLA-breached complaints.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Escalated" value={escalated.length} icon={ExclamationTriangleIcon} color="red" />
        <StatCard title="SLA Breached" value={slaBreached.length} icon={ClockIcon} color="orange" />
        <StatCard title="Critical Priority" value={criticalCount} icon={ExclamationTriangleIcon} color="purple" />
      </div>

      {/* Escalated table */}
      {renderTable(escalated, 'Escalated Complaints', true)}

      {/* SLA Breached table */}
      {renderTable(
        slaBreached.filter(c => c.status !== 'escalated'),
        'SLA Breached Complaints',
        false
      )}

      {/* Reassign Modal */}
      <Modal isOpen={!!reassignModal} onClose={() => { setReassignModal(null); setSelectedAgent('') }} title="Reassign Agent" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select New Agent</label>
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="input">
              <option value="">Choose an agent...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setReassignModal(null); setSelectedAgent('') }} className="btn-secondary">Cancel</button>
            <button onClick={handleReassign} disabled={!selectedAgent || actionLoading} className="btn-primary">
              {actionLoading ? 'Reassigning...' : 'Reassign'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
