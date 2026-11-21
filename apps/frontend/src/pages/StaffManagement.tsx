import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode/lib/browser'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { useBranchScopeStore } from '@/stores/branchScopeStore'
import api from '@/utils/api'
import { TableSkeleton } from '@/components/ui/PageSkeleton'
import {
  caLamViec,
  trangThaiHoatDong,
  vaiTroNhanVien,
} from '@/utils/display'
import { normalizeRole } from '@/utils/rbac'

type StaffRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'BARISTA' | 'STAFF'
type ShiftType = string

interface StaffItem {
  id: string
  name: string
  email: string
  phone?: string | null
  role: StaffRole
  branchId?: string | null
  branchName?: string | null
  employeeCode?: string | null
  personalQrCode?: string | null
  preferredShift?: ShiftType | null
  isActive: boolean
  createdAt: string
}

interface BranchItem {
  id: string
  name: string
  isActive: boolean
}

const selectClass =
  'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-amber-400 dark:focus:ring-amber-400/20'

const softPanelClass = 'rounded-xl border border-amber-100 bg-white/90 p-4'

const roleBadgeClass: Record<StaffRole, string> = {
  ADMIN: 'bg-rose-100 text-rose-700',
  MANAGER: 'bg-violet-100 text-violet-700',
  WAITER: 'bg-sky-100 text-sky-700',
  BARISTA: 'bg-amber-100 text-amber-700',
  STAFF: 'bg-slate-100 text-slate-700',
}

