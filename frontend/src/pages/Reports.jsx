import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ClockIcon, ArrowDownTrayIcon
} from '@heroicons/react/24/outline'
import api from '../api/axios'
import StatCard from '../components/common/StatCard'
import LoadingSpinner from '../components/common/LoadingSpinner'
import toast from 'react-hot-toast'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
const DATE_RANGES = [
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'All Time', value: 'all' },
]

export default function Reports() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const [overviewRes, trendsRes, categoryRes, agentRes, slaRes] = await Promise.allSettled([
          api.get('/dashboard/stats'),
          api.get('/dashboard/trends'),
          api.get('/dashboard/category-breakdown'),
          api.get('/dashboard/agent-performance'),
          api.get('/dashboard/sla-report'),
        ])
        setStats({
          overview: overviewRes.status === 'fulfilled' ? overviewRes.value.data.data : {},
          monthlyTrends: trendsRes.status === 'fulfilled' ? trendsRes.value.data.data : [],
          categoryDistribution: categoryRes.status === 'fulfilled' ? categoryRes.value.data.data : [],
          agentPerformance: agentRes.status === 'fulfilled' ? agentRes.value.data.data : [],
          slaReport: slaRes.status === 'fulfilled' ? slaRes.value.data.data : null,
        })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [dateRange])

  const exportCSV = async () => {
    try {
      const res = await api.get('/complaints?limit=1000')
      const data = res.data.data || []
      const header = ['Complaint #', 'Title', 'Category', 'Priority', 'Status', 'Customer', 'Assigned To', 'Created At', 'Resolved At']
      const rows = data.map(c => [
        c.complaint_number || '',
        `"${(c.title || '').replace(/"/g, '""')}"`,
        c.category?.name || c.category || '',
        c.priority || '',
        c.status || '',
        c.customer?.name || '',
        c.agent?.name || '',
        c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
        c.resolved_at ? new Date(c.resolved_at).toLocaleDateString() : '',
      ])
      const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `complaints-report-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    } catch (err) {
      toast.error('Export failed')
    }
  }

  if (loading) return <LoadingSpinner message="Loading reports..." />
  if (!stats) return null

  const overview = stats.overview || {}
  const categoryDist = stats.categoryDistribution || []
  const monthlyTrends = stats.monthlyTrends || []
  const agentPerformance = stats.agentPerformance || []
  const slaReport = stats.slaReport || null

  const statusChartData = [
    { name: 'Open', value: overview.open || 0 },
    { name: 'Assigned', value: overview.assigned || 0 },
    { name: 'In Progress', value: overview.in_progress || 0 },
    { name: 'Pending', value: overview.pending_customer || 0 },
    { name: 'Escalated', value: overview.escalated || 0 },
    { name: 'Resolved', value: overview.resolved || 0 },
    { name: 'Closed', value: overview.closed || 0 },
  ].filter(s => s.value > 0)

  const categoryChartData = categoryDist.map(c => ({
    name: c.category || 'Unknown',
    value: c.total || 0
  }))

  const trendData = monthlyTrends.map(m => ({
    month: m.month,
    total: m.total || 0,
    resolved: m.resolved || 0,
    escalated: m.escalated || 0,
  }))

  const agentChartData = agentPerformance.slice(0, 8).map(a => ({
    name: (a.agent_name || '').split(' ')[0],
    assigned: a.total_assigned || 0,
    resolved: a.resolved || 0,
  }))

  const totalResolved = overview.resolved || 0
  const totalComplaints = overview.total || 1
  const resolutionRate = Math.round((totalResolved / totalComplaints) * 100)
  const slaBreached = overview.sla_breached || 0
  const slaCompliance = slaReport ? slaReport.compliance_rate : Math.round(((totalComplaints - slaBreached) / totalComplaints) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">System-wide performance and metrics overview</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {DATE_RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setDateRange(r.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  dateRange === r.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Complaints" value={overview.total || 0} icon={DocumentTextIcon} color="blue" />
        <StatCard title="Resolved" value={overview.resolved || 0} icon={CheckCircleIcon} color="green" />
        <StatCard title="Escalated" value={overview.escalated || 0} icon={ExclamationTriangleIcon} color="red" />
        <StatCard title="SLA Breaches" value={slaBreached} icon={ClockIcon} color="orange" />
      </div>

      {/* Charts 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Bar */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Complaints by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusChartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Complaints by Category</h3>
          {categoryChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-gray-400">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Trends Line */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Trends</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" name="Resolved" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="escalated" stroke="#ef4444" name="Escalated" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Performance Bar */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Agent Performance</h3>
          {agentChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-gray-400">No agent data</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agentChartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" fill="#3b82f6" name="Assigned" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" fill="#22c55e" name="Resolved" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Agent Performance Table */}
      {agentPerformance.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Agent Performance Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Agent</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Total Assigned</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Resolved</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Escalated</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Avg Resolution Time</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100 table-row">
                    <td className="py-3 px-4 font-medium text-gray-800">{a.name || a.agent_name || 'N/A'}</td>
                    <td className="py-3 px-4 text-gray-600">{a.assigned || a.total_assigned || 0}</td>
                    <td className="py-3 px-4">
                      <span className="text-green-600 font-medium">{a.resolved || 0}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-red-600">{a.escalated || 0}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {a.avg_resolution_hours ? `${Math.round(a.avg_resolution_hours)}h` : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      {a.avg_rating ? (
                        <span className="text-yellow-600 font-medium">
                          {Number(a.avg_rating).toFixed(1)} / 5
                        </span>
                      ) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLA Compliance */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-6">SLA Compliance</h3>
        <div className="flex items-center gap-8 mb-6">
          <div className="text-center">
            <div className={`text-5xl font-bold ${slaCompliance >= 80 ? 'text-green-600' : slaCompliance >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {slaCompliance}%
            </div>
            <p className="text-gray-500 text-sm mt-1">Overall SLA Compliance</p>
          </div>
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${slaCompliance >= 80 ? 'bg-green-500' : slaCompliance >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${slaCompliance}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* By priority */}
        <h4 className="text-sm font-semibold text-gray-700 mb-3">SLA Compliance by Priority</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(slaReport?.by_priority || ['critical','high','medium','low'].map(p => ({ priority: p, total: 0, within_sla: 0, breached: 0, compliance_rate: 100 }))).map(row => {
            const slaHours = { critical: 4, high: 24, medium: 48, low: 72 }
            const rate = row.compliance_rate || 100
            return (
              <div key={row.priority} className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">{row.priority}</p>
                <p className="text-xs text-gray-400 mt-0.5">Target: {slaHours[row.priority]}h</p>
                <p className={`text-2xl font-bold mt-2 ${rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{rate}%</p>
                <p className="text-xs text-gray-500 mt-0.5">{row.within_sla || 0} / {row.total || 0} within SLA</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
