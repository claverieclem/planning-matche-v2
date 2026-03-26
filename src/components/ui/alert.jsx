import React from 'react'

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function Alert({ className = '', ...props }) {
  return (
    <div
      role="alert"
      className={cn('relative w-full rounded-lg border border-slate-200 bg-white p-4 text-slate-950', className)}
      {...props}
    />
  )
}

export function AlertDescription({ className = '', ...props }) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
}
