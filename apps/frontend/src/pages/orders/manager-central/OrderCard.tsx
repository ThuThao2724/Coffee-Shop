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

const secondaryButtonClass = 'min-h-10 rounded-xl border border-[#80756c] bg-white text-sm text-[#33210d]'

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
  const borderTone = isCompleted
    ? 'border-l-emerald-500'
    : order.status === 'PENDING'
      ? 'border-l-red-500'
      : 'border-l-[#5e604d]'
  const cardBg = isCompleted ? 'bg-[#faf2ee]/80' : 'bg-white'
  const actionPrimaryClass = order.status === 'PENDING'
    ? 'bg-[#33210d] text-white hover:bg-[#4b3621]'
    : order.status === 'READY'
      ? 'bg-[#33210d] text-white hover:bg-[#4b3621]'
      : 'bg-[#5e604d] text-white hover:bg-[#474836]'

  return (
    <article className={`rounded-2xl border border-[#e8e1dd] border-l-4 ${borderTone} ${cardBg} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight tracking-tight text-[#291806]" title={order.id}>
            {maDonHangNgan(order.id)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4e453d]">
            <span className="rounded-md bg-[#f4ece9] px-2 py-0.5 font-semibold text-[#33210d]">{orderTableLabel(order)}</span>
            <span className="tabular-nums">{formatDateTime(order.createdAt)}</span>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#e8e1dd] px-2.5 py-1 text-[11px] font-semibold text-[#4e453d]">
          {isPaid ? 'Đã thanh toán' : trangThaiDonHang(order.status)}
        </span>
      </div>

      {!isCompleted && (
        <p className={`mt-2 text-xs ${tone === 'danger' ? 'font-semibold text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-[#4e453d]'}`}>
          ⏱ Đã chờ {formatWaitDuration(ageMinutes)}
        </p>
      )}

      <div className="mt-3 space-y-1 border-y border-[#d2c4ba] py-2 text-sm leading-6 text-[#291806]">
        {order.orderItems.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words">
              <span className="font-semibold">{item.quantity}×</span> {orderItemLabel(item)}
            </span>
            <span className="shrink-0 tabular-nums">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
          </div>
        ))}
        {order.orderItems.length > 3 && <p className="text-xs text-[#4e453d]">+{order.orderItems.length - 3} món khác</p>}
        {(order.discountAmount || 0) > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#ffdad6]/50 px-2 py-1 text-sm text-[#93000a]">
            <span>🎁 Khuyến mãi {order.promotionCode ? `(${order.promotionCode})` : ''}</span>
            <span>-{Number(order.discountAmount || 0).toLocaleString('vi-VN')}đ</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-[#4e453d]">{itemCount} món</p>
          <p className="text-xl font-bold leading-tight tabular-nums text-[#33210d]">{Number(order.totalAmount || 0).toLocaleString('vi-VN')}đ</p>
        </div>
        {isCompleted && (
          <p className="text-right text-xs font-semibold text-emerald-700">
            ✓ {payment ? phuongThucThanhToan(payment.provider) : 'Đã hoàn thành'}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {order.status === 'PENDING' && !isCompleted && (
          <>
            <Button size="sm" variant="secondary" className={secondaryButtonClass} onClick={() => (canManagePosAdvanced ? onOpenEdit(order) : onOpenDetail(order))}>
              {canManagePosAdvanced ? 'Sửa món' : 'Chi tiết'}
            </Button>
            <Button size="sm" className={`min-h-10 rounded-xl text-sm ${actionPrimaryClass}`} onClick={() => onConfirmOrder(order.id)}>
              {tone === 'danger' ? 'Xác nhận ngay' : 'Xác nhận'}
            </Button>
          </>
        )}

        {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && !isCompleted && (
          <>
            <Button size="sm" variant="secondary" className={secondaryButtonClass} onClick={() => onOpenDetail(order)}>
              Chi tiết
            </Button>
            {canManagePosAdvanced && (
              <Button size="sm" className={`min-h-10 rounded-xl text-sm ${actionPrimaryClass}`} onClick={() => onMarkReady(order.id)}>
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
            <Button size="sm" className={`min-h-10 rounded-xl text-sm ${actionPrimaryClass}`} onClick={() => onOpenPayment(order)}>
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
    </article>
  )
}
