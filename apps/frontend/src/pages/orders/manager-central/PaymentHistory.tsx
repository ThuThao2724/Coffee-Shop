import Card from '@/components/ui/Card'
import { maDonHangNgan, phuongThucThanhToan, trangThaiThanhToan } from '@/utils/display'
import { ManagerOrder, ManagerPayment } from './managerTypes'

interface PaymentHistoryProps {
  loading: boolean
  payments: ManagerPayment[]
  expandedRows: Record<string, boolean>
  historyOrderDetails: Record<string, ManagerOrder>
  onToggleRow: (payment: ManagerPayment) => Promise<void>
  orderItemLabel: (item: ManagerOrder['orderItems'][number]) => string
  tableLabel: (tableId: string) => string
}

const PAYMENT_STATUS_CHIP: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const GRID = 'md:grid-cols-[1.2fr_1fr_1.2fr_1fr_0.9fr_auto]'

export default function PaymentHistory({
  loading,
  payments,
  expandedRows,
  historyOrderDetails,
  onToggleRow,
  orderItemLabel,
  tableLabel,
}: PaymentHistoryProps) {
  return (
    <Card title="Lịch sử thanh toán gần đây" subtitle="8 giao dịch mới nhất của chi nhánh">
      {loading && <p className="text-sm text-slate-500">Đang tải lịch sử...</p>}
      {!loading && payments.length === 0 && <p className="text-sm text-slate-500">Chưa có giao dịch thanh toán.</p>}
      {!loading && payments.length > 0 && (
        <div className="-mx-1 overflow-hidden">
          <div className={`hidden gap-3 border-b border-amber-100 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 md:grid ${GRID}`}>
            <span>Mã đơn</span>
            <span>Phương thức</span>
            <span>Thời gian</span>
            <span className="text-right">Số tiền</span>
            <span>Vị trí</span>
            <span />
          </div>
          <div className="divide-y divide-amber-100/80 dark:divide-slate-700">
            {payments.slice(0, 8).map((payment) => {
              const order = historyOrderDetails[payment.orderId]
              const expanded = Boolean(expandedRows[payment.paymentId])
              const chip = PAYMENT_STATUS_CHIP[String(payment.status || '').toUpperCase()] || 'bg-slate-100 text-slate-600 ring-slate-200'
              return (
                <div key={payment.paymentId} className="px-1 py-3 text-sm text-slate-700 dark:text-slate-200">
                  <div className={`grid grid-cols-2 items-center gap-x-3 gap-y-1 ${GRID}`}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white" title={payment.orderId}>{maDonHangNgan(payment.orderId)}</p>
                      <p className="truncate text-xs text-slate-500">{payment.paidBy || payment.customerName || 'Khách hàng'}</p>
                    </div>
                    <div>
                      <p>{phuongThucThanhToan(payment.provider)}</p>
                      <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${chip}`}>
                        {trangThaiThanhToan(payment.status)}
                      </span>
                    </div>
                    <p className="tabular-nums text-slate-500">{payment.paidAt ? new Date(payment.paidAt).toLocaleString('vi-VN') : '—'}</p>
                    <p className="font-semibold tabular-nums text-slate-900 dark:text-white md:text-right">
                      {Number(payment.amount || 0).toLocaleString('vi-VN')}đ
                    </p>
                    <p>{payment.tableId ? tableLabel(payment.tableId) : 'Mang đi'}</p>
                    <button
                      type="button"
                      className="justify-self-start whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-50 dark:text-amber-300 dark:ring-slate-600 dark:hover:bg-slate-800 md:justify-self-end"
                      onClick={() => void onToggleRow(payment)}
                    >
                      {expanded ? 'Ẩn món' : 'Xem món'}
                    </button>
                  </div>
                  {expanded && order && (
                    <div className="mt-2 space-y-1 rounded-xl bg-amber-50/60 p-3 text-xs dark:bg-slate-800">
                      {order.orderItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <span>{item.quantity}× {orderItemLabel(item)}</span>
                          <span className="tabular-nums">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
