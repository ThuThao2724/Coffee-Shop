import ForecastDayDetail from '../components/ForecastDayDetail'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import api from '@/utils/api'
import { RoutePageSkeleton } from '@/components/ui/PageSkeleton'
import { useI18n } from '@/utils/i18n'
import { phuongThucThanhToan, trangThaiThanhToan, vaiTroNhanVien } from '@/utils/display'
import { useBranchScopeStore } from '@/stores/branchScopeStore'
import { useAuthStore } from '@/stores/authStore'

type TimeGroup = 'day' | 'week' | 'month' | 'year'
type ExportType = 'revenue' | 'top-items' | 'inventory' | 'staff-performance' | 'dashboard'
type ExportFormat = 'excel' | 'pdf'

interface RevenueSeriesItem {
  period: string
  revenue: number
  orderCount: number
}

interface TopItem {
  menuItemId: string
  menuItemName: string
  quantity: number
  revenue: number
  orderCount: number
}

interface StaffPerformanceItem {
  staffId: string
  staffName: string
  role: string | null
  orderCount: number
  revenue: number
}

interface InventoryStockItem {
  id: string
  name: string
  unit: string
  stock: number
  minStock: number
  isLowStock: boolean
  stockValue: number
}

interface InventoryReportResponse {
  summary: {
    totalIngredients: number
    activeIngredients: number
    lowStockCount: number
    totalStockValue: number
  }
  stocks: InventoryStockItem[]
  analytics?: {
    movementTrend: Array<{ day: string; importQty: number; exportQty: number; adjustQty: number }>
    movementTypeBreakdown: Array<{ type: string; source: string; count: number; quantity: number }>
    topConsumption: Array<{ ingredientId: string; ingredientName: string; quantity: number }>
    stockRiskBands: { critical: number; low: number; healthy: number }
  }
}

interface DashboardResponse {
  updatedAt: string
  revenue: {
    totalRevenue: number
    totalOrders: number
    series: RevenueSeriesItem[]
  }
  orders: {
    todayByStatus: Array<{ status: string; count: number }>
    hourly: Array<{ timestamp: string; orders: number; revenue: number }>
  }
  payments: {
    summary: {
      totalTransactions: number
      paidTransactions: number
      pendingTransactions: number
      failedTransactions: number
      totalRevenue: number
      averagePaidValue: number
    }
    byProvider: Array<{ provider: string; count: number; paidCount: number; revenue: number }>
    byStatus: Array<{ status: string; count: number; amount: number }>
  }
  inventory: {
    summary: {
      totalIngredients: number
      activeIngredients: number
      lowStockCount: number
      totalStockValue: number
    }
    lowStockItems: InventoryStockItem[]
  }
  topItems: TopItem[]
  staffPerformance: StaffPerformanceItem[]
}

interface AiRevenueForecast {
  date: string
  predictedRevenue: number
  confidenceLow: number
  confidenceHigh: number
}

interface AiInsightState {
  available: boolean
  forecasts: AiRevenueForecast[]
  anomalies: Array<{ id: string; severity: string; description: string; isResolved: boolean }>
  forecastSource?: string
  fallbackReason?: string
}

interface ReportChatResponse {
  answer: string
  sql?: string | null
  executionTimeMs: number
  intent: string
  isSuccessful: boolean
  rowCount: number
  sampleRows?: Array<Record<string, unknown>>
}

interface QualityCheckItem {
  name: string
  ok: boolean
  detail?: unknown
}

interface QualitySummaryResponse {
  timestamp: string
  branchId?: string | null
  quality: {
    status: 'ok' | 'degraded'
    source: string
    checks: QualityCheckItem[]
  }
  modelQuality?: {
    sentiment?: {
      geminiEnabled?: boolean
      ratios?: { geminiSuccessRatio: number; geminiErrorRatio: number; fallbackRatio: number }
      avgConfidence?: { gemini: number; fallback: number }
    }
  }
  fallbackRatios: Record<
    string,
    {
      totalResponses: number
      fallbackResponses: number
      fallbackRatio: number
      sources: Record<string, number>
    }
  >
  attention: {
    highFallbackEndpoints: Record<
      string,
      {
        totalResponses: number
        fallbackResponses: number
        fallbackRatio: number
        sources: Record<string, number>
      }
    >
    count: number
  }
}

interface FallbackTrendPoint {
  endpoint: string
  timestamp: string
  totalResponses: number
  fallbackResponses: number
  fallbackRatio: number
}

interface FallbackTrendSummaryItem {
  endpoint: string
  samples: number
  totalResponses: number
  fallbackResponses: number
  avgFallbackRatio: number
  maxFallbackRatio: number
  latestFallbackRatio: number
  trend: 'up' | 'down' | 'flat'
  deltaRatio: number
  highFallback: boolean
  riskScore: number
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

interface RecommendAbSummary {
  groups: Record<string, { shown: number; click: number; add_to_cart: number; purchase: number; ctr: number; addToCartRate: number; purchaseRate: number }>
  uplift: { ctr: number; addToCartRate: number; purchaseRate: number }
  events: number
  significance?: {
    minSamplePerGroup: number
    sampleSize: { treatment: number; control: number }
    sampleReady: boolean
    confidence: { ctr: number; addToCartRate: number; purchaseRate: number }
    pValue: { ctr: number; addToCartRate: number; purchaseRate: number }
    confidenceReady: boolean
    decisionReady: boolean
  }
}

interface RealtimeTelemetry {
  subscribers: number
  peakSubscribers: number
  emitted: number
  connections: number
  disconnects: number
  subscriberDrops: number
  disconnectRate: number
  lag: { samples: number; p95Ms: number }
  alerts: { p95LagHigh: boolean; subscriberDropHigh: boolean; disconnectRateHigh: boolean }
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, value || 0))}đ`
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatPeriodLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('vi-VN')
}

function formatHourLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getHours().toString().padStart(2, '0')}:00`
}

