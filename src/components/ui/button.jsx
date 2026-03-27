import React from 'react'
const cn = (...c) => c.filter(Boolean).join(' ')
const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50'
const variants = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-900',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
}
export const Button = React.forwardRef(function Button({ className = '', variant = 'default', asChild = false, children, ...props }, ref) {
  const cls = cn(base, variants[variant] || variants.default, className)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { ...props, className: cn(cls, children.props.className), ref })
  }
  return <button ref={ref} className={cls} {...props}>{children}</button>
})