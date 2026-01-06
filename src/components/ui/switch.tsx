import * as React from 'react'
import { cn } from '../../lib/cn'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, checked, ...props }, ref) => {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        ref={ref}
        className="peer sr-only"
        checked={checked}
        {...props}
      />
      <span
        className={cn(
          'relative h-6 w-10 rounded-full border border-neutral-300 bg-neutral-200 transition-colors peer-checked:bg-green-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500',
          className,
        )}
      >
        <span 
          className={cn(
            'absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )} 
        />
      </span>
    </label>
  )
})
Switch.displayName = 'Switch'

