import * as React from 'react'
import { cn } from '../../lib/cn'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border border-neutral-200 bg-white/80 shadow-sm backdrop-blur-sm', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 border-b border-neutral-100 px-6 py-4', className)} {...props} />
)

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold text-midnight', className)} {...props} />
)

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-midnight/70', className)} {...props} />
)

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-6 py-4', className)} {...props} />
)

export { Card, CardHeader, CardTitle, CardDescription, CardContent }

