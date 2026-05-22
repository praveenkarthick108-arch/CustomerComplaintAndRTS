import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  GlobeAltIcon,
  ArrowPathIcon,
  PresentationChartLineIcon,
} from '@heroicons/react/24/outline'
import api from '../api/axios'
import LoadingSpinner from '../components/common/LoadingSpinner'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const TABS = [
  { id: 'overview', label: 'Overview', icon: ChartBarIcon },
  { id: 'sla', label: 'SLA Analysis', icon: ExclamationTriangleIcon },
  { id: 'category', label: 'Category Breakdown', icon: GlobeAltIcon },
  { id: 'agents', label: 'Agent Performance', icon: UserGroupIcon },
]

function StatCard({ title, value, sub, icon: Icon, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-3 rounded-lg ${colorMap[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function RateColor({ value }) {
  const v = parseFloat(value)
  if (isNaN(v)) return <span className="text-gray-400">—</span>
  const cls = v >= 70 ? 'text-green-600 font-semibold' : v >= 40 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'
  return <span className={cls}>{v.toFixed(1)}%</span>
}

function BreachRateColor({ value }) {
  const v = parseFloat(value)
  if (isNaN(v)) return <span className="text-gray-400">—</span>
  const cls = v > 30 ? 'text-red-600 font-semibold' : v > 15 ? 'text-yellow-600 font-semibold' : 'text-green-600 font-semibold'
  return <span className={cls}>{v.toFixed(1)}%</span>
}

export default function Analytics() {
  const [summary, setSummary] = useState(null)
  const [slaReport, setSlaReport] = useState(null)
  const [categoryStats, setCategoryStats] = useState([])
  const [agentPerformance, setAgentPerformance] = useState([])
  const [monthlyTrends, setMonthlyTrends] = useState([])
  const [regionStats, setRegionStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const results = await Promise.allSettled([
          api.get('/analytics/summary'),
          api.get('/analytics/sla-report'),
          api.get('/analytics/category-stats'),
          api.get('/analytics/agent-performance'),
          api.get('/analytics/monthly-trends'),
          api.get('/analytics/region-stats'),
        ])

        const [sumR, slaR, catR, agentR, trendR, regionR] = results

        if (sumR.status === 'fulfilled' && sumR.value.data.data === null) {
          setNoData(true)
          setLoading(false)
          return
        }

        if (sumR.status === 'fulfilled') setSummary(sumR.value.data.data)
        if (slaR.status === 'fulfilled') setSlaReport(slaR.value.data.data)
        if (catR.status === 'fulfilled') setCategoryStats(catR.value.data.data || [])
        if (agentR.status === 'fulfilled') setAgentPerformance(agentR.value.data.data || [])
        if (trendR.status === 'fulfilled') setMonthlyTrends(trendR.value.data.data || [])
        if (regionR.status === 'fulfilled') setRegionStats(regionR.value.data.data || [])

        const failCount = results.filter(r => r.status === 'rejected').length
        if (failCount > 2) {
          toast.error('Some analytics data failed to load. Check if the backend is running.')
        }
      } catch (err) {
        toast.error('Failed to load analytics data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return <LoadingSpinner message="Loading ETL analytics..." />

  if (noData) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center max-w-xl mx-auto mt-12">
          <PresentationChartLineIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">No ETL Data Found</h2>
          <p className="text-yellow-700 mb-4">The analytics tables are empty. Run the ETL pipeline to populate them.</p>
          <code className="block bg-yellow-100 text-yellow-900 rounded px-4 py-3 text-sm font-mono text-left">
            cd etl<br />
            pip install -r requirements.txt<br />
            python run_etl.py
          </code>
          <p className="text-yellow-600 text-sm mt-3">Then refresh this page.</p>
        </div>
      </div>
    )
  }

  const etlRunTime = summary?.etl_last_run
    ? (() => { try { return format(parseISO(summary.etl_last_run), 'MMM dd, yyyy HH:mm') } catch { return summary.etl_last_run } })()
    : null

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PresentationChartLineIcon className="w-7 h-7 text-blue-600" />
            ETL Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Powered by Pandas ETL pipeline · Dataset: 2024 complaints</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {summary?.etl_status && (
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${summary.etl_status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600">
                Last run: {etlRunTime || 'unknown'}
              </span>
            </span>
          )}
          {summary?.etl_rows_loaded != null && (
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {summary.etl_rows_loaded} records loaded
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Complaints"
              value={summary?.total_complaints}
              sub="From 2024 dataset"
              icon={ChartBarIcon}
              color="blue"
            />
            <StatCard
              title="SLA Breached"
              value={summary?.sla_breached}
              sub={`${(100 - (summary?.sla_compliance_rate || 0)).toFixed(1)}% breach rate`}
              icon={ExclamationTriangleIcon}
              color="red"
            />
            <StatCard
              title="Avg Resolution"
              value={summary?.avg_resolution_hours != null ? `${summary.avg_resolution_hours}h` : '—'}
              sub="For resolved complaints"
              icon={ClockIcon}
              color="yellow"
            />
            <StatCard
              title="Avg Feedback"
              value={summary?.avg_feedback_rating != null ? `${summary.avg_feedback_rating}/5` : '—'}
              sub="Customer satisfaction score"
              icon={CheckCircleIcon}
              color="green"
            />
          </div>

          {/* Monthly trends line chart */}
          {monthlyTrends.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Complaint Trends (2024)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month_year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total_complaints" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="resolved_count" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="escalated_count" name="Escalated" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Region distribution */}
          {regionStats.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Complaints by Region</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={regionStats} dataKey="total" nameKey="region" cx="50%" cy="50%" outerRadius={90} label={({ region, percent }) => `${region} ${(percent * 100).toFixed(0)}%`}>
                      {regionStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Region Details</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">Region</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Breached</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Breach %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionStats.map((r, i) => (
                      <tr key={r.region} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="py-2 px-1 font-medium">{r.region}</td>
                        <td className="py-2 px-1 text-right">{r.total}</td>
                        <td className="py-2 px-1 text-right text-red-600">{r.breached}</td>
                        <td className="py-2 px-1 text-right"><BreachRateColor value={r.total > 0 ? (r.breached / r.total * 100) : 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: SLA Analysis ── */}
      {activeTab === 'sla' && slaReport && (
        <div className="space-y-6">
          {/* Compliance banner */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Overall SLA Compliance</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {slaReport.overall.breached_count} of {slaReport.overall.total_complaints} complaints breached SLA
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-gray-900">{slaReport.overall.breach_rate_pct?.toFixed(1)}%</span>
                <span className="text-sm text-gray-400 ml-1">breach rate</span>
              </div>
            </div>
            {/* Visual compliance bar */}
            <div className="w-full h-5 rounded-full overflow-hidden flex bg-gray-100">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${100 - (slaReport.overall.breach_rate_pct || 0)}%` }}
                title={`Within SLA: ${slaReport.overall.within_sla_count}`}
              />
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${slaReport.overall.breach_rate_pct || 0}%` }}
                title={`Breached: ${slaReport.overall.breached_count}`}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Within SLA: {slaReport.overall.within_sla_count}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Breached: {slaReport.overall.breached_count}</span>
            </div>
          </div>

          {/* Per-priority cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {slaReport.by_priority.map(p => (
              <div key={p.priority} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold capitalize text-gray-800">{p.priority}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: PRIORITY_COLORS[p.priority] + '22', color: PRIORITY_COLORS[p.priority] }}
                  >
                    {p.sla_hours}h SLA
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total</span>
                    <span className="font-medium">{p.total_complaints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Breached</span>
                    <span className="font-medium text-red-600">{p.breached_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Breach Rate</span>
                    <BreachRateColor value={p.breach_rate_pct} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Resolution</span>
                    <span className="font-medium">{p.avg_resolution_hours != null ? `${p.avg_resolution_hours}h` : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stacked bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">SLA Breach vs Within SLA by Priority</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={slaReport.by_priority} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="priority" tick={{ fontSize: 12, textTransform: 'capitalize' }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="within_sla_count" name="Within SLA" stackId="sla" fill="#22c55e" />
                <Bar dataKey="breached_count" name="Breached" stackId="sla" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── TAB: Category Breakdown ── */}
      {activeTab === 'category' && categoryStats.length > 0 && (
        <div className="space-y-6">
          {/* Top 3 category cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {categoryStats.slice(0, 3).map((c, i) => (
              <div key={c.category} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-blue-600">#{i + 1}</span>
                  <span className="text-sm font-semibold text-gray-800 leading-tight">{c.category}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{c.total_complaints}</p>
                <p className="text-xs text-gray-400 mt-1">complaints · <BreachRateColor value={c.total_complaints > 0 ? (c.breached_count / c.total_complaints * 100) : 0} /> breach rate</p>
              </div>
            ))}
          </div>

          {/* Horizontal bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Complaints by Category</h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={categoryStats} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <YAxis type="category" dataKey="category" width={175} tick={{ fontSize: 11 }} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total_complaints" name="Total Complaints" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category detail table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <h2 className="text-base font-semibold text-gray-900 p-5 border-b border-gray-100">Category Details</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Category', 'Total', 'Resolved', 'Escalated', 'Breached', 'Avg Res. Time', 'Avg Rating'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categoryStats.map((c, i) => (
                  <tr key={c.category} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="py-3 px-4 font-medium text-gray-900">{c.category}</td>
                    <td className="py-3 px-4">{c.total_complaints}</td>
                    <td className="py-3 px-4 text-green-600">{c.resolved_count}</td>
                    <td className="py-3 px-4 text-orange-600">{c.escalated_count}</td>
                    <td className="py-3 px-4 text-red-600">{c.breached_count}</td>
                    <td className="py-3 px-4">{c.avg_resolution_hours != null ? `${c.avg_resolution_hours}h` : '—'}</td>
                    <td className="py-3 px-4">
                      {c.avg_feedback_rating != null
                        ? <span>{c.avg_feedback_rating} <span className="text-yellow-500">★</span></span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Agent Performance ── */}
      {activeTab === 'agents' && agentPerformance.length > 0 && (
        <div className="space-y-6">
          {/* Top 3 agent cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...agentPerformance].sort((a, b) => b.resolved_count - a.resolved_count).slice(0, 3).map((a, i) => (
              <div key={a.agent_name} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {a.agent_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{a.agent_name}</p>
                    <p className="text-xs text-gray-400">Top resolver #{i + 1}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{a.resolved_count}</p>
                <p className="text-xs text-gray-400 mt-1">resolved · <RateColor value={a.resolution_rate_pct} /> resolution rate</p>
              </div>
            ))}
          </div>

          {/* Grouped bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Agent Activity Comparison</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={agentPerformance.map(a => ({ ...a, firstName: a.agent_name.split(' ')[0] }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="firstName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_assigned" name="Assigned" fill="#3b82f6" />
                <Bar dataKey="resolved_count" name="Resolved" fill="#22c55e" />
                <Bar dataKey="escalated_count" name="Escalated" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Agent table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <h2 className="text-base font-semibold text-gray-900 p-5 border-b border-gray-100">Agent Performance Details</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Agent', 'Assigned', 'Resolved', 'Escalated', 'Breached', 'Avg Res. Time', 'Resolution Rate', 'Avg Rating'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agentPerformance.map((a, i) => (
                  <tr key={a.agent_name} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {a.agent_name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{a.agent_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{a.total_assigned}</td>
                    <td className="py-3 px-4 text-green-600 font-medium">{a.resolved_count}</td>
                    <td className="py-3 px-4 text-orange-600">{a.escalated_count}</td>
                    <td className="py-3 px-4 text-red-600">{a.breached_count}</td>
                    <td className="py-3 px-4">{a.avg_resolution_hours != null ? `${a.avg_resolution_hours}h` : '—'}</td>
                    <td className="py-3 px-4"><RateColor value={a.resolution_rate_pct} /></td>
                    <td className="py-3 px-4">
                      {a.avg_feedback_rating != null
                        ? <span>{a.avg_feedback_rating} <span className="text-yellow-500">★</span></span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state for tabs when data exists but tab data is empty */}
      {activeTab === 'sla' && !slaReport && (
        <div className="text-center py-12 text-gray-400">No SLA report data available.</div>
      )}
      {activeTab === 'category' && categoryStats.length === 0 && (
        <div className="text-center py-12 text-gray-400">No category data available.</div>
      )}
      {activeTab === 'agents' && agentPerformance.length === 0 && (
        <div className="text-center py-12 text-gray-400">No agent performance data available.</div>
      )}
    </div>
  )
}
