import * as React from 'react'
import { cn } from '../../lib/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning'
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const styles =
      variant === 'success'
        ? 'bg-olive/15 text-olive border-olive/40'
        : variant === 'warning'
          ? 'bg-amber-100 text-amber-900 border-amber-200'
          : 'bg-pomegranate/10 text-pomegranate border-pomegranate/30'
    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', styles, className)}
        {...props}
      />
    )
  },
)
Badge.displayName = 'Badge'

