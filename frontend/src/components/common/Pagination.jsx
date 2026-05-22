import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function Pagination({ page, pages, total, limit, onChange }) {
  if (!pages || pages <= 1) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  const getPageNumbers = () => {
    const nums = []
    const delta = 2
    const left = page - delta
    const right = page + delta

    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= left && i <= right)) {
        nums.push(i)
      }
    }

    const withEllipsis = []
    let prev = null
    for (const n of nums) {
      if (prev && n - prev > 1) withEllipsis.push('...')
      withEllipsis.push(n)
      prev = n
    }
    return withEllipsis
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        {getPageNumbers().map((n, i) =>
          n === '...' ? (
            <span key={`ellipsis-${i}`} className="px-3 py-1 text-gray-400 text-sm">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={clsx(
                'w-8 h-8 text-sm rounded transition-colors',
                n === page
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {n}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
