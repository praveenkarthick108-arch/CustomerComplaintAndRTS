import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  DocumentTextIcon, ExclamationTriangleIcon, CheckCircleIcon,
  ClockIcon, PlusCircleIcon, ArrowTrendingUpIcon, UserGroupIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import StatCard from '../components/common/StatCard'
import StatusBadge from '../components/common/StatusBadge'
import PriorityBadge from '../components/common/PriorityBadge'
import SLATimer from '../components/common/SLATimer'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format, isValid } from 'date-fns'
import toast from 'react-hot-toast'

function hasRole(user, ...roles) { return roles.includes(user?.role) }

function safeFormat(dateStr, fmt = 'MMM dd, yyyy') {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : 'N/A'
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState([])
  const [agentPerformance, setAgentPerformance] = useState([])
  const [recentComplaints, setRecentComplaints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const requests = [
          api.get('/dashboard/stats'),
          api.get('/complaints?limit=10&sort=created_at&order=desc'),
        ]

        if (hasRole(user, 'admin', 'supervisor', 'quality')) {
          requests.push(api.get('/dashboard/trends'))
          requests.push(api.get('/dashboard/agent-performance'))
        }

        const results = await Promise.allSettled(requests)

        if (results[0].status === 'fulfilled') setStats(results[0].value.data.data)
        if (results[1].status === 'fulfilled') setRecentComplaints(results[1].value.data.data || [])
        if (results[2]?.status === 'fulfilled') setTrends(results[2].value.data.data || [])
        if (results[3]?.status === 'fulfilled') setAgentPerformance(results[3].value.data.data || [])
      } catch (err) {
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  if (loading) return <LoadingSpinner message="Loading dashboard..." />

  // ---- Customer Dashboard ----
  if (hasRole(user, 'customer')) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h2>
            <p className="text-gray-500 text-sm mt-1">Here's an overview of your complaints.</p>
          </div>
          <button onClick={() => navigate('/complaints/new')} className="btn-primary flex items-center gap-2">
            <PlusCircleIcon className="w-5 h-5" />
            New Complaint
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Complaints" value={stats?.total || 0} icon={DocumentTextIcon} color="blue" />
          <StatCard title="Open / In Progress" value={(stats?.open || 0) + (stats?.in_progress || 0) + (stats?.assigned || 0)} icon={ClockIcon} color="yellow" />
          <StatCard title="Resolved" value={(stats?.resolved || 0) + (stats?.closed || 0)} icon={CheckCircleIcon} color="green" />
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Recent Complaints</h3>
          {recentComplaints.length === 0 ? (
            <div className="text-center py-8">
              <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No complaints yet.</p>
              <button onClick={() => navigate('/complaints/new')} className="btn-primary mt-4">
                Submit Your First Complaint
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Complaint #</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Title</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Priority</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentComplaints.slice(0, 5).map(c => (
                    <tr key={c.id} className="table-row border-b border-gray-100 cursor-pointer"
                      onClick={() => navigate(`/complaints/${c.id}`)}>
                      <td className="py-2 px-3 text-blue-600 font-mono text-xs">{c.complaint_number}</td>
                      <td className="py-2 px-3 font-medium text-gray-800 max-w-xs truncate">{c.title}</td>
                      <td className="py-2 px-3"><PriorityBadge priority={c.priority} /></td>
                      <td className="py-2 px-3"><StatusBadge status={c.status} /></td>
                      <td className="py-2 px-3 text-gray-500">{safeFormat(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Agent Dashboard ----
  if (hasRole(user, 'agent')) {
    const myAssigned = recentComplaints.filter(c => c.status === 'assigned').length
    const myInProgress = recentComplaints.filter(c => c.status === 'in_progress').length
    const urgent = recentComplaints.filter(c => c.sla_status?.isBreached || c.sla_status?.status === 'at_risk')

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Work Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Your assigned complaints and performance overview.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Assigned" value={stats?.total || 0} icon={DocumentTextIcon} color="blue" />
          <StatCard title="In Progress" value={stats?.in_progress || 0} icon={ClockIcon} color="yellow" />
          <StatCard title="Resolved / Closed" value={(stats?.resolved || 0) + (stats?.closed || 0)} icon={CheckCircleIcon} color="green" />
        </div>

        {urgent.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-800">Urgent: SLA at Risk or Breached ({urgent.length})</h3>
            </div>
            <div className="space-y-2">
              {urgent.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-3 cursor-pointer"
                  onClick={() => navigate(`/complaints/${c.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.title}</p>
                    <p className="text-xs text-gray-500 font-mono">{c.complaint_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={c.priority} />
                    <SLATimer slaDeadline={c.sla_deadline} status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">My Work Queue</h3>
            <button onClick={() => navigate('/work-queue')} className="text-sm text-blue-600 hover:underline">View All</button>
          </div>
          {recentComplaints.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No complaints in your queue.</p>
          ) : (
            <div className="space-y-2">
              {recentComplaints.slice(0, 6).map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/complaints/${c.id}`)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{c.complaint_number}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Admin / Supervisor / Quality Dashboard ----
  const statusChartData = [
    { name: 'Open', value: stats?.open || 0, fill: '#3b82f6' },
    { name: 'Assigned', value: stats?.assigned || 0, fill: '#8b5cf6' },
    { name: 'In Progress', value: stats?.in_progress || 0, fill: '#f59e0b' },
    { name: 'Pending', value: stats?.pending_customer || 0, fill: '#f97316' },
    { name: 'Escalated', value: stats?.escalated || 0, fill: '#ef4444' },
    { name: 'Resolved', value: stats?.resolved || 0, fill: '#22c55e' },
    { name: 'Closed', value: stats?.closed || 0, fill: '#6b7280' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Overview of all complaints and performance metrics.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total" value={stats?.total || 0} icon={DocumentTextIcon} color="blue" />
        <StatCard title="Open" value={stats?.open || 0} icon={ClockIcon} color="yellow" />
        <StatCard title="In Progress" value={stats?.in_progress || 0} icon={ArrowTrendingUpIcon} color="purple" />
        <StatCard title="Escalated" value={stats?.escalated || 0} icon={ExclamationTriangleIcon} color="red" />
        <StatCard title="Resolved" value={stats?.resolved || 0} icon={CheckCircleIcon} color="green" />
        <StatCard title="SLA Breaches" value={stats?.sla_breached || 0} icon={ExclamationTriangleIcon} color="orange" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusChartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Complaints" radius={[4, 4, 0, 0]}>
                {statusChartData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Trends</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trends} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" name="Resolved" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="escalated" stroke="#ef4444" name="Escalated" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Performance */}
      {hasRole(user, 'admin', 'supervisor') && agentPerformance.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <UserGroupIcon className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">Agent Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Agent</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Assigned</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Resolved</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Escalated</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Avg Res. Time</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((a) => (
                  <tr key={a.agent_id} className="border-b border-gray-100 table-row">
                    <td className="py-2 px-3 font-medium text-gray-800">{a.agent_name}</td>
                    <td className="py-2 px-3 text-gray-600">{a.total_assigned}</td>
                    <td className="py-2 px-3 text-green-600">{a.resolved}</td>
                    <td className="py-2 px-3 text-red-600">{a.escalated}</td>
                    <td className="py-2 px-3 text-gray-600">
                      {a.avg_resolution_hours != null ? `${a.avg_resolution_hours}h` : 'N/A'}
                    </td>
                    <td className="py-2 px-3 text-yellow-600">
                      {a.avg_rating != null ? `${a.avg_rating} / 5` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Complaints */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Recent Complaints</h3>
          <button onClick={() => navigate('/complaints')} className="text-sm text-blue-600 hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Complaint #</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Title</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Customer</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Priority</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentComplaints.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No complaints found</td></tr>
              ) : recentComplaints.map(c => (
                <tr key={c.id} className="table-row border-b border-gray-100 cursor-pointer"
                  onClick={() => navigate(`/complaints/${c.id}`)}>
                  <td className="py-2 px-3 text-blue-600 font-mono text-xs">{c.complaint_number}</td>
                  <td className="py-2 px-3 font-medium text-gray-800 max-w-xs truncate">{c.title}</td>
                  <td className="py-2 px-3 text-gray-600">{c.customer?.name || 'N/A'}</td>
                  <td className="py-2 px-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="py-2 px-3"><StatusBadge status={c.status} /></td>
                  <td className="py-2 px-3 text-gray-500">{safeFormat(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
