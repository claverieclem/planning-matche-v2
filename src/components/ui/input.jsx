import React from 'react'
const cn = (...c) => c.filter(Boolean).join(' ')
export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={cn('flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />
})