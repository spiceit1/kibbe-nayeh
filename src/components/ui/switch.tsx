import * as React from 'react'
import { cn } from '../../lib/cn'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        ref={ref}
        className="peer sr-only"
        {...props}
      />
      <span
        className={cn(
          'h-6 w-10 rounded-full border border-neutral-300 bg-neutral-200 transition peer-checked:bg-pomegranate/80 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pomegranate',
          className,
        )}
      >
        <span className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-[18px]" />
      </span>
    </label>
  )
})
Switch.displayName = 'Switch'

