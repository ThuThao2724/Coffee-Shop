import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/authStore'
import { useBranchScopeStore } from '@/stores/branchScopeStore'
import { maDonHangNgan, phuongThucThanhToan } from '@/utils/display'

const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  ISSUED: { label: 'Đã phát hành', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  VOIDED: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

function InvoiceStatusChip({ status }: { status: string }) {
  const meta = INVOICE_STATUS[status] || { label: status, className: 'bg-slate-100 text-slate-600 ring-slate-200' }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}>
      {meta.label}
    </span>
  )
}

interface InvoiceItem {
  id: string
  invoiceNumber: string
  issueDate: string
  customerName?: string | null
  subtotal: number
  discount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  paymentMethod: string
  status: 'ISSUED' | 'VOIDED'
  pdfUrl?: string | null
}

interface InvoiceListResponse {
  data: InvoiceItem[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export default function Invoices() {
  const user = useAuthStore((s) => s.user)
  const selectedBranchId = useBranchScopeStore((s) => s.selectedBranchId)
  const [rows, setRows] = useState<InvoiceItem[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [status, setStatus] = useState<'ALL' | 'ISSUED' | 'VOIDED'>('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [meta, setMeta] = useState<InvoiceListResponse['meta']>({ total: 0, page: 1, limit: 50, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [regenerateOrderId, setRegenerateOrderId] = useState('')

  const branchId = String(selectedBranchId || user?.branchId || '').trim()
  const role = String(user?.role || '').toUpperCase()

  const canVoid = role === 'ADMIN' || role === 'MANAGER'
  const canRegenerate = role === 'ADMIN'
  const canViewInvoices = ['ADMIN', 'MANAGER', 'WAITER'].includes(role)

  const params = useMemo(
    () => ({
      status,
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
      page,
      limit: 50,
    }),
    [status, startDate, endDate, page],
  )

  const load = async () => {
    if (!canViewInvoices || !branchId) {
      setRows([])
      setSelected(null)
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get<InvoiceListResponse>(`/branches/${branchId}/invoices`, { params })
      const list = Array.isArray(data?.data) ? data.data : []
      setRows(list)
      setMeta(data?.meta || { total: 0, page, limit: 50, totalPages: 1 })
      if (selected?.id) {
        const still = list.find((x) => x.id === selected.id)
        if (!still) setSelected(null)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không tải được danh sách hóa đơn')
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/invoices/${id}`)
      setSelected(data)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không tải được chi tiết hóa đơn')
    } finally {
      setDetailLoading(false)
    }
  }

  const voidInvoice = async () => {
    if (!selected?.id || !canVoid) return
    const reason = window.prompt('Nhập lý do hủy hóa đơn:')
    if (!reason || !reason.trim()) return
    try {
      await api.post(`/invoices/${selected.id}/void`, { reason: reason.trim() })
      toast.success('Đã hủy hóa đơn')
      await openDetail(selected.id)
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Hủy hóa đơn thất bại')
    }
  }

  const openPdf = async () => {
    if (!selected?.id) return
    try {
      const { data } = await api.get(`/invoices/${selected.id}/pdf`, { responseType: 'blob' })
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không tải được PDF hóa đơn')
    }
  }

  const exportCsv = () => {
    const header = ['invoiceNumber', 'issueDate', 'customerName', 'paymentMethod', 'status', 'subtotal', 'discount', 'taxRate', 'taxAmount', 'totalAmount']
    const lines = rows.map((row) =>
      [
        row.invoiceNumber,
        new Date(row.issueDate).toISOString(),
        row.customerName || '',
        row.paymentMethod,
        row.status,
        Number(row.subtotal || 0),
        Number(row.discount || 0),
        Number(row.taxRate || 0),
        Number(row.taxAmount || 0),
        Number(row.totalAmount || 0),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices_${branchId || 'branch'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const regenerateInvoice = async () => {
    if (!canRegenerate) return
    const orderId = regenerateOrderId.trim()
    if (!orderId) {
      toast.error('Nhập mã đơn hàng cần tạo lại hóa đơn')
      return
    }
    try {
      await api.post(`/orders/${orderId}/invoice/regenerate`)
      toast.success('Đã tạo lại hóa đơn')
      setRegenerateOrderId('')
      await load()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Tạo lại hóa đơn thất bại')
    }
  }

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return rows
    return rows.filter((row) =>
      `${row.invoiceNumber} ${row.customerName || ''}`.toLowerCase().includes(kw),
    )
  }, [rows, keyword])

  const summaryRevenue = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
    [filteredRows],
  )

  useEffect(() => {
    void load()
  }, [branchId, status, startDate, endDate, page])

  useEffect(() => {
    setPage(1)
  }, [status, startDate, endDate, branchId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản lý hóa đơn</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>Xuất CSV</Button>
          <Button onClick={load} loading={loading}>Làm mới</Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-amber-100 p-3">
            <p className="text-xs text-slate-500">Tổng hóa đơn (trang hiện tại)</p>
            <p className="text-xl font-bold text-slate-900">{filteredRows.length}</p>
          </div>
          <div className="rounded-xl border border-amber-100 p-3">
            <p className="text-xs text-slate-500">Tổng doanh thu (trang hiện tại)</p>
            <p className="text-xl font-bold text-emerald-700">{summaryRevenue.toLocaleString('vi-VN')}đ</p>
          </div>
          <div className="rounded-xl border border-amber-100 p-3">
            <p className="text-xs text-slate-500">Tổng số hóa đơn (mọi trang)</p>
            <p className="text-xl font-bold text-slate-900">{meta.total}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Input placeholder="Tìm theo số HĐ / khách hàng" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ISSUED">Đã phát hành</option>
            <option value="VOIDED">Đã hủy</option>
          </select>
        </div>
        {canRegenerate && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              className="w-full md:w-80"
              placeholder="Mã đơn hàng cần tạo lại hóa đơn"
              value={regenerateOrderId}
              onChange={(e) => setRegenerateOrderId(e.target.value)}
            />
            <Button variant="secondary" onClick={regenerateInvoice}>Tạo lại hóa đơn</Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {!branchId && (
            <p className="pb-3 text-sm text-amber-700">
              Không xác định được chi nhánh làm việc. Vui lòng đăng nhập lại hoặc liên hệ quản lý để gán chi nhánh.
            </p>
          )}
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-amber-100 text-slate-500">
                  <th className="py-2">Số hóa đơn</th>
                  <th className="py-2">Ngày</th>
                  <th className="py-2">Khách</th>
                  <th className="py-2">Tiền</th>
                  <th className="py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-amber-50 hover:bg-amber-50/50"
                    onClick={() => openDetail(row.id)}
                  >
                    <td className="py-2 font-medium">{row.invoiceNumber}</td>
                    <td className="py-2">{new Date(row.issueDate).toLocaleString('vi-VN')}</td>
                    <td className="py-2">{row.customerName || 'Khách vãng lai'}</td>
                    <td className="py-2">{Number(row.totalAmount).toLocaleString('vi-VN')}đ</td>
                    <td className="py-2"><InvoiceStatusChip status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span>Trang {meta.page}/{Math.max(1, meta.totalPages)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Trang trước
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= Math.max(1, meta.totalPages)} onClick={() => setPage((prev) => prev + 1)}>
                Trang sau
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          {detailLoading && <p className="text-sm text-slate-500">Đang tải chi tiết...</p>}
          {!detailLoading && !selected && <p className="text-sm text-slate-500">Chọn hóa đơn để xem chi tiết</p>}
          {!detailLoading && selected && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{selected.invoiceNumber}</p>
              <p>Đơn hàng: <span title={selected.orderId}>{maDonHangNgan(selected.orderId)}</span></p>
              <p>Khách: {selected.customerName || 'Khách vãng lai'}</p>
              <p>Tổng cộng: {Number(selected.totalAmount).toLocaleString('vi-VN')}đ</p>
              <p>Thanh toán: {phuongThucThanhToan(selected.paymentMethod)}</p>
              <p>Trạng thái: <InvoiceStatusChip status={selected.status} /></p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={openPdf}>
                  Xem PDF
                </Button>
                {canVoid && selected.status !== 'VOIDED' && (
                  <Button size="sm" variant="danger" onClick={voidInvoice}>Hủy hóa đơn</Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
