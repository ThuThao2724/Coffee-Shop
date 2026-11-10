import { buildReportAggregates, businessDayStart, dayToDate } from './report-aggregation.service';

describe('buildReportAggregates', () => {
  const payments = [
    { day: '2026-10-02', revenue: '150000', orderCount: 3 },
    { day: '2026-10-01', revenue: 100000, orderCount: 2 },
  ];
  const items = [
    { day: '2026-10-01', menuItemId: 'latte', quantity: 3, revenue: '90000', orderCount: 2 },
    { day: '2026-10-01', menuItemId: 'tea', quantity: 3, revenue: '60000', orderCount: 2 },
    { day: '2026-10-02', menuItemId: 'tea', quantity: 1, revenue: '20000', orderCount: 1 },
    { day: '2026-10-03', menuItemId: 'cake', quantity: 2, revenue: '50000', orderCount: 1 },
  ];

  it('builds daily revenue sorted by day, stored as midnight UTC of the business day', () => {
    const { dailyRevenue } = buildReportAggregates(payments, items);
    expect(dailyRevenue).toEqual([
      { date: new Date('2026-10-01T00:00:00.000Z'), revenue: '100000', orderCount: 2 },
      { date: new Date('2026-10-02T00:00:00.000Z'), revenue: '150000', orderCount: 3 },
    ]);
  });

  it('keeps one item_sales row per day and menu item', () => {
    const { itemSales } = buildReportAggregates(payments, items);
    expect(itemSales).toHaveLength(4);
    expect(itemSales[0]).toEqual({
      date: dayToDate('2026-10-01'),
      branchId: null,
      menuItemId: 'latte',
      menuItemName: null,
      quantity: 3,
      revenue: '90000',
      orderCount: 2,
    });
  });

  it('keeps branch and item name, and picks the top item over all branches', () => {
    const { itemSales, dailyStats } = buildReportAggregates(
      [{ day: '2026-10-05', revenue: 300000, orderCount: 6 }],
      [
        { day: '2026-10-05', branchId: 'branch-a', menuItemId: 'latte', menuItemName: 'Latte', quantity: 4, revenue: 120000, orderCount: 3 },
        { day: '2026-10-05', branchId: 'branch-a', menuItemId: 'tea', menuItemName: 'Tra dao', quantity: 3, revenue: 60000, orderCount: 2 },
        { day: '2026-10-05', branchId: 'branch-b', menuItemId: 'tea', menuItemName: 'Tra dao', quantity: 3, revenue: 60000, orderCount: 2 },
      ],
    );
    expect(itemSales.map((r) => [r.branchId, r.menuItemId, r.menuItemName])).toEqual([
      ['branch-a', 'latte', 'Latte'],
      ['branch-a', 'tea', 'Tra dao'],
      ['branch-b', 'tea', 'Tra dao'],
    ]);
    // tea: 3 + 3 = 6 over both branches beats latte's 4 in a single branch
    expect(dailyStats[0]).toMatchObject({ topItemMenuId: 'tea', topItemQuantity: 6, topItemRevenue: '120000' });
  });

  it('computes daily stats with the average order value and the top item (quantity, then revenue)', () => {
    const { dailyStats } = buildReportAggregates(payments, items);
    expect(dailyStats.map((row) => row.date.toISOString().slice(0, 10))).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(dailyStats[0]).toMatchObject({
      totalOrders: 2,
      totalRevenue: '100000',
      avgOrderValue: '50000',
      topItemMenuId: 'latte', // same quantity as tea, higher revenue
      topItemQuantity: 3,
      topItemRevenue: '90000',
    });
  });

  it('reports a day with items but no paid payment as zero revenue instead of dividing by zero', () => {
    const { dailyStats } = buildReportAggregates(payments, items);
    expect(dailyStats[2]).toMatchObject({ totalOrders: 0, totalRevenue: '0', avgOrderValue: '0', topItemMenuId: 'cake' });
  });

  it('returns empty tables for no data', () => {
    expect(buildReportAggregates([], [])).toEqual({ dailyRevenue: [], itemSales: [], dailyStats: [] });
  });
});

describe('businessDayStart', () => {
  it('uses the shop time zone, not UTC, to pick the calendar day', () => {
    // 2026-10-01 18:30 UTC is already 2026-10-02 01:30 in Vietnam (UTC+7).
    const now = new Date('2026-10-01T18:30:00.000Z');
    expect(businessDayStart(now, 0, 'Asia/Ho_Chi_Minh')).toBe('2026-10-02');
    expect(businessDayStart(now, 0, 'UTC')).toBe('2026-10-01');
  });

  it('goes back the requested number of days', () => {
    const now = new Date('2026-10-05T03:00:00.000Z');
    expect(businessDayStart(now, 2, 'Asia/Ho_Chi_Minh')).toBe('2026-10-03');
  });
});
