import * as React from 'react'
import { cn } from '../../lib/cn'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-midnight shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pomegranate focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
})

Select.displayName = 'Select'

export { Select }

