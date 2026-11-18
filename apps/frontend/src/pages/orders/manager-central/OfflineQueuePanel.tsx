import Button from '@/components/ui/Button'
import { CloudArrowUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { ManagerTable, OfflineQueueEntry } from './managerTypes'

interface OfflineQueuePanelProps {
  queue: OfflineQueueEntry[]
  tables: ManagerTable[]
  isOnline: boolean
  syncing: boolean
  onSync: () => void
  onClear: () => void
  formatDateTime: (value?: string | null) => string
}

// Only shown when there is something to act on: orders waiting to sync, or no network.
export default function OfflineQueuePanel({
  queue,
  tables,
  isOnline,
  syncing,
  onSync,
  onClear,
  formatDateTime,
}: OfflineQueuePanelProps) {
  if (isOnline && queue.length === 0) return null

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-500/10 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-200">
          {isOnline ? (
            <>
              Có <span className="font-semibold">{queue.length} đơn</span> tạo lúc mất mạng đang chờ gửi lên hệ thống.
            </>
          ) : (
            <>
              Mất kết nối mạng. Đơn mới sẽ được lưu tạm trên máy
              {queue.length > 0 && <> (<span className="font-semibold">{queue.length} đơn</span> đang chờ)</>}.
            </>
          )}
        </p>
        {queue.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5 px-3 text-sm" onClick={onSync} loading={syncing} disabled={!isOnline}>
              <CloudArrowUpIcon className="h-4 w-4" aria-hidden="true" />
              Đồng bộ ngay
            </Button>
            <Button size="sm" variant="secondary" className="px-3 text-sm" onClick={onClear}>
              Xóa hàng đợi
            </Button>
          </div>
        )}
      </div>
      {queue.length > 0 && (
        <div className="mt-3 grid max-h-36 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((item) => {
            const table = tables.find((entry) => entry.id === item.tableId)
            const quantity = item.items.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
            return (
              <div key={item.localId} className="rounded-xl bg-white/90 px-3 py-2 text-xs ring-1 ring-amber-100 dark:bg-slate-800 dark:ring-slate-700">
                <p className="font-semibold text-slate-800 dark:text-white">#{item.localId.slice(-6)} · Bàn {table?.number ?? item.tableId}</p>
                <p className="text-slate-500 dark:text-slate-400">{quantity} món · {formatDateTime(item.createdAt)}</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
