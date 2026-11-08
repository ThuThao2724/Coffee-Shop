import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomLogger } from '../../common/logger.service';
import { createReadPool, resolveDatabaseUrl } from '../../common/database-url';

/** One business day of paid payments (paymentdb). */
export interface PaymentDayRow {
  day: string; // YYYY-MM-DD in the shop's time zone
  revenue: string | number;
  orderCount: number;
}

/** Items sold on one business day in one branch (orderdb, COMPLETED orders). */
export interface ItemDayRow {
  day: string;
  branchId?: string | null;
  menuItemId: string;
  menuItemName?: string | null;
  quantity: number;
  revenue: string | number;
  orderCount: number;
}

export interface ReportAggregates {
  dailyRevenue: Array<{ date: Date; revenue: string; orderCount: number }>;
  itemSales: Array<{
    date: Date;
    branchId: string | null;
    menuItemId: string;
    menuItemName: string | null;
    quantity: number;
    revenue: string;
    orderCount: number;
  }>;
  dailyStats: Array<{
    date: Date;
    totalOrders: number;
    totalRevenue: string;
    avgOrderValue: string;
    topItemMenuId: string | null;
    topItemQuantity: number | null;
    topItemRevenue: string | null;
  }>;
}

/** A business day is stored as midnight UTC of that calendar date (the columns are timestamps). */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const money = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Turns per-day source rows into the rows of daily_revenue, item_sales and daily_stats.
 * Revenue comes from PAID payments (like the revenue report); items from COMPLETED orders (like the
 * top-items report), one row per day, branch and item. The top item of a day is the one with the
 * highest quantity over all branches, then revenue.
 */
