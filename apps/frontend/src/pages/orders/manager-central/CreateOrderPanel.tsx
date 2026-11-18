import { FormEvent, RefObject } from 'react'
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { ManagerCustomCartLine, ManagerMenuItem, ManagerTable } from './managerTypes'

interface CreateOrderPanelProps {
  selectedTableId: string
  setSelectedTableId: (value: string) => void
  tableSelectRef: RefObject<HTMLSelectElement>
  tables: ManagerTable[]
  quickItems: ManagerMenuItem[]
  menuItems: ManagerMenuItem[]
  cart: Record<string, number>
  customCartLines: ManagerCustomCartLine[]
  cartTotal: number
  customCartTotal: number
  creating: boolean
  onSubmit: (event: FormEvent) => void
  onIncrease: (menuItemId: string) => void
  onDecrease: (menuItemId: string) => void
  onRemoveCustomLine: (localId: string) => void
}

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
const stepButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-50 disabled:opacity-40 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700'

export default function CreateOrderPanel({
  selectedTableId,
  setSelectedTableId,
  tableSelectRef,
  tables,
  quickItems,
  menuItems,
  cart,
  customCartLines,
  cartTotal,
  customCartTotal,
  creating,
  onSubmit,
  onIncrease,
  onDecrease,
  onRemoveCustomLine,
}: CreateOrderPanelProps) {
  const total = cartTotal + customCartTotal
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0)
    + customCartLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)

  return (
    <Card title="Tạo đơn mới" subtitle="Chọn bàn, thêm món rồi tạo đơn" className="xl:sticky xl:top-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="pos-create-table">Bàn phục vụ</label>
          <select
            id="pos-create-table"
            ref={tableSelectRef}
            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-amber-400 dark:focus:ring-amber-400/20"
            value={selectedTableId}
            onChange={(e) => setSelectedTableId(e.target.value)}
          >
            <option value="">Chọn bàn</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>Bàn {table.number}</option>
            ))}
          </select>
        </div>

        {quickItems.length > 0 && (
          <div>
            <p className={labelClass}>Món nhanh</p>
            <div className="grid grid-cols-2 gap-2">
              {quickItems.map((item) => {
                const qty = cart[item.id] || 0
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`relative rounded-xl px-3 py-2 text-left ring-1 ring-inset transition ${
                      qty > 0
                        ? 'bg-amber-50 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40'
                        : 'bg-white ring-amber-100 hover:bg-amber-50/60 dark:bg-slate-800 dark:ring-slate-700 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => onIncrease(item.id)}
                  >
                    <p className="truncate pr-5 text-sm font-medium text-slate-800 dark:text-white">{item.name}</p>
                    <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{item.price.toLocaleString('vi-VN')}đ</p>
                    {qty > 0 && (
                      <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
                        {qty}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <p className={labelClass}>Tất cả món</p>
          <div className="max-h-60 divide-y divide-amber-100/80 overflow-y-auto rounded-xl ring-1 ring-inset ring-amber-100 dark:divide-slate-700 dark:ring-slate-700">
            {menuItems.filter((item) => item.available).map((item) => {
              const qty = cart[item.id] || 0
              return (
                <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-white">{item.name}</p>
                    <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{item.price.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className={stepButtonClass} onClick={() => onDecrease(item.id)} disabled={qty === 0} aria-label={`Bớt ${item.name}`}>
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className={`w-5 text-center tabular-nums ${qty > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400'}`}>{qty}</span>
                    <button type="button" className={stepButtonClass} onClick={() => onIncrease(item.id)} aria-label={`Thêm ${item.name}`}>
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {customCartLines.length > 0 && (
          <div>
            <p className={labelClass}>Món đã tùy chỉnh</p>
            <div className="space-y-2">
              {customCartLines.map((line) => (
                <div key={line.localId} className="flex items-start justify-between gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-xs dark:bg-slate-800">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-white">{line.quantity}× {line.menuItemName}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {line.selectedOptions.size?.name ? `Size ${line.selectedOptions.size.name}. ` : ''}
                      {Array.isArray(line.selectedOptions.toppings) && line.selectedOptions.toppings.length > 0
                        ? `Topping: ${line.selectedOptions.toppings.map((item) => item.name).join(', ')}. `
                        : ''}
                      {line.selectedOptions.note ? `Ghi chú: ${line.selectedOptions.note}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-1 text-rose-600 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-50"
                    onClick={() => onRemoveCustomLine(line.localId)}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end justify-between border-t border-dashed border-amber-200 pt-3 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tổng cộng{cartCount > 0 ? ` · ${cartCount} món` : ''}</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{total.toLocaleString('vi-VN')}đ</p>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={creating}>
          Tạo đơn
        </Button>
      </form>
    </Card>
  )
}
