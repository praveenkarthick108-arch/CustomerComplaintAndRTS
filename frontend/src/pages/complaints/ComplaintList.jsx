import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon, PlusCircleIcon, DocumentTextIcon, FunnelIcon
} from '@heroicons/react/24/outline'
import api from '../../api/axios'
import StatusBadge from '../../components/common/StatusBadge'
import PriorityBadge from '../../components/common/PriorityBadge'
import SLATimer from '../../components/common/SLATimer'
import Pagination from '../../components/common/Pagination'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { format, isValid } from 'date-fns'
import toast from 'react-hot-toast'

function safeFormat(dateStr) {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, 'MMM dd, yyyy') : 'N/A'
}

const STATUSES = ['', 'open', 'assigned', 'in_progress', 'pending_customer', 'escalated', 'resolved', 'closed']
const PRIORITIES = ['', 'low', 'medium', 'high', 'critical']

export default function ComplaintList() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const limit = 15

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data.data || [])).catch(() => {})
  }, [])

  const fetchComplaints = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search) params.append('search', search)
      if (filterStatus) params.append('status', filterStatus)
      if (filterPriority) params.append('priority', filterPriority)
      if (filterCategory) params.append('category_id', filterCategory)
      const res = await api.get(`/complaints?${params}`)
      setComplaints(res.data.data || [])
      setPagination({
        total: res.data.pagination?.total || 0,
        pages: res.data.pagination?.pages || 1
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load complaints')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterPriority, filterCategory])

  useEffect(() => {
    fetchComplaints()
  }, [fetchComplaints])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchComplaints()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Complaints</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total} total complaints</p>
        </div>
        <button
          onClick={() => navigate('/complaints/new')}
          className="btn-primary flex items-center gap-2 self-start"
        >
          <PlusCircleIcon className="w-5 h-5" />
          New Complaint
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by title, number, customer..."
                className="input pl-9"
              />
            </div>
          </form>

          {/* Status filter */}
          <div className="min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
              className="input"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s ? s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'All Statuses'}</option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div className="min-w-[130px]">
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            <select
              value={filterPriority}
              onChange={e => { setFilterPriority(e.target.value); setPage(1) }}
              className="input"
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All Priorities'}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="min-w-[150px]">
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
                className="input"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {(filterStatus || filterPriority || filterCategory || search) && (
            <button
              onClick={() => {
                setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterCategory(''); setPage(1)
              }}
              className="btn-secondary flex items-center gap-1.5 self-end"
            >
              <FunnelIcon className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading complaints..." />
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DocumentTextIcon className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No complaints found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or create a new complaint.</p>
            <button onClick={() => navigate('/complaints/new')} className="btn-primary mt-4">
              Create Complaint
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Complaint #</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Title</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Category</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Priority</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">SLA</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Assigned To</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Created</th>
                    <th className="py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(c => (
                    <tr
                      key={c.id}
                      className="table-row border-b border-gray-100 cursor-pointer"
                      onClick={() => navigate(`/complaints/${c.id}`)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {c.complaint_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800 max-w-xs">
                        <p className="truncate">{c.title}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{c.category?.name || c.category || 'N/A'}</td>
                      <td className="py-3 px-4"><PriorityBadge priority={c.priority} /></td>
                      <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                      <td className="py-3 px-4">
                        <SLATimer
                          slaDeadline={c.sla_deadline}
                          status={c.status}
                          priority={c.priority}
                          createdAt={c.created_at}
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {c.agent?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{safeFormat(c.created_at)}</td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/complaints/${c.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pages={pagination.pages}
              total={pagination.total}
              limit={limit}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
