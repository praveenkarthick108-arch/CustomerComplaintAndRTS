import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldCheckIcon } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (demoEmail, demoPwd) => {
    setEmail(demoEmail)
    setPassword(demoPwd)
    setError('')
  }

  const demoUsers = [
    { label: 'Admin', email: 'admin@system.com', password: 'Admin@123' },
    { label: 'Supervisor', email: 'supervisor@system.com', password: 'Admin@123' },
    { label: 'Agent', email: 'agent1@system.com', password: 'Admin@123' },
    { label: 'Customer', email: 'customer@system.com', password: 'Admin@123' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheckIcon className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Complaint Tracker</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">
              Create one
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Demo Credentials</p>
            <div className="space-y-2">
              {demoUsers.map(u => (
                <button
                  key={u.label}
                  type="button"
                  onClick={() => fillDemo(u.email, u.password)}
                  className="w-full text-left flex items-center justify-between p-2 hover:bg-gray-100 rounded transition-colors group"
                >
                  <span className="text-xs font-medium text-gray-600">{u.label}:</span>
                  <span className="text-xs text-gray-500 font-mono">{u.email}</span>
                  <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Use</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Password for all: <code className="font-mono bg-gray-200 px-1 rounded">Admin@123</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