export default function StaffManagement() {
  const currentUser = useAuthStore((state) => state.user)
  const selectedBranchId = useBranchScopeStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useBranchScopeStore((state) => state.setSelectedBranchId)
  const currentRole = normalizeRole(currentUser?.role)
  const canManageAccounts = currentRole === 'ADMIN' || currentRole === 'MANAGER'
  const canManagePrivilegedAccounts = currentRole === 'ADMIN'
  const [staffs, setStaffs] = useState<StaffItem[]>([])
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [staffKeyword, setStaffKeyword] = useState('')
  const [staffRoleFilter, setStaffRoleFilter] = useState<'ALL' | StaffRole>('ALL')
  const [staffBranchFilter, setStaffBranchFilter] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'WAITER' as StaffRole,
    employeeCode: '',
    personalQrCode: '',
    preferredShift: 'MORNING' as ShiftType,
    branchId: '',
    isActive: true,
  })
  const [savingStaff, setSavingStaff] = useState(false)
  const [checkingExists, setCheckingExists] = useState(false)
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [employeeCodeExists, setEmployeeCodeExists] = useState<boolean | null>(null)

  const checkExistsTimerRef = useRef<number | null>(null)
  const [staffQrImages, setStaffQrImages] = useState<Record<string, string>>({})
  const activeBranchId = useMemo(() => {
    if (currentRole === 'MANAGER') return currentUser?.branchId || ''
    if (selectedBranchId) return selectedBranchId
    if (staffBranchFilter) return staffBranchFilter
    return branches[0]?.id || ''
  }, [branches, currentRole, currentUser?.branchId, selectedBranchId, staffBranchFilter])

  // Keep the form's branch dropdown showing the branch the new staff will actually be saved to.
  // (Previously it showed "Chưa gán chi nhánh" while submit silently used activeBranchId.)
  useEffect(() => {
    if (editingStaffId) return
    setStaffForm((prev) => {
      if (currentRole === 'MANAGER') {
        const own = currentUser?.branchId || ''
        return prev.branchId === own ? prev : { ...prev, branchId: own }
      }
      return prev.branchId || !activeBranchId ? prev : { ...prev, branchId: activeBranchId }
    })
  }, [activeBranchId, currentRole, currentUser?.branchId, editingStaffId])

  const activeStaffs = useMemo(
    () => staffs.filter((item) => item.isActive),
    [staffs],
  )
  const inactiveStaffCount = useMemo(() => staffs.filter((item) => !item.isActive).length, [staffs])
  const roleBreakdown = useMemo(
    () =>
      staffs.reduce<Record<StaffRole, number>>(
        (acc, item) => {
          const role = (item.role || 'STAFF') as StaffRole
          acc[role] = (acc[role] || 0) + 1
          return acc
        },
        { ADMIN: 0, MANAGER: 0, WAITER: 0, BARISTA: 0, STAFF: 0 },
      ),
    [staffs],
  )
  const loadStaffs = async () => {
    if (!activeBranchId) {
      setStaffs([])
      setLoadingStaff(false)
      return
    }
    setLoadingStaff(true)
    try {
      const { data } = await api.get(`/branches/${activeBranchId}/staff`, {
        params: {
          page: 1,
          limit: 200,
          role: staffRoleFilter !== 'ALL' ? staffRoleFilter : undefined,
          isActive: includeInactive ? undefined : true,
          search: staffKeyword.trim() || undefined,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      })
      let next = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      setStaffs(next)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không tải được danh sách nhân viên')
    } finally {
      setLoadingStaff(false)
    }
  }

  const loadBranches = async () => {
    if (!canManageAccounts) {
      setBranches([])
      return
    }

    try {
      if (currentRole === 'ADMIN') {
        const { data } = await api.get('/branches', {
          params: { includeInactive: 'true' },
        })
        setBranches(Array.isArray(data) ? data : [])
        return
      }
      if (currentRole === 'MANAGER' && currentUser?.branchId) {
        const { data } = await api.get(`/branches/${currentUser.branchId}`)
        setBranches(data ? [data] : [])
        return
      }
      setBranches([])
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không tải được danh sách chi nhánh')
    }
  }

  useEffect(() => {
    loadStaffs()
  }, [staffKeyword, staffRoleFilter, includeInactive, activeBranchId])

  useEffect(() => {
    void loadBranches()
  }, [canManageAccounts, currentRole, currentUser?.branchId])

  useEffect(() => {
    if (currentRole !== 'ADMIN') return
    if (!selectedBranchId) return
    if (staffBranchFilter === selectedBranchId) return
    setStaffBranchFilter(selectedBranchId)
  }, [currentRole, selectedBranchId, staffBranchFilter])

  useEffect(() => {
    if (editingStaffId) {
      setEmailExists(null)
      setEmployeeCodeExists(null)
      return
    }
    if (checkExistsTimerRef.current !== null) {
      window.clearTimeout(checkExistsTimerRef.current)
      checkExistsTimerRef.current = null
    }
    const email = staffForm.email.trim()
    const employeeCode = staffForm.employeeCode.trim()
    const branchId = (staffForm.branchId || activeBranchId || '').trim()
    const shouldCheckCode = !!employeeCode && !!branchId
    if (!email && !employeeCode) {
      setEmailExists(null)
      setEmployeeCodeExists(null)
      return
    }

    checkExistsTimerRef.current = window.setTimeout(async () => {
      setCheckingExists(true)
      try {
        const { data } = await api.get('/staff/check-exists', {
          params: {
            email: email || undefined,
            employeeCode: shouldCheckCode ? employeeCode : undefined,
            branchId: shouldCheckCode ? branchId : undefined,
          },
        })
        setEmailExists(Boolean(data?.email?.exists))
        setEmployeeCodeExists(shouldCheckCode ? Boolean(data?.employeeCode?.exists) : null)
      } catch {
        setEmailExists(null)
        setEmployeeCodeExists(null)
      } finally {
        setCheckingExists(false)
      }
    }, 500)

    return () => {
      if (checkExistsTimerRef.current !== null) {
        window.clearTimeout(checkExistsTimerRef.current)
        checkExistsTimerRef.current = null
      }
    }
  }, [staffForm.email, staffForm.employeeCode, staffForm.branchId, activeBranchId, editingStaffId])

  useEffect(() => {
    let cancelled = false
    const generateStaffQrImages = async () => {
      try {
        const qrTargets = staffs.filter((staff) => staff.personalQrCode && staff.personalQrCode.trim().length > 0)
        if (!qrTargets.length) {
          setStaffQrImages({})
          return
        }

        const pairs = await Promise.all(
          qrTargets.map(async (staff) => {
            const qrDataUrl = await QRCode.toDataURL(staff.personalQrCode as string, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 220,
            })
            return [staff.id, qrDataUrl] as const
          }),
        )

        if (!cancelled) {
          setStaffQrImages(Object.fromEntries(pairs))
        }
      } catch {
        if (!cancelled) {
          setStaffQrImages({})
        }
      }
    }

    void generateStaffQrImages()
    return () => {
      cancelled = true
    }
  }, [staffs])

  const resetStaffForm = () => {
    setEditingStaffId(null)
    setStaffForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'WAITER',
      employeeCode: '',
      personalQrCode: '',
      preferredShift: 'MORNING',
      branchId: activeBranchId || '',
      isActive: true,
    })
    setEmailExists(null)
    setEmployeeCodeExists(null)
  }

  const exportStaffCsv = async () => {
    if (!activeBranchId) {
      toast.error('Thiếu chi nhánh để xuất danh sách')
      return
    }
    try {
      const { data } = await api.get(`/branches/${activeBranchId}/staff/export`, {
        params: { includeInactive },
      })
      const csv = String(data?.csv || '')
      const filename = String(data?.filename || `staff-${activeBranchId}.csv`)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Đã xuất danh sách nhân viên')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Xuất danh sách thất bại')
    }
  }

  const startEditStaff = (staff: StaffItem) => {
    if (!canManageTargetStaff(staff)) {
      toast.error('Ban khong duoc sua tai khoan nay')
      return
    }
    setEditingStaffId(staff.id)
    setStaffForm({
      name: staff.name || '',
      email: staff.email || '',
      password: '',
      phone: staff.phone || '',
      role: staff.role || 'WAITER',
      employeeCode: staff.employeeCode || '',
      personalQrCode: staff.personalQrCode || '',
      preferredShift: staff.preferredShift || 'MORNING',
      branchId: staff.branchId || '',
      isActive: staff.isActive,
    })
  }

  const submitStaffForm = async (e: FormEvent) => {
    e.preventDefault()
    if (!canManageAccounts) {
      toast.error('Chi ADMIN hoac MANAGER moi duoc quan ly tai khoan')
      return
    }
    if (!canManageTargetRole(staffForm.role)) {
      toast.error('Role da chon vuot qua quyen hien tai')
      return
    }
    const email = staffForm.email.trim().toLowerCase()
    const password = staffForm.password.trim()
    const employeeCode = staffForm.employeeCode.trim().toUpperCase()
    const branchId = (staffForm.branchId || activeBranchId || '').trim()
    const isManager = currentRole === 'MANAGER'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!staffForm.name.trim()) {
      toast.error('Họ tên không được để trống')
      return
    }
    if (!emailRegex.test(email)) {
      toast.error('Email không hợp lệ')
      return
    }
    if (password) {
      const hasUpper = /[A-Z]/.test(password)
      const hasDigit = /\d/.test(password)
      if (password.length < 8 || !hasUpper || !hasDigit) {
        toast.error('Mật khẩu tối thiểu 8 ký tự, có chữ hoa và số')
        return
      }
    }
    if (employeeCode && !/^[A-Z0-9-]+$/.test(employeeCode)) {
      toast.error('Mã nhân viên chỉ gồm chữ, số, dấu gạch ngang')
      return
    }
    if (!branchId) {
      toast.error('Vui lòng chọn chi nhánh cho nhân viên')
      return
    }
    if (!editingStaffId && emailExists) {
      toast.error('Email đã tồn tại trong hệ thống')
      return
    }
    if (!editingStaffId && employeeCode && employeeCodeExists) {
      toast.error('Mã nhân viên đã tồn tại trong chi nhánh')
      return
    }

    setSavingStaff(true)
    try {
      if (editingStaffId) {
        const payload: any = {
          name: staffForm.name.trim(),
          email,
          phone: staffForm.phone || null,
          personalQrCode: staffForm.personalQrCode,
          preferredShift: staffForm.preferredShift,
          isActive: staffForm.isActive,
        }
        if (!isManager) {
          payload.role = staffForm.role
          payload.employeeCode = employeeCode
          payload.branchId = branchId
        }
        if (password) {
          payload.password = password
        }
        await api.put(`/staff/${editingStaffId}`, payload)
        toast.success('Đã cập nhật nhân viên')
      } else {
        await api.post(`/branches/${branchId}/staff`, {
          name: staffForm.name.trim(),
          email,
          password: password || undefined,
          phone: staffForm.phone || null,
          role: staffForm.role,
          employeeCode: employeeCode || null,
          personalQrCode: null,
          branchId,
        })
        const targetBranchName = branches.find((branch) => branch.id === branchId)?.name || branchId
        if (branchId !== activeBranchId && currentRole === 'ADMIN') {
          // The list only shows the branch selected in the header; switch to the new staff's branch
          // so the admin actually sees the account that was just created.
          setSelectedBranchId(branchId)
          toast.success(`Đã thêm nhân viên vào ${targetBranchName}. Đã chuyển sang chi nhánh này để hiển thị.`)
        } else {
          toast.success(`Đã thêm nhân viên vào ${targetBranchName}`)
        }
      }

      resetStaffForm()
      await loadStaffs()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lưu nhân viên thất bại')
    } finally {
      setSavingStaff(false)
    }
  }

  const setStaffActiveState = async (staff: StaffItem, active: boolean) => {
    if (!canManageTargetStaff(staff)) {
      toast.error('Bạn không có quyền thao tác tài khoản này')
      return
    }
    const actionLabel = active ? 'kích hoạt lại' : 'vô hiệu hóa'
    if (!window.confirm(`Xác nhận ${actionLabel} nhân viên ${staff.name}?`)) return
    try {
      if (active) {
        await api.patch(`/staff/${staff.id}/reactivate`)
      } else {
        await api.delete(`/staff/${staff.id}`, { params: { permanent: false } })
      }
      toast.success(`Đã ${actionLabel} nhân viên`)
      if (editingStaffId === staff.id) {
        resetStaffForm()
      }
      await loadStaffs()
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Không thể ${actionLabel} nhân viên`)
    }
  }

  const resetStaffPassword = async (staff: StaffItem) => {
    if (!canManageTargetStaff(staff)) {
      toast.error('Bạn không có quyền đặt lại mật khẩu tài khoản này')
      return
    }
    const custom = window.prompt('Nhập mật khẩu mới (để trống để tự sinh):', '')
    try {
      const payload = custom && custom.trim() ? { newPassword: custom.trim() } : {}
      const { data } = await api.post(`/staff/${staff.id}/reset-password`, payload)
      toast.success(String(data?.message || 'Đã đặt lại mật khẩu'))
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Đặt lại mật khẩu thất bại')
    }
  }

  const canManageTargetRole = (role: StaffRole) => {
    if (!canManageAccounts) return false
    if (canManagePrivilegedAccounts) return true
    return role === 'WAITER' || role === 'BARISTA'
  }

  const canManageTargetStaff = (staff: StaffItem) => canManageTargetRole(staff.role)
  const assignableRoles = useMemo<StaffRole[]>(
    () => (canManagePrivilegedAccounts
      ? ['ADMIN', 'MANAGER', 'WAITER', 'BARISTA', 'STAFF']
      : ['WAITER', 'BARISTA']),
    [canManagePrivilegedAccounts],
  )

  useEffect(() => {
    if (assignableRoles.includes(staffForm.role)) return
    setStaffForm((prev) => ({ ...prev, role: assignableRoles[0] }))
  }, [assignableRoles, staffForm.role])

  const printStaffCard = (staff: StaffItem) => {
    const qrImage = staffQrImages[staff.id]
    if (!qrImage) {
      toast.error('Chưa tạo được mã QR cho nhân viên này')
      return
    }

    const popup = window.open('', '_blank', 'width=420,height=640')
    if (!popup) {
      toast.error('Không mở được cửa sổ in thẻ')
      return
    }

    popup.document.write(`
      <html>
        <head>
          <title>Thẻ nhân viên - ${staff.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; }
            .card { background: #fff; border-radius: 16px; border: 1px solid #ddd; padding: 20px; width: 320px; }
            .meta { font-size: 13px; color: #555; margin-top: 8px; }
            .name { font-size: 20px; font-weight: 700; margin: 0; }
            .qr { margin-top: 16px; width: 220px; height: 220px; border: 1px solid #e5e5e5; border-radius: 12px; }
            .id { margin-top: 12px; font-size: 12px; color: #666; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <p class="name">${staff.name}</p>
            <div class="meta">Mã NV: ${staff.employeeCode || '-'}</div>
            <div class="meta">Vai trò: ${vaiTroNhanVien(staff.role)}</div>
            <div class="meta">Chi nhánh: ${staff.branchName || staff.branchId || '-'}</div>
            <img class="qr" src="${qrImage}" alt="QR ${staff.personalQrCode || ''}" />
            <div class="meta">Mã QR: ${staff.personalQrCode || '-'}</div>
            <div class="id">ID: ${staff.id}</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `)
    popup.document.close()
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Nhân sự</h1>

      <Card title="Quản lý nhân sự" subtitle="Thêm, sửa và quản lý tài khoản nhân viên của chi nhánh">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={softPanelClass}>
            <p className="text-xs font-semibold uppercase text-slate-500">Tổng nhân sự</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{staffs.length}</p>
          </div>
          <div className={softPanelClass}>
            <p className="text-xs font-semibold uppercase text-slate-500">Đang làm</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{activeStaffs.length}</p>
          </div>
          <div className={softPanelClass}>
            <p className="text-xs font-semibold uppercase text-slate-500">Vô hiệu hóa</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{inactiveStaffCount}</p>
          </div>
          <div className={softPanelClass}>
            <p className="text-xs font-semibold uppercase text-slate-500">Phân role</p>
            <p className="mt-1 text-sm text-slate-700">
              M:{roleBreakdown.MANAGER} W:{roleBreakdown.WAITER} B:{roleBreakdown.BARISTA} S:{roleBreakdown.STAFF}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="Tìm theo tên/email/mã NV"
            value={staffKeyword}
            onChange={(e) => setStaffKeyword(e.target.value)}
          />
          <select
            className={selectClass}
            value={staffRoleFilter}
            onChange={(e) => setStaffRoleFilter(e.target.value as 'ALL' | StaffRole)}
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="ADMIN">Quản lý chung</option>
            <option value="MANAGER">Quản lý</option>
            <option value="WAITER">Phục vụ</option>
            <option value="BARISTA">Pha chế</option>
            <option value="STAFF">Nhân viên</option>
          </select>
          <select
            className={selectClass}
            value={staffBranchFilter}
            onChange={(e) => setStaffBranchFilter(e.target.value)}
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
                {!branch.isActive ? ' (Ngừng hoạt động)' : ''}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-100 bg-white/90 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Hiện cả nhân viên đã vô hiệu hóa
          </label>
          <Button variant="secondary" onClick={resetStaffForm}>
            {editingStaffId ? 'Hủy sửa' : 'Làm mới form'}
          </Button>
          <Button variant="secondary" onClick={exportStaffCsv}>
            Xuất CSV
          </Button>
        </div>

        {canManageAccounts ? (
          <form onSubmit={submitStaffForm} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              required
              placeholder="Họ tên"
              value={staffForm.name}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            {/* autoComplete prevents the browser from filling in the logged-in manager's own credentials */}
            <Input
              required
              type="email"
              name="new-staff-email"
              autoComplete="off"
              placeholder="Email"
              value={staffForm.email}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              type="password"
              name="new-staff-password"
              autoComplete="new-password"
              placeholder={editingStaffId ? 'Đổi mật khẩu (tùy chọn)' : 'Mật khẩu đăng nhập (để trống: tự sinh)'}
              value={staffForm.password}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <Input
              placeholder="Số điện thoại"
              value={staffForm.phone}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <select
              className={selectClass}
              value={staffForm.role}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, role: e.target.value as StaffRole }))}
              disabled={Boolean(editingStaffId) && currentRole === 'MANAGER'}
            >
              {assignableRoles.includes('ADMIN') && <option value="ADMIN">Quản lý chung</option>}
              {assignableRoles.includes('MANAGER') && <option value="MANAGER">Quản lý</option>}
              {assignableRoles.includes('WAITER') && <option value="WAITER">Phục vụ</option>}
              {assignableRoles.includes('BARISTA') && <option value="BARISTA">Pha chế</option>}
              {assignableRoles.includes('STAFF') && <option value="STAFF">Nhân viên</option>}
            </select>
            <select
              className={selectClass}
              value={staffForm.preferredShift}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, preferredShift: e.target.value as ShiftType }))}
            >
              <option value="MORNING">Ca sáng</option>
              <option value="AFTERNOON">Ca chiều</option>
              <option value="EVENING">Ca tối</option>
            </select>
            <Input
              placeholder="Mã nhân viên (để trống tự sinh)"
              value={staffForm.employeeCode}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, employeeCode: e.target.value }))}
              disabled={Boolean(editingStaffId) && currentRole === 'MANAGER'}
            />
            {editingStaffId ? (
              <Input
                placeholder="Mã QR cá nhân (để trống tự sinh lại)"
                value={staffForm.personalQrCode}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, personalQrCode: e.target.value }))}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-amber-200 px-3 py-2 text-sm text-slate-600">
                Mã QR cá nhân sẽ được hệ thống tự sinh sau khi tạo nhân viên
              </div>
            )}
            <select
              className={selectClass}
              value={staffForm.branchId}
              onChange={(e) => setStaffForm((prev) => ({ ...prev, branchId: e.target.value }))}
              disabled={currentRole === 'MANAGER'}
            >
              <option value="">-- Chọn chi nhánh --</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {!branch.isActive ? ' (Ngừng hoạt động)' : ''}
                </option>
              ))}
            </select>
            {editingStaffId ? (
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-100 bg-white/90 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={staffForm.isActive}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Tài khoản đang hoạt động
              </label>
            ) : (
              <div />
            )}
            <Button type="submit" loading={savingStaff}>
              {editingStaffId ? 'Cập nhật nhân viên' : 'Thêm nhân viên'}
            </Button>
            <div className="md:col-span-3">
              {checkingExists && !editingStaffId && (
                <p className="text-xs text-slate-500">Đang kiểm tra email/mã nhân viên...</p>
              )}
              {!editingStaffId && emailExists === true && (
                <p className="text-xs text-rose-600">Email đã tồn tại trong hệ thống.</p>
              )}
              {!editingStaffId && emailExists === false && staffForm.email.trim() && (
                <p className="text-xs text-emerald-600">Email khả dụng.</p>
              )}
              {!editingStaffId && employeeCodeExists === true && staffForm.employeeCode.trim() && (
                <p className="text-xs text-rose-600">Mã nhân viên đã tồn tại trong chi nhánh.</p>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-100 bg-white/90 px-4 py-3 text-sm text-slate-600">
            Bạn đang ở chế độ chỉ xem. Hệ thống sẽ ẩn bớt thông tin nhạy cảm và khóa toàn bộ thao tác thêm, sửa, xóa tài khoản.
          </div>
        )}

        <div className="mt-4 space-y-3 md:hidden">
          {loadingStaff && <TableSkeleton cols={2} rows={5} />}
          {!loadingStaff &&
            staffs.map((staff) => (
              <div key={`mobile-${staff.id}`} className="rounded-xl border border-amber-100 bg-white/90 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{staff.name}</p>
                    <p className="text-xs text-slate-500">{staff.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass[staff.role] || roleBadgeClass.STAFF}`}>{vaiTroNhanVien(staff.role)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <p>Chi nhánh: <span className="font-medium">{staff.branchName || staff.branchId || '-'}</span></p>
                  <p>Mã NV: <span className="font-medium">{staff.employeeCode || '-'}</span></p>
                  <p>Ca: <span className="font-medium">{caLamViec(staff.preferredShift)}</span></p>
                  <p>Trạng thái: <span className="font-medium">{trangThaiHoatDong(staff.isActive)}</span></p>
                </div>
                <div className="mt-2 flex gap-2">
                  {canManageTargetStaff(staff) ? (
                    <>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => startEditStaff(staff)}>
                        Sửa
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => resetStaffPassword(staff)}>
                        Reset MK
                      </Button>
                      <Button
                        size="sm"
                        variant={staff.isActive ? 'danger' : 'secondary'}
                        className="flex-1"
                        onClick={() => setStaffActiveState(staff, !staff.isActive)}
                      >
                        {staff.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Chỉ xem</span>
                  )}
                </div>
              </div>
            ))}
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          {loadingStaff && <TableSkeleton cols={9} rows={5} />}
          {!loadingStaff && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Tên</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Vai trò</th>
                  <th className="py-2 pr-3">Chi nhánh</th>
                  <th className="py-2 pr-3">Mã NV</th>
                  <th className="py-2 pr-3">Mã QR cá nhân</th>
                  <th className="py-2 pr-3">Ca mặc định</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {staffs.map((staff) => (
                  <tr key={staff.id} className="border-b">
                    <td className="py-2 pr-3">{staff.name}</td>
                    <td className="py-2 pr-3">{staff.email}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass[staff.role] || roleBadgeClass.STAFF}`}>
                        {vaiTroNhanVien(staff.role)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{staff.branchName || staff.branchId || '-'}</td>
                    <td className="py-2 pr-3">{staff.employeeCode || '-'}</td>
                    <td className="py-2 pr-3">{staff.personalQrCode || '-'}</td>
                    <td className="py-2 pr-3">{caLamViec(staff.preferredShift)}</td>
                    <td className="py-2 pr-3">{trangThaiHoatDong(staff.isActive)}</td>
                    <td className="py-2">
                      {canManageTargetStaff(staff) ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditStaff(staff)}>
                            Sửa
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => resetStaffPassword(staff)}>
                            Reset MK
                          </Button>
                          <Button
                            size="sm"
                            variant={staff.isActive ? 'danger' : 'secondary'}
                            onClick={() => setStaffActiveState(staff, !staff.isActive)}
                          >
                            {staff.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                ))}
                {staffs.length === 0 && (
                  <tr>
                    <td className="py-3 text-sm text-gray-500" colSpan={9}>
                      Chưa có nhân sự khớp bộ lọc hiện tại
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {canManageAccounts && (
          <div className="mt-6">
            <h2 className="text-base font-semibold text-slate-900">Thẻ nhân viên (ID + QR cá nhân)</h2>
            <p className="mt-1 text-sm text-slate-600">In thẻ cho nhân viên để quét QR vào ca/ra ca nhanh hơn.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {staffs.map((staff) => (
                <div key={`card-${staff.id}`} className="rounded-xl border border-amber-100 bg-white/90 p-4 shadow-sm">
                  <p className="text-base font-semibold text-slate-900">{staff.name}</p>
                  <p className="mt-1 text-sm text-slate-600">Mã NV: {staff.employeeCode || '-'}</p>
                  <p className="text-sm text-slate-600">Vai trò: <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass[staff.role] || roleBadgeClass.STAFF}`}>{vaiTroNhanVien(staff.role)}</span></p>
                  <p className="text-sm text-slate-600">Chi nhánh: {staff.branchName || staff.branchId || '-'}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">ID: {staff.id}</p>
                  <div className="mt-3 flex justify-center rounded-lg border border-amber-100 bg-amber-50/40 p-2">
                    {staffQrImages[staff.id] ? (
                      <img
                        src={staffQrImages[staff.id]}
                        alt={`QR ${staff.personalQrCode || ''}`}
                        className="h-40 w-40 rounded-md border bg-white p-1"
                      />
                    ) : (
                      <span className="py-14 text-xs text-gray-500">Chưa có mã QR</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 break-all">Mã QR: {staff.personalQrCode || '-'}</p>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!staffQrImages[staff.id]}
                      onClick={() => printStaffCard(staff)}
                    >
                      In thẻ nhân viên
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
