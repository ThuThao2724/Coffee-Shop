import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import { maDonHangNgan, phuongThucThanhToan, trangThaiDonHang } from '@/utils/display'
import { ManagerOrder, ManagerPayment } from './managerTypes'

type Tone = 'neutral' | 'warning' | 'danger'

// "84762 phút" is unreadable on stale orders: show days/hours once it gets long.
function formatWaitDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes || 0))
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days} ngày ${restHours} giờ` : `${days} ngày`
}

// Colours follow the board columns: pending = amber, in progress = sky, ready = indigo, done = emerald.
const STATUS_STYLE = {
  pending: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  working: { bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  ready: { bar: 'bg-indigo-400', chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500' },
  done: { bar: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
} as const

const WAIT_STYLE: Record<Tone, string> = {
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const secondaryButtonClass = 'min-h-10 text-sm'
const primaryButtonClass = 'min-h-10 text-sm'

interface OrderCardProps {
  order: ManagerOrder
  tone: Tone
  ageMinutes: number
  itemCount: number
  payment?: ManagerPayment
  canManagePosAdvanced: boolean
  orderTableLabel: (order: ManagerOrder) => string
  orderItemLabel: (item: ManagerOrder['orderItems'][number]) => string
  formatDateTime: (value?: string | null) => string
  onOpenEdit: (order: ManagerOrder) => void
  onOpenDetail: (order: ManagerOrder) => void
  onConfirmOrder: (orderId: string) => void
  onMarkReady: (orderId: string) => void
  onOpenPayment: (order: ManagerOrder) => void
}

export default function OrderCard({
  order,
  tone,
  ageMinutes,
  itemCount,
  payment,
  canManagePosAdvanced,
  orderTableLabel,
  orderItemLabel,
  formatDateTime,
  onOpenEdit,
  onOpenDetail,
  onConfirmOrder,
  onMarkReady,
  onOpenPayment,
}: OrderCardProps) {
  const isPaid = payment?.status === 'PAID'
  const isCompleted = order.status === 'COMPLETED' || isPaid
  const status = isCompleted
    ? STATUS_STYLE.done
    : order.status === 'PENDING'
      ? STATUS_STYLE.pending
      : order.status === 'READY'
        ? STATUS_STYLE.ready
        : STATUS_STYLE.working

  // "Bàn 8" becomes a big "8" in the table tile; other labels (takeaway, unknown table) stay as text.
  const tableLabel = orderTableLabel(order)
  const tableNumber = /^Bàn\s+(.+)$/.exec(tableLabel)?.[1] ?? null
  const visibleItems = order.orderItems.slice(0, 3)
  const hiddenItemCount = order.orderItems.length - visibleItems.length

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-amber-100 transition-shadow hover:shadow-md dark:bg-slate-800 dark:ring-slate-700">
      <div className={`h-1 ${status.bar}`} aria-hidden="true" />

      <div className="p-4">
        <header className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30"
            title={tableLabel}
          >
            {tableNumber ? (
              <>
                <span className="text-[9px] font-semibold uppercase leading-none tracking-wider text-amber-600/80">Bàn</span>
                <span className="mt-0.5 max-w-[2.75rem] truncate text-lg font-bold leading-none">{tableNumber}</span>
              </>
            ) : (
              <span className="px-1 text-center text-[10px] font-semibold leading-tight">{tableLabel}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate pt-0.5 text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white" title={order.id}>
                {maDonHangNgan(order.id)}
              </p>
              <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
                {isPaid ? 'Đã thanh toán' : trangThaiDonHang(order.status)}
              </span>
            </div>
            <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatDateTime(order.createdAt)}</p>
          </div>
        </header>

        {!isCompleted && (
          <p className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${WAIT_STYLE[tone]}`}>
            <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Đã chờ {formatWaitDuration(ageMinutes)}
          </p>
        )}

        <ul className="mt-3 space-y-1.5">
          {visibleItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 text-sm">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {item.quantity}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100" title={orderItemLabel(item)}>
                {orderItemLabel(item)}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
            </li>
          ))}
          {hiddenItemCount > 0 && <li className="pl-8 text-xs text-slate-400">+{hiddenItemCount} món khác</li>}
        </ul>

        {(order.discountAmount || 0) > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
            <span>🎁 Khuyến mãi {order.promotionCode ? `(${order.promotionCode})` : ''}</span>
            <span className="tabular-nums">-{Number(order.discountAmount || 0).toLocaleString('vi-VN')}đ</span>
          </div>
        )}

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-dashed border-amber-200 pt-3 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tổng · {itemCount} món</p>
            <p className="text-xl font-bold leading-tight tabular-nums text-slate-900 dark:text-white">
              {Number(order.totalAmount || 0).toLocaleString('vi-VN')}đ
            </p>
          </div>
          {isCompleted && (
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              {payment ? phuongThucThanhToan(payment.provider) : 'Đã hoàn thành'}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {order.status === 'PENDING' && !isCompleted && (
            <>
              <Button size="sm" variant="secondary" className={secondaryButtonClass} onClick={() => (canManagePosAdvanced ? onOpenEdit(order) : onOpenDetail(order))}>
                {canManagePosAdvanced ? 'Sửa món' : 'Chi tiết'}
              </Button>
              <Button size="sm" className={primaryButtonClass} onClick={() => onConfirmOrder(order.id)}>
                {tone === 'danger' ? 'Xác nhận ngay' : 'Xác nhận'}
              </Button>
            </>
          )}

          {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && !isCompleted && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className={`${secondaryButtonClass} ${canManagePosAdvanced ? '' : 'col-span-2'}`}
                onClick={() => onOpenDetail(order)}
              >
                Chi tiết
              </Button>
              {canManagePosAdvanced && (
                <Button size="sm" className={primaryButtonClass} onClick={() => onMarkReady(order.id)}>
                  Sẵn sàng
                </Button>
              )}
            </>
          )}

          {order.status === 'READY' && !isCompleted && (
            <>
              <Button size="sm" variant="secondary" className={secondaryButtonClass} onClick={() => onOpenDetail(order)}>
                Chi tiết
              </Button>
              <Button size="sm" className={primaryButtonClass} onClick={() => onOpenPayment(order)}>
                Thanh toán
              </Button>
            </>
          )}

          {isCompleted && (
            <Button size="sm" variant="secondary" className={`col-span-2 ${secondaryButtonClass}`} onClick={() => onOpenDetail(order)}>
              Chi tiết
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
