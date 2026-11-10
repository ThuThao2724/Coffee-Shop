import type { CSSProperties } from 'react'
import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export default function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-200/80 dark:bg-slate-700/80', className)} style={style} />
}
