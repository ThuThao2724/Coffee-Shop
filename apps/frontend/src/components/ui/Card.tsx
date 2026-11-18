import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  action?: ReactNode
}

export default function Card({ children, className, title, subtitle, action }: CardProps) {
  return (
    <div
      className={cn(
        'glass-panel density-pad rounded-2xl transition-shadow duration-200 hover:shadow-[0_1px_2px_rgba(42,29,16,0.05),0_18px_40px_-26px_rgba(42,29,16,0.35)]',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
          <div>
            {title && <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
