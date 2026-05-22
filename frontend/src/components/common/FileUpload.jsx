import React, { useState, useRef } from 'react'
import { CloudArrowUpIcon, XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileUpload({
  onFilesSelected,
  accept = '.jpg,.jpeg,.png,.gif,.webp,.pdf',
  maxSize = 5 * 1024 * 1024,
  multiple = true
}) {
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState([])
  const inputRef = useRef(null)

  const validateAndAdd = (newFiles) => {
    const errs = []
    const valid = []
    Array.from(newFiles).forEach(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      const acceptedExts = accept.split(',').map(a => a.trim().toLowerCase())
      if (!acceptedExts.includes(ext)) {
        errs.push(`${file.name}: Invalid file type`)
        return
      }
      if (file.size > maxSize) {
        errs.push(`${file.name}: File too large (max ${formatFileSize(maxSize)})`)
        return
      }
      valid.push(file)
    })
    setErrors(errs)
    if (valid.length) {
      const updated = multiple ? [...files, ...valid] : valid
      setFiles(updated)
      onFilesSelected(updated)
    }
  }

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onFilesSelected(updated)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    validateAndAdd(e.dataTransfer.files)
  }

  const handleChange = (e) => {
    validateAndAdd(e.target.files)
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <CloudArrowUpIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 font-medium">
          Drag & drop files here, or <span className="text-blue-600">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Accepted: {accept} &mdash; Max {formatFileSize(maxSize)} each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600">{err}</p>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg">
              <DocumentIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
