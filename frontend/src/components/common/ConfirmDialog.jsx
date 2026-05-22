import React from 'react'
import Modal from './Modal'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  variant = 'danger'
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-4">
        {variant === 'danger' && (
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm text-gray-600">{message}</p>
          <div className="flex gap-3 mt-6 justify-end">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => { onConfirm(); onClose() }}
              className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
