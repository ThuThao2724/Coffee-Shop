import { cn } from '@/utils/cn'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, placeholder, ...props }, ref) => {
    const autoPlaceholder = placeholder ?? (label ? `Nhập ${label.toLowerCase()}` : undefined)
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          placeholder={autoPlaceholder}
          className={cn(
            'block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:ring-amber-400/20 sm:text-sm',
            error && 'border-rose-300 focus:border-rose-500 focus:ring-rose-300/60',
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input
