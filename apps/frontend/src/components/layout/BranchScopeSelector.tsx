import { useEffect, useMemo, useState } from 'react'
import api from '@/utils/api'
import { normalizeRole } from '@/utils/rbac'
import { useAuthStore } from '@/stores/authStore'
import { useBranchScopeStore } from '@/stores/branchScopeStore'
import { useBranchName } from '@/hooks/useBranchName'

type BranchItem = {
  id: string
  name: string
  isActive?: boolean
}

export default function BranchScopeSelector() {
  const user = useAuthStore((state) => state.user)
  const role = normalizeRole(user?.role)
  const selectedBranchId = useBranchScopeStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useBranchScopeStore((state) => state.setSelectedBranchId)
  const [branches, setBranches] = useState<BranchItem[]>([])

  const isAdminVisible = role === 'ADMIN'
  // Every other staff role (manager, waiter, barista, staff) sees its own branch as a fixed label.
  const isScopedVisible = !!role && !isAdminVisible
  const ownBranchName = useBranchName(isScopedVisible ? user?.branchId : null)

  useEffect(() => {
    if (!isAdminVisible) return
    let cancelled = false

    const run = async () => {
      try {
        const { data } = await api.get('/branches', { params: { includeInactive: false } })
        if (cancelled) return
        const list = Array.isArray(data) ? (data as BranchItem[]) : []
        setBranches(list)
      } catch {
        if (!cancelled) {
          setBranches([])
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [isAdminVisible])

  useEffect(() => {
    if (!isAdminVisible) return
    if (selectedBranchId) return
    if (user?.branchId) {
      setSelectedBranchId(user.branchId)
    }
  }, [isAdminVisible, selectedBranchId, setSelectedBranchId, user?.branchId])

  // Every non-admin role is locked to its own branch. The selection is persisted in
  // localStorage, so without this a stale branch from a previous (e.g. admin) session
  // would be sent to the API and rejected with FORBIDDEN_BRANCH_SCOPE (403).
  useEffect(() => {
    if (!user || isAdminVisible) return
    const ownBranchId = String(user.branchId || '').trim()
    if (selectedBranchId === ownBranchId) return
    setSelectedBranchId(ownBranchId)
  }, [user, isAdminVisible, selectedBranchId, setSelectedBranchId])

  const activeOptions = useMemo(
    () => branches.filter((item) => item.isActive !== false),
    [branches],
  )

  if (isScopedVisible) {
    const branchLabel = ownBranchName || (user?.branchId ? 'Đang tải...' : 'Chưa gán chi nhánh')
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-white/85 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 md:flex">
        <span className="font-medium">Chi nhánh</span>
        <span className="rounded-lg border border-amber-100 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {branchLabel}
        </span>
      </div>
    )
  }

  if (!isAdminVisible) return null

  return (
    <label className="hidden items-center gap-2 rounded-xl border border-amber-100 bg-white/85 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 md:flex">
      <span className="font-medium">Chi nhánh</span>
      <select
        className="rounded-lg border border-amber-100 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
      >
        <option value="">Tất cả</option>
        {activeOptions.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  )
}

