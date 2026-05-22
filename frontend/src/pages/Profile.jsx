import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format, isValid } from 'date-fns'
import clsx from 'clsx'

const ROLE_STYLES = {
  admin: 'bg-red-100 text-red-800',
  supervisor: 'bg-purple-100 text-purple-800',
  agent: 'bg-blue-100 text-blue-800',
  customer: 'bg-green-100 text-green-800',
  quality: 'bg-teal-100 text-teal-800',
}

function getInitials(name) {
  if (!name) return 'U'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name) {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500']
  let sum = 0
  for (const c of (name || '')) sum += c.charCodeAt(0)
  return colors[sum % colors.length]
}

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    department: user?.department || '',
  })
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdErrors, setPwdErrors] = useState({})

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const res = await api.put('/auth/profile', profileForm)
      updateUser(res.data.data || res.data)
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const validatePwd = () => {
    const errs = {}
    if (!pwdForm.currentPassword) errs.currentPassword = 'Current password is required'
    if (!pwdForm.newPassword) errs.newPassword = 'New password is required'
    else if (pwdForm.newPassword.length < 6) errs.newPassword = 'Min 6 characters'
    if (pwdForm.newPassword !== pwdForm.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  const handlePwdChange = async (e) => {
    e.preventDefault()
    const errs = validatePwd()
    if (Object.keys(errs).length) { setPwdErrors(errs); return }
    setPwdLoading(true)
    try {
      await api.put('/auth/change-password', {
        old_password: pwdForm.currentPassword,
        new_password: pwdForm.newPassword,
      })
      toast.success('Password changed successfully')
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwdErrors({})
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setPwdLoading(false)
    }
  }

  const memberSince = user?.created_at
    ? (isValid(new Date(user.created_at)) ? format(new Date(user.created_at), 'MMMM yyyy') : 'N/A')
    : 'N/A'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Avatar + user summary */}
      <div className="card flex items-center gap-6">
        <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0', getAvatarColor(user?.name))}>
          {getInitials(user?.name)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
          <p className="text-gray-500 text-sm">{user?.email}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', ROLE_STYLES[user?.role] || 'bg-gray-100 text-gray-700')}>
              {user?.role}
            </span>
            {memberSince !== 'N/A' && (
              <span className="text-gray-400 text-xs">Member since {memberSince}</span>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Profile Information</h3>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              value={profileForm.name}
              onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
              className="input"
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              value={user?.email || ''}
              className="input bg-gray-50 text-gray-500 cursor-not-allowed"
              disabled
              readOnly
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={profileForm.phone}
                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                className="input"
                placeholder="+1 (555) 000-0000"
                type="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                value={profileForm.department}
                onChange={e => setProfileForm(p => ({ ...p, department: e.target.value }))}
                className="input"
                placeholder="e.g. Support"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={profileLoading} className="btn-primary">
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Change Password</h3>
        <form onSubmit={handlePwdChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={pwdForm.currentPassword}
              onChange={e => { setPwdForm(p => ({ ...p, currentPassword: e.target.value })); setPwdErrors(p => ({ ...p, currentPassword: '' })) }}
              className="input"
              placeholder="••••••••"
            />
            {pwdErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.currentPassword}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={pwdForm.newPassword}
              onChange={e => { setPwdForm(p => ({ ...p, newPassword: e.target.value })); setPwdErrors(p => ({ ...p, newPassword: '' })) }}
              className="input"
              placeholder="••••••••"
            />
            {pwdErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.newPassword}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwdForm.confirmPassword}
              onChange={e => { setPwdForm(p => ({ ...p, confirmPassword: e.target.value })); setPwdErrors(p => ({ ...p, confirmPassword: '' })) }}
              className="input"
              placeholder="••••••••"
            />
            {pwdErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.confirmPassword}</p>}
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={pwdLoading} className="btn-primary">
              {pwdLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
