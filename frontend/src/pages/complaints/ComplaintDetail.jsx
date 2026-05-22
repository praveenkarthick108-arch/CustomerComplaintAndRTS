import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, isValid } from 'date-fns'
import {
  ArrowLeftIcon, UserIcon, ClockIcon, PaperClipIcon,
  StarIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ArrowPathIcon, ChatBubbleLeftIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import StatusBadge from '../../components/common/StatusBadge'
import PriorityBadge from '../../components/common/PriorityBadge'
import SLATimer from '../../components/common/SLATimer'
import Modal from '../../components/common/Modal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import FileUpload from '../../components/common/FileUpload'
import toast from 'react-hot-toast'

function hasRole(user, ...roles) { return roles.includes(user?.role) }
function safeFormat(d, fmt = 'MMM dd, yyyy h:mm a') {
  if (!d) return 'N/A'
  const date = new Date(d)
  return isValid(date) ? format(date, fmt) : 'N/A'
}

const ALL_STATUSES = ['open', 'assigned', 'in_progress', 'pending_customer', 'escalated', 'resolved', 'closed']

export default function ComplaintDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [assignModal, setAssignModal] = useState(false)
  const [statusModal, setStatusModal] = useState(false)
  const [escalateModal, setEscalateModal] = useState(false)
  const [resolveModal, setResolveModal] = useState(false)
  const [feedbackModal, setFeedbackModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)

  // Form fields
  const [selectedAgent, setSelectedAgent] = useState('')
  const [statusChange, setStatusChange] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [escalateReason, setEscalateReason] = useState('')
  const [resolveNotes, setResolveNotes] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [uploadFiles, setUploadFiles] = useState([])
  const [actionLoading, setActionLoading] = useState(false)

  const fetchComplaint = useCallback(async () => {
    try {
      const res = await api.get(`/complaints/${id}`)
      setComplaint(res.data.data || res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load complaint')
      navigate('/complaints')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchComplaint() }, [fetchComplaint])

  useEffect(() => {
    if (hasRole(user, 'admin', 'supervisor')) {
      api.get('/users?role=agent').then(res => {
        setAgents(res.data.data || [])
      }).catch(() => {})
    }
  }, [user])

  const doAction = async (fn, successMsg) => {
    setActionLoading(true)
    try {
      await fn()
      toast.success(successMsg)
      await fetchComplaint()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssign = () => doAction(
    () => api.patch(`/complaints/${id}/assign`, { agent_id: selectedAgent }),
    'Agent assigned successfully'
  ).then(() => setAssignModal(false))

  const handleStatusChange = () => doAction(
    () => api.patch(`/complaints/${id}/status`, { status: statusChange, comment: statusComment }),
    'Status updated successfully'
  ).then(() => { setStatusModal(false); setStatusComment('') })

  const handleEscalate = () => doAction(
    () => api.patch(`/complaints/${id}/escalate`, { reason: escalateReason }),
    'Complaint escalated'
  ).then(() => { setEscalateModal(false); setEscalateReason('') })

  const handleResolve = () => doAction(
    () => api.post(`/complaints/${id}/resolve`, { resolution_notes: resolveNotes }),
    'Complaint marked as resolved'
  ).then(() => { setResolveModal(false); setResolveNotes('') })

  const handleFeedback = () => doAction(
    () => api.post(`/feedback/complaint/${id}`, { rating: feedbackRating, comments: feedbackComment }),
    'Feedback submitted!'
  ).then(() => { setFeedbackModal(false) })

  const handleUpload = async () => {
    if (!uploadFiles.length) return
    setActionLoading(true)
    try {
      for (const f of uploadFiles) {
        const formData = new FormData()
        formData.append('file', f)
        await api.post(`/attachments/complaint/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }
      toast.success('Files uploaded successfully')
      await fetchComplaint()
      setUploadModal(false)
      setUploadFiles([])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleQuickStatus = (newStatus) => doAction(
    () => api.patch(`/complaints/${id}/status`, { status: newStatus }),
    `Status changed to ${newStatus.replace('_', ' ')}`
  )

  const handleClose = () => doAction(
    () => api.patch(`/complaints/${id}/status`, { status: 'closed' }),
    'Complaint closed'
  )

  if (loading) return <LoadingSpinner message="Loading complaint..." />
  if (!complaint) return null

  const isOwner = complaint.customer?.id === user?.id
  const isAssignedAgent = complaint.agent?.id === user?.id
  const canModify = hasRole(user, 'admin', 'supervisor') || (hasRole(user, 'agent') && isAssignedAgent)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/complaints')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="font-mono text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {complaint.complaint_number}
            </span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            <SLATimer
              slaDeadline={complaint.sla_deadline}
              status={complaint.status}
              priority={complaint.priority}
              createdAt={complaint.created_at}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{complaint.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Created {safeFormat(complaint.created_at)} by {complaint.customer?.name || 'Unknown'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {hasRole(user, 'admin', 'supervisor') && (
          <>
            <button onClick={() => setAssignModal(true)} className="btn-primary text-sm">
              Assign Agent
            </button>
            <button onClick={() => { setStatusChange(complaint.status); setStatusModal(true) }} className="btn-secondary text-sm">
              Change Status
            </button>
            <button onClick={() => setEscalateModal(true)} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-100 transition-colors font-medium">
              Escalate
            </button>
            {complaint.status === 'resolved' && (
              <button onClick={handleClose} disabled={actionLoading} className="btn-secondary text-sm">
                Close Complaint
              </button>
            )}
          </>
        )}

        {hasRole(user, 'agent') && isAssignedAgent && (
          <>
            {(complaint.status === 'open' || complaint.status === 'assigned') && (
              <button onClick={() => handleQuickStatus('in_progress')} disabled={actionLoading} className="btn-primary text-sm">
                Start Working
              </button>
            )}
            {complaint.status === 'in_progress' && (
              <>
                <button onClick={() => handleQuickStatus('pending_customer')} disabled={actionLoading} className="btn-secondary text-sm">
                  Pending Customer
                </button>
                <button onClick={() => setResolveModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors font-medium">
                  Mark Resolved
                </button>
              </>
            )}
            {complaint.status !== 'escalated' && complaint.status !== 'resolved' && complaint.status !== 'closed' && (
              <button onClick={() => setEscalateModal(true)} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-100 transition-colors font-medium">
                Escalate
              </button>
            )}
          </>
        )}

        {isOwner && hasRole(user, 'customer') && (
          <>
            {(complaint.status === 'resolved' || complaint.status === 'closed') && !complaint.feedback && (
              <button onClick={() => setFeedbackModal(true)} className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-lg text-sm hover:bg-yellow-100 transition-colors font-medium flex items-center gap-1.5">
                <StarIcon className="w-4 h-4" />
                Submit Feedback
              </button>
            )}
            <button onClick={() => setUploadModal(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <PaperClipIcon className="w-4 h-4" />
              Upload Documents
            </button>
          </>
        )}

        {canModify && (
          <button onClick={() => setUploadModal(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <PaperClipIcon className="w-4 h-4" />
            Upload Files
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
          </div>

          {/* Customer Info */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-medium text-gray-800 mt-0.5">{complaint.customer?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-800 mt-0.5">{complaint.customer?.email || complaint.contact_email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium text-gray-800 mt-0.5">{complaint.customer?.phone || complaint.contact_phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Category</p>
                <p className="font-medium text-gray-800 mt-0.5">{complaint.category?.name || complaint.category || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Resolution Notes */}
          {complaint.resolution_notes && (
            <div className="card border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-semibold text-green-800">Resolution Notes</h3>
              </div>
              <p className="text-green-700 text-sm leading-relaxed">{complaint.resolution_notes}</p>
              {complaint.resolved_at && (
                <p className="text-green-600 text-xs mt-2">Resolved on {safeFormat(complaint.resolved_at)}</p>
              )}
            </div>
          )}

          {/* Feedback */}
          {complaint.feedback && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Customer Feedback</h3>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <StarSolidIcon
                    key={n}
                    className={`w-5 h-5 ${n <= (complaint.feedback.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}`}
                  />
                ))}
                <span className="text-sm text-gray-600 ml-1">{complaint.feedback.rating}/5</span>
              </div>
              {complaint.feedback.comment && (
                <p className="text-gray-600 text-sm italic">"{complaint.feedback.comment}"</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Assignment Info */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Assignment</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <UserIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500">Assigned Agent</p>
                  <p className="font-medium text-gray-800">
                    {complaint.agent?.name || 'Unassigned'}
                  </p>
                </div>
              </div>
              {complaint.assigned_at && (
                <div className="flex items-start gap-2">
                  <ClockIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500">Assigned On</p>
                    <p className="font-medium text-gray-800">{safeFormat(complaint.assigned_at)}</p>
                  </div>
                </div>
              )}
              {complaint.escalated_at && (
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500">Escalated At</p>
                    <p className="font-medium text-gray-800">{safeFormat(complaint.escalated_at)}</p>
                    {complaint.escalation_reason && (
                      <p className="text-gray-500 text-xs mt-0.5">Reason: {complaint.escalation_reason}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PaperClipIcon className="w-4 h-4" />
              Attachments ({complaint.attachments?.length || 0})
            </h3>
            {complaint.attachments?.length === 0 || !complaint.attachments ? (
              <p className="text-gray-400 text-sm">No attachments</p>
            ) : (
              <ul className="space-y-2">
                {complaint.attachments.map((att, i) => (
                  <li key={att.id || i}>
                    <a
                      href={att.url || att.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate block"
                    >
                      {att.original_name || att.filename || `File ${i + 1}`}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ChatBubbleLeftIcon className="w-4 h-4" />
              Timeline
            </h3>
            {!complaint.history || complaint.history?.length === 0 ? (
              <p className="text-gray-400 text-sm">No history yet</p>
            ) : (
              <div className="space-y-3">
                {[...(complaint.history || [])].reverse().map((h, i) => (
                  <div key={h.id || i} className="flex gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-2" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{h.action || (h.old_status && h.new_status ? `${h.old_status} → ${h.new_status}` : '')}</p>
                      {h.comment && <p className="text-xs text-gray-500 mt-0.5 italic">"{h.comment}"</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.updater_name || h.updated_by || 'System'} &mdash; {safeFormat(h.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Agent Modal */}
      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title="Assign Agent" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Agent</label>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="input"
            >
              <option value="">Choose an agent...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setAssignModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleAssign}
              disabled={!selectedAgent || actionLoading}
              className="btn-primary"
            >
              {actionLoading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Status Modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Change Status" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
            <select value={statusChange} onChange={e => setStatusChange(e.target.value)} className="input">
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
            <textarea
              value={statusComment}
              onChange={e => setStatusComment(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Add a comment..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setStatusModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleStatusChange} disabled={actionLoading} className="btn-primary">
              {actionLoading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Escalate Modal */}
      <Modal isOpen={escalateModal} onClose={() => setEscalateModal(false)} title="Escalate Complaint" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">This will escalate the complaint for immediate attention.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Escalation</label>
            <textarea
              value={escalateReason}
              onChange={e => setEscalateReason(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Explain why this needs escalation..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setEscalateModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleEscalate} disabled={actionLoading || !escalateReason.trim()} className="btn-danger">
              {actionLoading ? 'Escalating...' : 'Escalate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal isOpen={resolveModal} onClose={() => setResolveModal(false)} title="Mark as Resolved" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
            <textarea
              value={resolveNotes}
              onChange={e => setResolveNotes(e.target.value)}
              className="input resize-none"
              rows={4}
              placeholder="Describe the resolution steps taken..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setResolveModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleResolve}
              disabled={actionLoading || !resolveNotes.trim()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Mark Resolved'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Feedback Modal */}
      <Modal isOpen={feedbackModal} onClose={() => setFeedbackModal(false)} title="Submit Feedback" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFeedbackRating(n)}
                  className="focus:outline-none"
                >
                  <StarSolidIcon className={`w-8 h-8 ${n <= feedbackRating ? 'text-yellow-400' : 'text-gray-200'} hover:text-yellow-300 transition-colors`} />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{feedbackRating} out of 5 stars</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments (optional)</label>
            <textarea
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Share your experience..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setFeedbackModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleFeedback} disabled={actionLoading} className="btn-primary">
              {actionLoading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={uploadModal} onClose={() => setUploadModal(false)} title="Upload Files" size="sm">
        <div className="space-y-4">
          <FileUpload onFilesSelected={setUploadFiles} />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setUploadModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleUpload}
              disabled={actionLoading || uploadFiles.length === 0}
              className="btn-primary"
            >
              {actionLoading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
