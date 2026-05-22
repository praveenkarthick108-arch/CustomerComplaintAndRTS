import React, { useState, useEffect, useCallback } from 'react'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon } from '@heroicons/react/24/outline'
import api from '../../api/axios'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import { format, isValid } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function safeFormat(d) {
  if (!d) return 'N/A'
  const dt = new Date(d)
  return isValid(dt) ? format(dt, 'MMM dd, yyyy') : 'N/A'
}

const ROLE_STYLES = {
  admin: 'bg-red-100 text-red-800',
  supervisor: 'bg-purple-100 text-purple-800',
  agent: 'bg-blue-100 text-blue-800',
  customer: 'bg-green-100 text-green-800',
  quality: 'bg-teal-100 text-teal-800',
}

const ROLES = ['admin', 'supervisor', 'agent', 'customer', 'quality']

const EMPTY_FORM = { name: '', email: '', password: '', role: 'customer', phone: '', department: '' }

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const limit = 15

  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [toggleConfirm, setToggleConfirm] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search) params.append('search', search)
      if (roleFilter) params.append('role', roleFilter)
      const res = await api.get(`/users?${params}`)
      setUsers(res.data.data || [])
      setPagination({
        total: res.data.pagination?.total || 0,
        pages: res.data.pagination?.pages || 1
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const validateForm = (f, requirePassword = true) => {
    const errs = {}
    if (!f.name?.trim()) errs.name = 'Name is required'
    if (!f.email?.trim()) errs.email = 'Email is required'
    if (requirePassword && !f.password) errs.password = 'Password is required'
    if (requirePassword && f.password && f.password.length < 6) errs.password = 'Min 6 characters'
    if (!f.role) errs.role = 'Role is required'
    return errs
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const errs = validateForm(form)
    if (Object.keys(errs).length) { setFormErrors(errs); return }
    setActionLoading(true)
    try {
      await api.post('/users', form)
      toast.success('User created successfully')
      setCreateModal(false)
      setForm(EMPTY_FORM)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    const errs = validateForm(editForm, false)
    if (Object.keys(errs).length) { setFormErrors(errs); return }
    setActionLoading(true)
    try {
      await api.put(`/users/${editModal.id}`, editForm)
      toast.success('User updated successfully')
      setEditModal(null)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await api.patch(`/users/${userId}/toggle-status`)
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const openEdit = (user) => {
    setEditModal(user)
    setEditForm({ name: user.name, email: user.email, role: user.role, phone: user.phone || '', department: user.department || '' })
    setFormErrors({})
  }

  const FormFields = ({ data, onChange, errors, isCreate = false }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input name="name" value={data.name} onChange={onChange} className="input" placeholder="Full name" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input name="email" type="email" value={data.email} onChange={onChange} className="input" placeholder="email@example.com" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>
      </div>
      {isCreate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
          <input name="password" type="password" value={data.password || ''} onChange={onChange} className="input" placeholder="Min 6 characters" />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <select name="role" value={data.role} onChange={onChange} className="input">
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input name="phone" value={data.phone || ''} onChange={onChange} className="input" placeholder="+1 555 000 0000" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
        <input name="department" value={data.department || ''} onChange={onChange} className="input" placeholder="e.g. Customer Support" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total} total users</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setFormErrors({}); setCreateModal(true) }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Create User
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or email..."
            className="input pl-9"
          />
        </div>
        <div className="min-w-[150px]">
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} className="input">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No users found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Role</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Phone</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Joined</th>
                    <th className="py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 table-row">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">
                            {u.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', ROLE_STYLES[u.role] || 'bg-gray-100 text-gray-700')}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{u.phone || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={clsx(
                          'px-2.5 py-0.5 rounded-full text-xs font-medium',
                          u.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        )}>
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{safeFormat(u.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setToggleConfirm(u)}
                            className={clsx(
                              'text-xs px-2 py-1 rounded font-medium transition-colors',
                              u.is_active !== false
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            )}
                          >
                            {u.is_active !== false ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={limit} onChange={setPage} />
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create User" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormFields data={form} onChange={e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setFormErrors(p => ({ ...p, [e.target.name]: '' })) }} errors={formErrors} isCreate />
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={actionLoading} className="btn-primary">{actionLoading ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title="Edit User" size="md">
        <form onSubmit={handleEdit} className="space-y-4">
          <FormFields data={editForm} onChange={e => { setEditForm(p => ({ ...p, [e.target.name]: e.target.value })); setFormErrors(p => ({ ...p, [e.target.name]: '' })) }} errors={formErrors} />
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setEditModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={actionLoading} className="btn-primary">{actionLoading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Toggle Active Confirm */}
      <ConfirmDialog
        isOpen={!!toggleConfirm}
        onClose={() => setToggleConfirm(null)}
        onConfirm={() => handleToggleActive(toggleConfirm.id, toggleConfirm.is_active !== false)}
        title={toggleConfirm?.is_active !== false ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${toggleConfirm?.is_active !== false ? 'deactivate' : 'activate'} ${toggleConfirm?.name}?`}
        confirmText={toggleConfirm?.is_active !== false ? 'Deactivate' : 'Activate'}
        variant={toggleConfirm?.is_active !== false ? 'danger' : 'primary'}
      />
    </div>
  )
}
