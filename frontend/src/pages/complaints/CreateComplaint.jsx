import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import FileUpload from '../../components/common/FileUpload'
import toast from 'react-hot-toast'

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export default function CreateComplaint() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    title: '',
    category: '',
    priority: 'medium',
    description: '',
    contactEmail: user?.email || '',
    contactPhone: user?.phone || '',
  })
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/categories')
      .then(res => setCategories(res.data.data || []))
      .catch(() => {})
  }, [])

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.category) errs.category = 'Category is required'
    if (!form.priority) errs.priority = 'Priority is required'
    if (!form.description.trim()) errs.description = 'Description is required'
    else if (form.description.trim().length < 20) errs.description = 'Description must be at least 20 characters'
    return errs
  }

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErrors(prev => ({ ...prev, [e.target.name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const payload = {
        title: form.title,
        category_id: form.category,
        priority: form.priority,
        description: form.description,
        contact_email: form.contactEmail,
        contact_phone: form.contactPhone,
      }
      const res = await api.post('/complaints', payload)
      const complaint = res.data.data || res.data

      // Upload attachments one by one
      if (files.length > 0) {
        for (const f of files) {
          const formData = new FormData()
          formData.append('file', f)
          try {
            await api.post(`/attachments/complaint/${complaint.id}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          } catch {
            toast.error('Complaint created but file upload failed')
          }
        }
      }

      toast.success('Complaint submitted successfully!')
      navigate(`/complaints/${complaint.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create complaint')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Submit New Complaint</h2>
        <p className="text-gray-500 text-sm mt-1">Fill in the details below to submit your complaint.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className="input"
            placeholder="Brief summary of your complaint"
            maxLength={200}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>

        {/* Category + Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="input"
            >
              <option value="">Select a category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="input"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {errors.priority && <p className="text-red-500 text-xs mt-1">{errors.priority}</p>}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            className="input resize-none"
            rows={5}
            placeholder="Describe your complaint in detail (minimum 20 characters)..."
          />
          <div className="flex justify-between mt-1">
            {errors.description ? (
              <p className="text-red-500 text-xs">{errors.description}</p>
            ) : <span />}
            <p className={`text-xs ${form.description.length < 20 ? 'text-gray-400' : 'text-green-500'}`}>
              {form.description.length} chars
            </p>
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input
              name="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={handleChange}
              className="input"
              placeholder="contact@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input
              name="contactPhone"
              type="tel"
              value={form.contactPhone}
              onChange={handleChange}
              className="input"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (optional)</label>
          <FileUpload onFilesSelected={setFiles} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1 md:flex-none">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 md:flex-none">
            {loading ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </div>
      </form>
    </div>
  )
}