const selectClass =
  'min-h-11 w-full rounded-xl border border-amber-100/80 bg-white/95 px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/60 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-amber-400 dark:focus:ring-amber-500/30'

export default function Reports() {
  const { tv } = useI18n()
  const selectedBranchId = useBranchScopeStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useBranchScopeStore((state) => state.setSelectedBranchId)
  const currentUserBranchId = useAuthStore((state) => String(state.user?.branchId || '').trim())
  const now = new Date()
  const oneMonthAgo = new Date()
  oneMonthAgo.setDate(now.getDate() - 30)

  const [dateFrom, setDateFrom] = useState(formatDateInput(oneMonthAgo))
  const [dateTo, setDateTo] = useState(formatDateInput(now))
  const [groupBy, setGroupBy] = useState<TimeGroup>('day')
  const [loading, setLoading] = useState(false)

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [revenueSeries, setRevenueSeries] = useState<RevenueSeriesItem[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [inventory, setInventory] = useState<InventoryReportResponse | null>(null)
  const [staffItems, setStaffItems] = useState<StaffPerformanceItem[]>([])
  const [aiInsight, setAiInsight] = useState<AiInsightState>({
    available: false,
    forecasts: [],
    anomalies: [],
  })
  const [rebuildingForecast, setRebuildingForecast] = useState(false)
  const [testingAnomaly, setTestingAnomaly] = useState(false)
  const [reportChatQuestion, setReportChatQuestion] = useState('')
  const [reportChatLoading, setReportChatLoading] = useState(false)
  const [reportChatResult, setReportChatResult] = useState<ReportChatResponse | null>(null)
  const [qualitySummary, setQualitySummary] = useState<QualitySummaryResponse | null>(null)
  const [fallbackTrendPoints, setFallbackTrendPoints] = useState<FallbackTrendPoint[]>([])
  const [fallbackTrendSummary, setFallbackTrendSummary] = useState<FallbackTrendSummaryItem[]>([])
  const [fallbackTrendWindowMinutes, setFallbackTrendWindowMinutes] = useState(120)
  const [showOnlyHighFallback, setShowOnlyHighFallback] = useState(false)
  const [recommendAbSummary, setRecommendAbSummary] = useState<RecommendAbSummary | null>(null)
  const [realtimeLagMs, setRealtimeLagMs] = useState<number>(0)
  const [realtimeTelemetry, setRealtimeTelemetry] = useState<RealtimeTelemetry | null>(null)

  const [exportType, setExportType] = useState<ExportType>('revenue')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel')
  const effectiveAiBranchId = selectedBranchId || currentUserBranchId || 'branch-e2e'
  const currentUserRole = String(useAuthStore((state) => state.user?.role || '')).toUpperCase()

  const requestAiWithRetry = async (path: string, params: Record<string, any>) => {
    try {
      return await api.get(path, { params, timeout: 1800 })
    } catch (error: any) {
      const status = Number(error?.response?.status || 0)
      const timeout = error?.code === 'ECONNABORTED'
      const retryable = timeout || status >= 500 || status === 0
      if (!retryable) throw error
      return api.get(path, { params, timeout: 1800 })
    }
  }

  const loadReports = async () => {
    setLoading(true)
    try {
      const [dashboardRes, revenueRes, topRes, inventoryRes, staffRes, realtimeMetricsRes] = await Promise.all([
        api.get('/reports/dashboard', {
          params: { dateFrom, dateTo, groupBy, branchId: selectedBranchId || undefined },
        }),
        api.get('/reports/revenue', {
          params: { dateFrom, dateTo, groupBy, branchId: selectedBranchId || undefined },
        }),
        api.get('/reports/top-items', {
          params: { dateFrom, dateTo, branchId: selectedBranchId || undefined, limit: 10 },
        }),
        api.get('/reports/inventory', {
          params: { dateFrom, dateTo, branchId: selectedBranchId || undefined, includeMovements: false },
        }),
        api.get('/reports/staff-performance', {
          params: { dateFrom, dateTo, branchId: selectedBranchId || undefined, limit: 10 },
        }),
        api.get('/reports/realtime/metrics'),
      ])

      setDashboard((dashboardRes.data || null) as DashboardResponse | null)
      setRevenueSeries(Array.isArray(revenueRes.data?.series) ? (revenueRes.data.series as RevenueSeriesItem[]) : [])
      setTopItems(Array.isArray(topRes.data) ? (topRes.data as TopItem[]) : [])
      setInventory((inventoryRes.data || null) as InventoryReportResponse | null)
      setStaffItems(Array.isArray(staffRes.data?.items) ? (staffRes.data.items as StaffPerformanceItem[]) : [])
      setRealtimeTelemetry((realtimeMetricsRes.data || null) as RealtimeTelemetry | null)

      try {
        const [forecastResult, anomalyResult, qualitySummaryResult, fallbackTrendResult, fallbackSummaryResult] = await Promise.allSettled([
          requestAiWithRetry('/ai/forecast/revenue', { branchId: effectiveAiBranchId, days: 7 }),
          requestAiWithRetry('/ai/anomalies', { branchId: effectiveAiBranchId }),
          requestAiWithRetry('/ai/ops/quality-summary', { branchId: effectiveAiBranchId }),
          requestAiWithRetry('/ai/ops/fallback-trend', { branchId: effectiveAiBranchId, windowMinutes: fallbackTrendWindowMinutes }),
          requestAiWithRetry('/ai/ops/fallback-trend-summary', { branchId: effectiveAiBranchId, windowMinutes: fallbackTrendWindowMinutes, threshold: 0.2 }),
        ])

        const forecastData = forecastResult.status === 'fulfilled' ? forecastResult.value.data : null
        const anomalyData = anomalyResult.status === 'fulfilled' ? anomalyResult.value.data : null
        const qualityData = qualitySummaryResult.status === 'fulfilled' ? qualitySummaryResult.value.data : null
        const fallbackTrendData = fallbackTrendResult.status === 'fulfilled' ? fallbackTrendResult.value.data : null
        const fallbackSummaryData = fallbackSummaryResult.status === 'fulfilled' ? fallbackSummaryResult.value.data : null
        const aiAvailable = Boolean(forecastData || anomalyData)
        const reasons = [forecastResult, anomalyResult]
          .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
          .map((item) => item.reason?.response?.data?.message || item.reason?.message || 'request_failed')

        setAiInsight({
          available: aiAvailable,
          forecasts: Array.isArray(forecastData?.forecasts) ? (forecastData.forecasts as AiRevenueForecast[]) : [],
          anomalies: Array.isArray(anomalyData?.items) ? anomalyData.items : [],
          forecastSource: String(forecastData?.source || ''),
          fallbackReason: reasons.length ? reasons.join('; ') : undefined,
        })
        setQualitySummary((qualityData || null) as QualitySummaryResponse | null)
        setFallbackTrendPoints(Array.isArray(fallbackTrendData?.points) ? (fallbackTrendData.points as FallbackTrendPoint[]) : [])
        setFallbackTrendSummary(
          Array.isArray(fallbackSummaryData?.items) ? (fallbackSummaryData.items as FallbackTrendSummaryItem[]) : [],
        )
        setRecommendAbSummary(null)
      } catch (aiError: any) {
        setAiInsight({
          available: false,
          forecasts: [],
          anomalies: [],
          forecastSource: '',
          fallbackReason: aiError?.response?.data?.message || 'AI service unavailable',
        })
        setQualitySummary(null)
        setFallbackTrendPoints([])
        setFallbackTrendSummary([])
        setRecommendAbSummary(null)
      }
    } catch (error: any) {
      setRealtimeTelemetry(null)
      toast.error(error.response?.data?.message || tv('Không tải được dữ liệu báo cáo', 'Unable to load report data'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [dateFrom, dateTo, groupBy, selectedBranchId, fallbackTrendWindowMinutes])

  useEffect(() => {
    const token = useAuthStore.getState().token
    if (!token) return
    const params = new URLSearchParams()
    if (selectedBranchId) params.set('branchId', selectedBranchId)
    params.set('access_token', token)
    const es = new EventSource(`/api/reports/realtime/stream?${params.toString()}`, {
      withCredentials: false,
    } as EventSourceInit)
    let lastReloadAt = 0
    let lastLagPostAt = 0
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const emittedAt = String(payload?.emittedAt || '')
        if (emittedAt) {
          const lag = Date.now() - new Date(emittedAt).getTime()
          const normalizedLag = Number.isFinite(lag) ? Math.max(0, lag) : 0
          setRealtimeLagMs(normalizedLag)
          const now = Date.now()
          if (now - lastLagPostAt >= 15000) {
            lastLagPostAt = now
            void api.post('/reports/realtime/lag-sample', { lagMs: normalizedLag }).catch(() => undefined)
          }
        }
      } catch {
        // ignore payload parse errors
      }
      const now = Date.now()
      if (now - lastReloadAt >= 8000) {
        lastReloadAt = now
        void loadReports()
      }
    }
    return () => {
      es.close()
    }
  }, [selectedBranchId])

  const revenueChartData = useMemo(
    () =>
      revenueSeries.map((item) => ({
        period: formatPeriodLabel(item.period),
        revenue: item.revenue,
        orders: item.orderCount,
      })),
    [revenueSeries],
  )

  const orderHourlyChartData = useMemo(
    () =>
      (dashboard?.orders.hourly || []).map((item) => ({
        hour: formatHourLabel(item.timestamp),
        orders: item.orders,
        revenue: item.revenue,
      })),
    [dashboard?.orders.hourly],
  )

  const paymentProviderChartData = useMemo(
    () =>
      (dashboard?.payments.byProvider || []).map((item) => ({
        provider: phuongThucThanhToan(item.provider),
        revenue: item.revenue,
        paidCount: item.paidCount,
      })),
    [dashboard?.payments.byProvider],
  )

  const paymentStatusChartData = useMemo(
    () =>
      (dashboard?.payments.byStatus || []).map((item) => ({
        status: trangThaiThanhToan(item.status),
        count: item.count,
        amount: item.amount,
      })),
    [dashboard?.payments.byStatus],
  )

  const inventoryTrendChartData = useMemo(
    () =>
      (inventory?.analytics?.movementTrend || []).map((item) => ({
        day: formatPeriodLabel(item.day),
        importQty: item.importQty,
        exportQty: item.exportQty,
        adjustQty: item.adjustQty,
      })),
    [inventory?.analytics?.movementTrend],
  )

  const inventoryRiskChartData = useMemo(() => {
    const bands = inventory?.analytics?.stockRiskBands
    if (!bands) return []
    return [
      { label: 'Critical', count: Number(bands.critical || 0) },
      { label: 'Low', count: Number(bands.low || 0) },
      { label: 'Healthy', count: Number(bands.healthy || 0) },
    ]
  }, [inventory?.analytics?.stockRiskBands])

  const noBusinessDataForSelectedBranch = useMemo(() => {
    if (!selectedBranchId || !dashboard) return false

    const noRevenue = Number(dashboard.revenue?.totalRevenue || 0) <= 0
    const noOrders = Number(dashboard.revenue?.totalOrders || 0) <= 0
    const noTransactions = Number(dashboard.payments?.summary?.totalTransactions || 0) <= 0
    const noTopItems = (topItems || []).length === 0
    const noStaffStats = (staffItems || []).length === 0

    return noRevenue && noOrders && noTransactions && noTopItems && noStaffStats
  }, [dashboard, selectedBranchId, staffItems, topItems])

  const forecastTotal = useMemo(
    () => aiInsight.forecasts.reduce((acc, item) => acc + Number(item.predictedRevenue || 0), 0),
    [aiInsight.forecasts],
  )

  const forecastAverage = useMemo(
    () => (aiInsight.forecasts.length ? Math.round(forecastTotal / aiInsight.forecasts.length) : 0),
    [aiInsight.forecasts.length, forecastTotal],
  )

  const forecastConfidenceRange = useMemo(() => {
    if (!aiInsight.forecasts.length) return { low: 0, high: 0 }
    return aiInsight.forecasts.reduce(
      (acc, item) => ({
        low: acc.low + Number(item.confidenceLow || 0),
        high: acc.high + Number(item.confidenceHigh || 0),
      }),
      { low: 0, high: 0 },
    )
  }, [aiInsight.forecasts])

  const revenueForecastChartData = useMemo(
    () =>
      aiInsight.forecasts.map((item) => ({
        date: String(item.date).slice(0, 10),
        forecast: Number(item.predictedRevenue || 0),
        low: Number(item.confidenceLow || 0),
        high: Number(item.confidenceHigh || 0),
      })),
    [aiInsight.forecasts],
  )

  const fallbackRows = useMemo(() => {
    if (!qualitySummary) return []
    const entries = Object.entries(qualitySummary.fallbackRatios || {})
    const baseRows = entries.map(([endpoint, row]) => ({
      endpoint,
      totalResponses: Number(row.totalResponses || 0),
      fallbackResponses: Number(row.fallbackResponses || 0),
      fallbackRatio: Number(row.fallbackRatio || 0),
    }))
    if (!showOnlyHighFallback) return baseRows
    return baseRows.filter((item) => item.fallbackRatio >= 0.2)
  }, [qualitySummary, showOnlyHighFallback])

  const fallbackTrendChartData = useMemo(() => {
    if (!fallbackTrendPoints.length) return []
    const endpointFilter = new Set(
      showOnlyHighFallback && qualitySummary
        ? Object.keys(qualitySummary.attention?.highFallbackEndpoints || {})
        : [],
    )
    return fallbackTrendPoints
      .filter((point) => (!showOnlyHighFallback ? true : endpointFilter.has(point.endpoint)))
      .map((point) => ({
        time: formatHourLabel(point.timestamp),
        endpoint: point.endpoint,
        fallbackRatioPct: Math.round((Number(point.fallbackRatio || 0) * 100) * 100) / 100,
      }))
  }, [fallbackTrendPoints, showOnlyHighFallback, qualitySummary])

  const selectedFallbackEndpoints = useMemo(() => {
    const allEndpoints = Array.from(new Set(fallbackTrendChartData.map((item) => item.endpoint)))
    return allEndpoints.slice(0, 4)
  }, [fallbackTrendChartData])

  const fallbackTrendPivot = useMemo(() => {
    const byTime = new Map<string, Record<string, number | string>>()
    fallbackTrendChartData.forEach((point) => {
      const row = byTime.get(point.time) || { time: point.time }
      row[point.endpoint] = point.fallbackRatioPct
      byTime.set(point.time, row)
    })
    return Array.from(byTime.values())
  }, [fallbackTrendChartData])

  const fallbackSummaryRows = useMemo(() => {
    const rows = [...fallbackTrendSummary]
    if (!showOnlyHighFallback) return rows
    return rows.filter((item) => item.highFallback)
  }, [fallbackTrendSummary, showOnlyHighFallback])

  const fallbackPriorityRows = useMemo(() => {
    return fallbackSummaryRows
      .filter((item) => item.priority === 'CRITICAL' || item.priority === 'HIGH')
      .slice(0, 5)
  }, [fallbackSummaryRows])

  const handleExport = async () => {
    try {
      const response = await api.get('/reports/export', {
        params: {
          reportType: exportType,
          format: exportFormat,
          dateFrom,
          dateTo,
          groupBy,
          branchId: selectedBranchId || undefined,
          limit: 20,
        },
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const contentDisposition = String(response.headers['content-disposition'] || '')
      const match = /filename="([^"]+)"/.exec(contentDisposition)
      link.href = url
      link.download = match?.[1] || `${exportType}.${exportFormat === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(tv('Đã tải xong báo cáo', 'Report downloaded'))
    } catch (error: any) {
      toast.error(error.response?.data?.message || tv('Xuất báo cáo thất bại', 'Export failed'))
    }
  }

  const handleRebuildForecast = async () => {
    if (!effectiveAiBranchId) {
      toast.error('Thiếu branchId để rebuild forecast')
      return
    }
    setRebuildingForecast(true)
    try {
      await api.post('/ai/forecast/revenue/rebuild', {
        branchId: effectiveAiBranchId,
        days: 7,
        granularity: 'daily',
      })
      toast.success('Đã rebuild forecast, đang tải lại AI insights')
      await loadReports()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Rebuild forecast thất bại')
    } finally {
      setRebuildingForecast(false)
    }
  }

  const handleTestAnomaly = async () => {
    if (!effectiveAiBranchId) {
      toast.error('Thiếu branchId để test anomaly')
      return
    }
    setTestingAnomaly(true)
    try {
      await api.post('/ai/anomalies/detect', {
        branchId: effectiveAiBranchId,
        type: 'ORDER_QTY',
        value: 120,
        baselineMean: 20,
        baselineStd: 10,
        referenceType: 'ORDER',
        referenceId: `test-${Date.now()}`,
      })
      toast.success('Đã tạo anomaly test, đang tải lại AI insights')
      await loadReports()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Tạo anomaly test thất bại')
    } finally {
      setTestingAnomaly(false)
    }
  }

  const handleReportChatSubmit = async () => {
    const question = reportChatQuestion.trim()
    if (!question) {
      toast.error('Vui lòng nhập câu hỏi báo cáo')
      return
    }
    setReportChatLoading(true)
    try {
      const { data } = await api.post('/ai/report-chat', {
        branchId: effectiveAiBranchId,
        userId: String(useAuthStore.getState().user?.id || ''),
        role: currentUserRole || 'MANAGER',
        question,
      })
      setReportChatResult((data || null) as ReportChatResponse | null)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không truy vấn được Report Chat')
    } finally {
      setReportChatLoading(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-amber-100 bg-white/85 p-3 backdrop-blur sm:p-4">
        <h1 className="mr-auto text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Báo cáo và phân tích</h1>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-44" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-44" />
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as TimeGroup)}
          className={`${selectClass} sm:w-44`}
        >
          <option value="day">{tv('Theo ngày', 'By day')}</option>
          <option value="week">{tv('Theo tuần', 'By week')}</option>
          <option value="month">{tv('Theo tháng', 'By month')}</option>
          <option value="year">{tv('Theo năm', 'By year')}</option>
        </select>
        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void loadReports()} loading={loading}>
          {tv('Làm mới', 'Refresh')}
        </Button>
        <p className={`text-xs ${realtimeLagMs > 5000 ? 'text-rose-700' : 'text-emerald-700'}`}>
          Realtime lag: {Math.round(realtimeLagMs)} ms
        </p>
      </div>

      {noBusinessDataForSelectedBranch && (
        <Card className="border border-amber-200 bg-amber-50/80">
          <p className="text-sm font-medium text-amber-800">
            Không có dữ liệu giao dịch cho chi nhánh đang chọn trong khoảng thời gian này.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            BranchId hiện tại: {selectedBranchId}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedBranchId('')}>
              Xem toàn hệ thống
            </Button>
            {currentUserBranchId && currentUserBranchId !== selectedBranchId && (
              <Button size="sm" variant="secondary" onClick={() => setSelectedBranchId(currentUserBranchId)}>
                Về chi nhánh của tôi
              </Button>
            )}
          </div>
        </Card>
      )}

      {loading && !dashboard && <RoutePageSkeleton kind="reports" />}

      {!!dashboard && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="text-center">
          <p className="text-sm text-slate-500">Doanh thu thanh toán</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatMoney(dashboard?.payments.summary.totalRevenue || dashboard?.revenue.totalRevenue || 0)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-slate-500">Giao dịch đã thanh toán</p>
          <p className="text-2xl font-bold text-emerald-600">{dashboard?.payments.summary.paidTransactions || 0}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-slate-500">Giao dịch đang chờ</p>
          <p className="text-2xl font-bold text-amber-600">{dashboard?.payments.summary.pendingTransactions || 0}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-slate-500">Giao dịch lỗi / hủy</p>
          <p className="text-2xl font-bold text-red-600">{dashboard?.payments.summary.failedTransactions || 0}</p>
        </Card>
      </div>}

      <Card title="AI Revenue Intelligence" subtitle={aiInsight.available ? 'Phân tích và dự báo doanh thu bằng AI' : 'Fallback rule-based'}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Branch AI: <span className="font-medium text-slate-700">{effectiveAiBranchId}</span>
            {aiInsight.forecastSource ? ` · Forecast source: ${aiInsight.forecastSource}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void handleRebuildForecast()} loading={rebuildingForecast}>
              Rebuild forecast
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleTestAnomaly()} loading={testingAnomaly}>
              Test anomaly
            </Button>
          </div>
        </div>
        {!aiInsight.available && (
          <p className="text-sm text-amber-700">
            AI tạm thời không khả dụng. Đang fallback về báo cáo truyền thống. {aiInsight.fallbackReason ? `(${aiInsight.fallbackReason})` : ''}
          </p>
        )}
        {aiInsight.available && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3">
                <p className="text-xs text-slate-600">Dự báo 7 ngày</p>
                <p className="text-lg font-semibold text-slate-900">{formatMoney(forecastTotal)}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                <p className="text-xs text-slate-600">Trung bình/ngày</p>
                <p className="text-lg font-semibold text-slate-900">{formatMoney(forecastAverage)}</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                <p className="text-xs text-slate-600">Khoảng tin cậy</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatMoney(forecastConfidenceRange.low)} - {formatMoney(forecastConfidenceRange.high)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <p className="text-xs text-slate-600">Cảnh báo doanh thu</p>
                <p className="text-lg font-semibold text-slate-900">
                  {aiInsight.anomalies.filter((item) => !item.isResolved).length}
                </p>
              </div>
            </div>
            {revenueForecastChartData.length > 0 && (
              <ForecastDayDetail data={revenueForecastChartData} branchId={effectiveAiBranchId} />
            )}
            {aiInsight.anomalies.filter((item) => !item.isResolved).length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-900">Cảnh báo doanh thu cần xem</p>
                <div className="space-y-1 text-xs text-amber-900">
                  {aiInsight.anomalies
                    .filter((item) => !item.isResolved)
                    .slice(0, 5)
                    .map((item) => (
                      <p key={item.id}>
                        [{item.severity}] {item.description}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      <Card title="Trạng thái hệ thống AI" subtitle="Theo dõi tình trạng hoạt động của các tính năng AI">
        {!qualitySummary && <p className="text-sm text-slate-500">Chưa có dữ liệu quality summary.</p>}
        {qualitySummary && (() => {
          const endpointLabels: Record<string, string> = {
            '/api/ai/anomalies': 'Phát hiện đơn hàng bất thường',
            '/api/ai/forecast/revenue': 'Dự báo doanh thu bằng AI (Prophet)',
          }
          const checkLabels: Record<string, string> = {
            sales_forecast_has_rows: 'Có dữ liệu dự báo doanh thu',
            sales_forecast_no_negative: 'Dự báo không có giá trị âm bất thường',
            sales_forecast_recent_coverage: 'Dự báo được cập nhật trong thời gian gần đây',
            sentiment_has_rows: 'Có dữ liệu phân tích cảm xúc khách hàng',
            anomaly_open_count_observed: 'Đã ghi nhận cảnh báo bất thường doanh thu',
          }
          const describeEndpoint = (ep: string) => endpointLabels[ep] || ep
          const describeCheck = (name: string) => checkLabels[name] || name.replace(/_/g, ' ')
          const isHealthy = qualitySummary.quality.status === 'ok'
          const affectedFeatures = Object.keys(qualitySummary.attention?.highFallbackEndpoints || {}).map(describeEndpoint)

          return (
            <div className="space-y-3">
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  isHealthy
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <p className="font-semibold">
                  {isHealthy ? 'Hệ thống AI đang hoạt động tốt' : 'Một số tính năng AI đang gặp sự cố kỹ thuật'}
                </p>
                {!isHealthy && (
                  <p className="mt-1 text-xs">
                    {affectedFeatures.length > 0 ? affectedFeatures.join(', ') : 'Một số tính năng'}
                    {' '}đang dùng phương án dự phòng. Các báo cáo doanh thu và hoạt động khác vẫn hiển thị bình thường.
                  </p>
                )}
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                <summary className="cursor-pointer select-none font-semibold text-slate-700">
                  Xem chi tiết kỹ thuật (dành cho quản trị viên)
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    {qualitySummary.quality.checks.map((check) => (
                      <p key={check.name} className={check.ok ? 'text-emerald-700' : 'text-amber-700'}>
                        {check.ok ? '✅' : '⚠️'} {describeCheck(check.name)}
                      </p>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="high-fallback-only"
                      type="checkbox"
                      checked={showOnlyHighFallback}
                      onChange={(e) => setShowOnlyHighFallback(e.target.checked)}
                    />
                    <label htmlFor="high-fallback-only" className="text-slate-700">
                      Chỉ hiện chức năng cảnh báo (tỉ lệ dự phòng ≥ 20%)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="fallback-window" className="text-slate-700">Khung thời gian xu hướng</label>
                    <select
                      id="fallback-window"
                      value={fallbackTrendWindowMinutes}
                      onChange={(e) => setFallbackTrendWindowMinutes(Number(e.target.value || 120))}
                      className="rounded border border-amber-200 bg-white px-2 py-1 text-slate-700"
                    >
                      <option value={60}>60 phút</option>
                      <option value={120}>2 giờ</option>
                      <option value={360}>6 giờ</option>
                      <option value={1440}>24 giờ</option>
                    </select>
                  </div>

                  {qualitySummary.modelQuality?.sentiment && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-emerald-900">
                      <p className="font-semibold">Chất lượng phân tích cảm xúc khách hàng</p>
                      <p>
                        Gemini AI: {qualitySummary.modelQuality.sentiment.geminiEnabled ? 'Đang bật' : 'Đang tắt'} · Thành công{' '}
                        {Math.round(Number(qualitySummary.modelQuality.sentiment.ratios?.geminiSuccessRatio || 0) * 100)}% · Dự phòng{' '}
                        {Math.round(Number(qualitySummary.modelQuality.sentiment.ratios?.fallbackRatio || 0) * 100)}%
                      </p>
                    </div>
                  )}

                  {fallbackRows.length > 0 && (
                    <div className="rounded-xl border border-amber-100 bg-white/90 p-3">
                      <p className="mb-2 font-semibold text-slate-800">Tỉ lệ dùng phương án dự phòng theo chức năng</p>
                      <div className="space-y-1">
                        {fallbackRows.map((row) => (
                          <p key={row.endpoint}>
                            {describeEndpoint(row.endpoint)}: <span className="font-semibold">{Math.round(row.fallbackRatio * 100)}%</span>
                            {' '}({row.fallbackResponses}/{row.totalResponses} lần)
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {fallbackSummaryRows.length > 0 && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                      <p className="mb-2 font-semibold text-indigo-900">Xu hướng theo thời gian</p>
                      <div className="space-y-1 text-indigo-900">
                        {fallbackSummaryRows.slice(0, 8).map((item) => (
                          <p key={`summary-${item.endpoint}`}>
                            {describeEndpoint(item.endpoint)}: {Math.round(item.latestFallbackRatio * 100)}% (tb {Math.round(item.avgFallbackRatio * 100)}%)
                            {' '}· xu hướng {item.trend === 'flat' ? 'ổn định' : item.trend} ({item.deltaRatio >= 0 ? '+' : ''}{Math.round(item.deltaRatio * 100)}%)
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {fallbackPriorityRows.length > 0 && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <p className="mb-2 font-semibold text-rose-900">Ưu tiên xử lý</p>
                      <div className="space-y-1 text-rose-900">
                        {fallbackPriorityRows.map((item) => (
                          <p key={`priority-${item.endpoint}`}>
                            [{item.priority}] {describeEndpoint(item.endpoint)}: {Math.round(item.latestFallbackRatio * 100)}% dùng phương án dự phòng
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {fallbackTrendPivot.length > 0 && (
                    <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                      <p className="mb-2 font-semibold text-slate-800">Biểu đồ xu hướng ({fallbackTrendWindowMinutes} phút gần nhất)</p>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={fallbackTrendPivot}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            {selectedFallbackEndpoints.map((endpoint, idx) => (
                              <Line
                                key={endpoint}
                                type="monotone"
                                dataKey={endpoint}
                                name={describeEndpoint(endpoint)}
                                stroke={['#0284c7', '#f59e0b', '#ef4444', '#16a34a'][idx % 4]}
                                strokeWidth={2}
                                dot={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )
        })()}
      </Card>

      <Card title="Kết nối cập nhật trực tiếp" subtitle="Theo dõi tốc độ đồng bộ dữ liệu theo thời gian thực">
        {!realtimeTelemetry && <p className="text-sm text-slate-500">Chưa có dữ liệu telemetry.</p>}
        {realtimeTelemetry && (() => {
          const hasAlert = realtimeTelemetry.alerts.p95LagHigh || realtimeTelemetry.alerts.subscriberDropHigh || realtimeTelemetry.alerts.disconnectRateHigh

          return (
            <div className="space-y-3">
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  hasAlert
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                <p className="font-semibold">
                  {hasAlert
                    ? 'Kết nối đang chậm, dữ liệu có thể cập nhật trễ hơn bình thường'
                    : 'Kết nối ổn định, dữ liệu đang cập nhật theo thời gian thực'}
                </p>
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                <summary className="cursor-pointer select-none font-semibold text-slate-700">
                  Xem chi tiết kỹ thuật (dành cho quản trị viên)
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                    <p className="text-slate-600">Số người đang xem trực tiếp</p>
                    <p className="text-lg font-semibold text-slate-900">{realtimeTelemetry.subscribers}</p>
                    <p className="text-slate-500">Cao nhất: {realtimeTelemetry.peakSubscribers}</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <p className="text-slate-600">Độ trễ (p95)</p>
                    <p className={`text-lg font-semibold ${realtimeTelemetry.alerts.p95LagHigh ? 'text-rose-700' : 'text-slate-900'}`}>
                      {Math.round(realtimeTelemetry.lag.p95Ms)} ms
                    </p>
                    <p className="text-slate-500">Số mẫu đo: {realtimeTelemetry.lag.samples}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="text-slate-600">Số lần rớt kết nối</p>
                    <p className={`text-lg font-semibold ${realtimeTelemetry.alerts.subscriberDropHigh ? 'text-rose-700' : 'text-slate-900'}`}>
                      {realtimeTelemetry.subscriberDrops}
                    </p>
                    <p className="text-slate-500">Tổng kết nối: {realtimeTelemetry.connections}</p>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                    <p className="text-slate-600">Tỉ lệ ngắt kết nối</p>
                    <p className={`text-lg font-semibold ${realtimeTelemetry.alerts.disconnectRateHigh ? 'text-rose-700' : 'text-slate-900'}`}>
                      {Math.round(realtimeTelemetry.disconnectRate * 100)}%
                    </p>
                    <p className="text-slate-500">Số lần ngắt: {realtimeTelemetry.disconnects}</p>
                  </div>
                </div>
              </details>
            </div>
          )
        })()}
      </Card>

      {recommendAbSummary && (
        <Card title="Recommendation A/B (24h)" subtitle="Hiệu quả control vs treatment cho gợi ý món">
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">Tổng events: <span className="font-semibold">{recommendAbSummary.events}</span></p>
            <p className="text-slate-700">
              CTR uplift: <span className={`font-semibold ${recommendAbSummary.uplift.ctr >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {Math.round(recommendAbSummary.uplift.ctr * 10000) / 100}%
              </span>
              {' '}| Add-to-cart uplift: <span className={`font-semibold ${recommendAbSummary.uplift.addToCartRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {Math.round(recommendAbSummary.uplift.addToCartRate * 10000) / 100}%
              </span>
            </p>
            <div className="space-y-1 text-xs text-slate-700">
              {Object.entries(recommendAbSummary.groups || {}).map(([group, item]) => (
                <p key={`ab-${group}`}>
                  {group}: shown {item.shown}, click {item.click}, add_to_cart {item.add_to_cart}, purchase {item.purchase}
                </p>
              ))}
            </div>
            {recommendAbSummary.significance && (
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  recommendAbSummary.significance.decisionReady
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <p className="font-semibold">
                  {recommendAbSummary.significance.decisionReady ? 'Decision-ready' : 'Chưa decision-ready'}
                </p>
                <p>
                  Sample: treatment {recommendAbSummary.significance.sampleSize.treatment} / control {recommendAbSummary.significance.sampleSize.control}
                  {' '} (min {recommendAbSummary.significance.minSamplePerGroup})
                </p>
                <p>
                  Confidence CTR {Math.round(recommendAbSummary.significance.confidence.ctr * 100)}% · Add-to-cart {Math.round(recommendAbSummary.significance.confidence.addToCartRate * 100)}%
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Doanh thu theo thời gian (M-19)" subtitle="Ngày / tuần / tháng / năm">
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Đơn hàng theo giờ (M-23)" subtitle="24 giờ gần nhất">
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderHourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" name="Số đơn" fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Thanh toán theo phương thức" subtitle="Doanh thu ghi nhận theo từng cổng thanh toán">
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentProviderChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="provider" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Trạng thái thanh toán" subtitle="Phân bổ số lượng giao dịch theo trạng thái">
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentStatusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Số giao dịch" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Top 10 món bán chạy (M-20)">
          <div className="space-y-2">
            {topItems.length === 0 && <p className="text-sm text-gray-500">Chưa có dữ liệu</p>}
            {topItems.map((item, index) => (
              <div key={item.menuItemId} className="flex items-center justify-between rounded-xl border border-amber-100 bg-white/85 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    #{index + 1} {item.menuItemName}
                  </p>
                  <p className="text-xs text-slate-500">{item.quantity} món · {item.orderCount} đơn</p>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(item.revenue)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Hiệu suất nhân viên (M-22)">
          <div className="space-y-2">
            {staffItems.length === 0 && <p className="text-sm text-gray-500">Chưa có dữ liệu</p>}
            {staffItems.map((item) => (
              <div key={item.staffId} className="flex items-center justify-between rounded-xl border border-amber-100 bg-white/85 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{item.staffName}</p>
                  <p className="text-xs text-slate-500">{vaiTroNhanVien(item.role) || 'Chưa phân vai trò'} · {item.orderCount} đơn</p>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(item.revenue)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Tồn kho hiện tại (M-21)" subtitle={`Cập nhật: ${dashboard?.updatedAt ? new Date(dashboard.updatedAt).toLocaleString('vi-VN') : '-'}`}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-100 bg-white/90 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-slate-500">Tổng nguyên liệu</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{inventory?.summary.totalIngredients || 0}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-white/90 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-slate-500">Đang hoạt động</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{inventory?.summary.activeIngredients || 0}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm">
            <p className="text-red-600">Sắp hết hàng</p>
            <p className="text-xl font-semibold text-red-700">{inventory?.summary.lowStockCount || 0}</p>
          </div>
        </div>

        <div className="space-y-3 sm:hidden">
          {(inventory?.stocks || []).slice(0, 15).map((item) => (
            <div key={item.id} className="rounded-xl border border-amber-100 bg-white/90 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs ${item.isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {item.isLowStock ? 'Sắp hết hàng' : 'Ổn định'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.stock} {item.unit} · Min {item.minStock} {item.unit}</p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{formatMoney(item.stockValue)}</p>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="py-2 pr-3">Nguyên liệu</th>
                <th className="py-2 pr-3">Tồn</th>
                <th className="py-2 pr-3">Min</th>
                <th className="py-2 pr-3">Giá trị</th>
                <th className="py-2">Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {(inventory?.stocks || []).slice(0, 15).map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-900">{item.name}</td>
                  <td className="py-2 pr-3">{item.stock} {item.unit}</td>
                  <td className="py-2 pr-3">{item.minStock} {item.unit}</td>
                  <td className="py-2 pr-3">{formatMoney(item.stockValue)}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${item.isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.isLowStock ? 'Sắp hết hàng' : 'Ổn định'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(inventoryTrendChartData.length > 0 || inventoryRiskChartData.length > 0) && (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Xu hướng nhập/xuất kho</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={inventoryTrendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="importQty" name="Nhập" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="exportQty" name="Xuất" stroke="#dc2626" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="adjustQty" name="Điều chỉnh" stroke="#0284c7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Phân tầng rủi ro tồn kho</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryRiskChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Số nguyên liệu" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {(inventory?.analytics?.topConsumption || []).length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-white/90 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
            <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Top nguyên liệu tiêu hao</p>
            <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
              {(inventory?.analytics?.topConsumption || []).slice(0, 8).map((item, index) => (
                <p key={item.ingredientId}>
                  #{index + 1} {item.ingredientName}: <span className="font-semibold">{Math.round(item.quantity * 100) / 100}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Report Chat (AI)" subtitle="Hỏi đáp dữ liệu báo cáo bằng ngôn ngữ tự nhiên">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={reportChatQuestion}
              onChange={(e) => setReportChatQuestion(e.target.value)}
              className="min-w-[260px] flex-1"
              placeholder="Ví dụ: Doanh thu hôm nay là bao nhiêu?"
            />
            <Button onClick={() => void handleReportChatSubmit()} loading={reportChatLoading}>
              Gửi câu hỏi
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Branch scope: <span className="font-medium text-slate-700">{effectiveAiBranchId}</span>
          </p>
          {!reportChatResult && <p className="text-sm text-slate-500">Chưa có kết quả truy vấn.</p>}
          {reportChatResult && (
            <div className="space-y-2 rounded-xl border border-amber-100 bg-white/90 p-3 text-sm">
              <p><span className="font-semibold">Intent:</span> {reportChatResult.intent}</p>
              <p><span className="font-semibold">Thời gian xử lý:</span> {reportChatResult.executionTimeMs} ms</p>
              <p><span className="font-semibold">Số dòng dữ liệu:</span> {reportChatResult.rowCount}</p>
              <p><span className="font-semibold">Trả lời:</span> {reportChatResult.answer}</p>
              {reportChatResult.sql && (
                <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  <span className="font-semibold">SQL (ADMIN):</span> {reportChatResult.sql}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title="Xuất báo cáo (M-19/M-21/M-22)">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Loại báo cáo</label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className={selectClass}
            >
              <option value="revenue">Doanh thu</option>
              <option value="top-items">Top món bán chạy</option>
              <option value="inventory">Tồn kho</option>
              <option value="staff-performance">Hiệu suất nhân viên</option>
              <option value="dashboard">Ảnh chụp nhanh dashboard</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Định dạng</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className={selectClass}
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>

          <Button className="w-full sm:w-auto" onClick={() => void handleExport()} loading={loading}>
            Tải báo cáo
          </Button>
        </div>
      </Card>
    </div>
  )
}