export function buildReportAggregates(payments: PaymentDayRow[], items: ItemDayRow[]): ReportAggregates {
  const dailyRevenue = payments
    .map((row) => ({ date: dayToDate(row.day), revenue: String(money(row.revenue)), orderCount: Number(row.orderCount) || 0 }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const itemSales = items.map((row) => ({
    date: dayToDate(row.day),
    branchId: row.branchId ? String(row.branchId) : null,
    menuItemId: String(row.menuItemId),
    menuItemName: row.menuItemName ? String(row.menuItemName) : null,
    quantity: Number(row.quantity) || 0,
    revenue: String(money(row.revenue)),
    orderCount: Number(row.orderCount) || 0,
  }));

  // Sum each item over the branches first, then pick the day's top item.
  const perDayItem = new Map<string, ItemDayRow>();
  for (const row of items) {
    const key = `${row.day}|${row.menuItemId}`;
    const acc = perDayItem.get(key);
    if (!acc) {
      perDayItem.set(key, { ...row, quantity: Number(row.quantity) || 0, revenue: money(row.revenue) });
    } else {
      acc.quantity = Number(acc.quantity) + (Number(row.quantity) || 0);
      acc.revenue = money(acc.revenue) + money(row.revenue);
    }
  }
  const topByDay = new Map<string, ItemDayRow>();
  for (const row of perDayItem.values()) {
    const current = topByDay.get(row.day);
    const better =
      !current ||
      Number(row.quantity) > Number(current.quantity) ||
      (Number(row.quantity) === Number(current.quantity) && money(row.revenue) > money(current.revenue));
    if (better) topByDay.set(row.day, row);
  }

  const revenueByDay = new Map(payments.map((row) => [row.day, row]));
  const days = Array.from(new Set([...revenueByDay.keys(), ...topByDay.keys()])).sort();
  const dailyStats = days.map((day) => {
    const paid = revenueByDay.get(day);
    const totalOrders = paid ? Number(paid.orderCount) || 0 : 0;
    const totalRevenue = paid ? money(paid.revenue) : 0;
    const top = topByDay.get(day);
    return {
      date: dayToDate(day),
      totalOrders,
      totalRevenue: String(totalRevenue),
      avgOrderValue: String(totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0),
      topItemMenuId: top ? String(top.menuItemId) : null,
      topItemQuantity: top ? Number(top.quantity) || 0 : null,
      topItemRevenue: top ? String(money(top.revenue)) : null,
    };
  });

  return { dailyRevenue, itemSales, dailyStats };
}

/** YYYY-MM-DD of `now` minus `days` in the given IANA time zone. */
export function businessDayStart(now: Date, days: number, timeZone: string): string {
  const shifted = new Date(now.getTime() - Math.max(days, 0) * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
}

// Any constant works; it only has to be the same for every report-service instance.
const AGGREGATION_LOCK_KEY = 74_210_031;

/**
 * Keeps the analytics tables (daily_revenue, item_sales, daily_stats) filled from the order and
 * payment databases. They used to be written only by a Kafka consumer, which is disabled when
 * KAFKA_BROKERS is empty (the default), so report chat and AI forecasts always saw no data.
 * A full rebuild runs at startup and once a day; the recent days are recomputed every interval.
 */
@Injectable()
export class ReportAggregationService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private orderPool: Pool | null = null;
  private paymentPool: Pool | null = null;
  private running = false;
  private lastFullRunAt = 0;
  private lastResult: Record<string, unknown> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject('CustomLogger') private readonly logger: CustomLogger,
  ) {}

  get enabled() {
    return String(this.config.get('REPORT_AGGREGATION_ENABLED', 'true')).toLowerCase() !== 'false';
  }

  private get intervalMs() {
    const value = Number(this.config.get('REPORT_AGGREGATION_INTERVAL_MS', '600000'));
    return Number.isFinite(value) && value >= 60_000 ? Math.trunc(value) : 600_000;
  }

  private get recentDays() {
    const value = Number(this.config.get('REPORT_AGGREGATION_RECENT_DAYS', '3'));
    return Number.isFinite(value) && value >= 1 ? Math.min(Math.trunc(value), 60) : 3;
  }

  /**
   * Calendar day used for the daily buckets. Defaults to UTC, the same day boundaries as the existing
   * revenue/top-items reports (and the seeded demo data, whose shop hours were written as UTC), so the
   * tables agree with the dashboards. A shop running on real data can set REPORT_TIMEZONE, e.g.
   * Asia/Ho_Chi_Minh, once the reports use the same zone.
   */
  get timeZone() {
    const zone = String(this.config.get('REPORT_TIMEZONE', 'UTC') || '').trim();
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: zone });
      return zone;
    } catch {
      return 'UTC';
    }
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Report aggregation disabled (REPORT_AGGREGATION_ENABLED=false)');
      return;
    }
    this.orderPool = createReadPool(resolveDatabaseUrl(this.config, 'ORDER_DATABASE_URL', 'orderdb'));
    this.paymentPool = createReadPool(resolveDatabaseUrl(this.config, 'PAYMENT_DATABASE_URL', 'paymentdb'));
    // First run in the background so a slow rebuild never delays startup or health checks.
    setTimeout(() => void this.tick(), 5_000).unref();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await Promise.allSettled([this.orderPool?.end(), this.paymentPool?.end()]);
  }

  status() {
    return { enabled: this.enabled, timeZone: this.timeZone, lastResult: this.lastResult };
  }

  private async tick() {
    const full = Date.now() - this.lastFullRunAt >= 24 * 60 * 60 * 1000;
    try {
      await this.run(full ? null : businessDayStart(new Date(), this.recentDays - 1, this.timeZone));
      if (full) this.lastFullRunAt = Date.now();
    } catch (error) {
      this.lastResult = { ok: false, at: new Date().toISOString(), error: (error as Error).message };
      this.logger.error(`Report aggregation failed: ${(error as Error).message}`);
    }
  }

  /** Recomputes every day from `fromDay` (YYYY-MM-DD, shop time zone) on, or all history when null. */
  async run(fromDay: string | null) {
    if (this.running || !this.orderPool || !this.paymentPool) return null;
    this.running = true;
    const started = Date.now();
    try {
      const tz = this.timeZone;
      // Timestamps are stored as UTC without a zone; convert to the shop's calendar day.
      const localDay = (column: string) => `to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE $1, 'YYYY-MM-DD')`;
      const payDay = localDay('COALESCE(p."paidAt", p."createdAt")');
      const orderDay = localDay('o."createdAt"');

      const payments = await this.paymentPool.query<PaymentDayRow>(
        `SELECT ${payDay} AS day, COALESCE(SUM(p.amount), 0)::numeric AS revenue, COUNT(*)::int AS "orderCount"
           FROM payments p
          WHERE p.status = 'PAID' AND ($2::text IS NULL OR ${payDay} >= $2)
          GROUP BY 1`,
        [tz, fromDay],
      );
      const items = await this.orderPool.query<ItemDayRow>(
        `SELECT ${orderDay} AS day, o."branchId" AS "branchId", oi."menuItemId" AS "menuItemId",
                MAX(mi.name) AS "menuItemName",
                COALESCE(SUM(oi.quantity), 0)::int AS quantity,
                COALESCE(SUM(oi.quantity * oi.price), 0)::numeric AS revenue,
                COUNT(DISTINCT oi."orderId")::int AS "orderCount"
           FROM order_items oi
           JOIN orders o ON o.id = oi."orderId"
           LEFT JOIN menu_items mi ON mi.id = oi."menuItemId"
          WHERE o.status = 'COMPLETED' AND ($2::text IS NULL OR ${orderDay} >= $2)
          GROUP BY 1, 2, 3`,
        [tz, fromDay],
      );

      const aggregates = buildReportAggregates(payments.rows, items.rows);
      const from = fromDay ? dayToDate(fromDay) : null;
      const range = from ? { date: { gte: from } } : {};

      const written = await this.prisma.$transaction(
        async (tx) => {
          const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${AGGREGATION_LOCK_KEY}) AS locked`;
          if (!lock?.locked) return null; // another instance is rebuilding right now
          await tx.dailyRevenue.deleteMany({ where: range });
          await tx.itemSales.deleteMany({ where: range });
          await tx.dailyStats.deleteMany({ where: range });
          await tx.dailyRevenue.createMany({ data: aggregates.dailyRevenue });
          await tx.itemSales.createMany({ data: aggregates.itemSales });
          await tx.dailyStats.createMany({ data: aggregates.dailyStats });
          return {
            dailyRevenue: aggregates.dailyRevenue.length,
            itemSales: aggregates.itemSales.length,
            dailyStats: aggregates.dailyStats.length,
          };
        },
        { timeout: 120_000, maxWait: 10_000 },
      );

      this.lastResult = {
        ok: true,
        at: new Date().toISOString(),
        scope: fromDay ? `from ${fromDay}` : 'full',
        skipped: written === null,
        rows: written,
        ms: Date.now() - started,
      };
      if (written) {
        this.logger.log(
          `Report aggregation (${fromDay ? `from ${fromDay}` : 'full'}, ${tz}): ${written.dailyRevenue} days, ${written.itemSales} item rows in ${Date.now() - started}ms`,
        );
      }
      return written;
    } finally {
      this.running = false;
    }
  }
}
