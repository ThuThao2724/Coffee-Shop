import { ReactNode } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'

interface ManagerLayoutProps {
  branchLabel: string
  roleLabel: string
  isLive: boolean
  onRefresh: () => void
  offlineQueuePanel: ReactNode
  filterPanel: ReactNode
  boardPanel: ReactNode
  paymentHistoryPanel: ReactNode
  createOrderPanel: ReactNode
}

// Same page frame as the other staff pages (Kitchen, Tables...): plain title, branch line, small actions.
export default function ManagerLayout({
  branchLabel,
  roleLabel,
  isLive,
  onRefresh,
  offlineQueuePanel,
  filterPanel,
  boardPanel,
  paymentHistoryPanel,
  createOrderPanel,
}: ManagerLayoutProps) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Đơn hàng / POS</h1>
          <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">📍 {branchLabel} · {roleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium ${
              isLive
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
                : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
            {isLive ? 'Realtime ON' : 'Mất kết nối'}
          </span>
          <Button size="sm" variant="secondary" className="gap-1.5 px-3 text-sm" onClick={onRefresh}>
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            Làm mới
          </Button>
        </div>
      </div>

      {offlineQueuePanel}
      {filterPanel}
      {boardPanel}

      <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {paymentHistoryPanel}
        {createOrderPanel}
      </section>
    </div>
  )
}
