import React from 'react'

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function Badge({ className = '', variant = 'default', ...props }) {
  const variants = {
    default: 'bg-slate-900 text-white',
    secondary: 'bg-slate-100 text-slate-900',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  )
}
