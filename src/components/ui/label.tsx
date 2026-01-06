import * as React from 'react'
import { cn } from '../../lib/cn'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('text-sm font-medium text-midnight/80', className)}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }

