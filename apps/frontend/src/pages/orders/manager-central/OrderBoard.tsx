import { useState } from 'react'
import Card from '@/components/ui/Card'
import { RoutePageSkeleton } from '@/components/ui/PageSkeleton'
import OrderCard from './OrderCard'
import { ManagerBoardColumn, ManagerBoardColumnKey, ManagerOrder, ManagerPayment } from './managerTypes'

type Tone = 'neutral' | 'warning' | 'danger'
const DEFAULT_VISIBLE_ORDERS = 6
const LOAD_MORE_STEP = 6
const INITIAL_VISIBLE_ORDERS_BY_COLUMN: Record<ManagerBoardColumnKey, number> = {
  PENDING: DEFAULT_VISIBLE_ORDERS,
  WORKING: DEFAULT_VISIBLE_ORDERS,
  COMPLETED: DEFAULT_VISIBLE_ORDERS,
}

interface OrderBoardProps {
  loading: boolean
  hasOrders: boolean
  columns: ManagerBoardColumn[]
  mobileColumn: ManagerBoardColumnKey
  setMobileColumn: (value: ManagerBoardColumnKey) => void
  paymentByOrderId: Record<string, ManagerPayment>
  canManagePosAdvanced: boolean
  getOrderAgeMinutes: (createdAt: string) => number
  getOrderTone: (order: ManagerOrder) => Tone
  orderTableLabel: (order: ManagerOrder) => string
  orderItemLabel: (item: ManagerOrder['orderItems'][number]) => string
  formatDateTime: (value?: string | null) => string
  onOpenEdit: (order: ManagerOrder) => void
  onOpenDetail: (order: ManagerOrder) => void
  onConfirmOrder: (orderId: string) => void
  onMarkReady: (orderId: string) => void
  onOpenPayment: (order: ManagerOrder) => void
}

export default function OrderBoard({
  loading,
  hasOrders,
  columns,
  mobileColumn,
  setMobileColumn,
  paymentByOrderId,
  canManagePosAdvanced,
  getOrderAgeMinutes,
  getOrderTone,
  orderTableLabel,
  orderItemLabel,
  formatDateTime,
  onOpenEdit,
  onOpenDetail,
  onConfirmOrder,
  onMarkReady,
  onOpenPayment,
}: OrderBoardProps) {
  const [visibleOrdersByColumn, setVisibleOrdersByColumn] =
    useState<Record<ManagerBoardColumnKey, number>>(INITIAL_VISIBLE_ORDERS_BY_COLUMN)

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {columns.map((column) => (
          <button
            key={column.key}
            type="button"
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold ring-1 ring-inset transition ${
              mobileColumn === column.key
                ? 'bg-amber-500 text-white ring-amber-500'
                : 'bg-white/90 text-slate-600 ring-amber-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
            }`}
            onClick={() => setMobileColumn(column.key)}
          >
            {column.title}
            <span className="tabular-nums opacity-80">{column.orders.length}</span>
          </button>
        ))}
      </div>

      {loading && <RoutePageSkeleton kind="table" />}
      {!loading && !hasOrders && (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">Không có đơn phù hợp với bộ lọc hiện tại.</p>
        </Card>
      )}

      {!loading && hasOrders && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {columns.map((column) => {
            const hiddenOnMobile = mobileColumn !== column.key ? 'hidden md:flex' : 'flex'
            const visibleLimit = visibleOrdersByColumn[column.key] ?? DEFAULT_VISIBLE_ORDERS
            const visibleOrders = column.orders.slice(0, visibleLimit)
            const remainingOrders = Math.max(column.orders.length - visibleOrders.length, 0)
            return (
              <div
                key={column.key}
                className={`${hiddenOnMobile} glass-panel min-h-[520px] flex-col rounded-2xl p-3 ring-1 ring-amber-100/80 dark:ring-slate-700 sm:p-4`}
              >
                <div className="mb-3 flex items-center justify-between border-b border-amber-100 pb-3 dark:border-slate-700">
                  <p className="inline-flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-white">
                    <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} aria-hidden="true" />
                    {column.title}
                  </p>
                  <span className="min-w-7 rounded-full bg-amber-100 px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                    {column.orders.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {column.orders.length === 0 && (
                    <div className="rounded-xl border border-dashed border-amber-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
                      Chưa có đơn trong cột này.
                    </div>
                  )}
                  {visibleOrders.map((order) => {
                    const tone = getOrderTone(order)
                    const ageMinutes = getOrderAgeMinutes(order.createdAt)
                    const itemCount = order.orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
                    return (
                      <OrderCard
                        key={order.id}
                        order={order}
                        tone={tone}
                        ageMinutes={ageMinutes}
                        itemCount={itemCount}
                        payment={paymentByOrderId[order.id]}
                        canManagePosAdvanced={canManagePosAdvanced}
                        orderTableLabel={orderTableLabel}
                        orderItemLabel={orderItemLabel}
                        formatDateTime={formatDateTime}
                        onOpenEdit={onOpenEdit}
                        onOpenDetail={onOpenDetail}
                        onConfirmOrder={onConfirmOrder}
                        onMarkReady={onMarkReady}
                        onOpenPayment={onOpenPayment}
                      />
                    )
                  })}
                  {column.orders.length > DEFAULT_VISIBLE_ORDERS && (
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-50 dark:text-amber-300 dark:ring-slate-700 dark:hover:bg-slate-800"
                      onClick={() =>
                        setVisibleOrdersByColumn((prev) => ({
                          ...prev,
                          [column.key]:
                            remainingOrders > 0
                              ? Math.min((prev[column.key] ?? DEFAULT_VISIBLE_ORDERS) + LOAD_MORE_STEP, column.orders.length)
                              : DEFAULT_VISIBLE_ORDERS,
                        }))
                      }
                    >
                      {remainingOrders > 0 ? `Xem thêm ${Math.min(LOAD_MORE_STEP, remainingOrders)} đơn` : 'Thu gọn'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
