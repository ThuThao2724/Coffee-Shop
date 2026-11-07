import { useEffect, useState } from 'react'
import api from '@/utils/api'

// Shared across components so the header and pages don't each refetch the same branch.
const nameCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

function fetchBranchName(branchId: string): Promise<string> {
  const cached = nameCache.get(branchId)
  if (cached !== undefined) return Promise.resolve(cached)
  const pending = inflight.get(branchId)
  if (pending) return pending

  const request = api
    .get(`/branches/${encodeURIComponent(branchId)}`)
    .then(({ data }) => {
      const name = String(data?.name || '').trim()
      nameCache.set(branchId, name)
      return name
    })
    .catch(() => '')
    .finally(() => inflight.delete(branchId))
  inflight.set(branchId, request)
  return request
}

/** Returns the display name of a branch ('' while loading or if it cannot be read). */
export function useBranchName(branchId?: string | null): string {
  const id = String(branchId || '').trim()
  const [name, setName] = useState(() => (id ? nameCache.get(id) || '' : ''))

  useEffect(() => {
    if (!id) {
      setName('')
      return
    }
    let cancelled = false
    setName(nameCache.get(id) || '')
    fetchBranchName(id).then((value) => {
      if (!cancelled) setName(value)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  return name
}
