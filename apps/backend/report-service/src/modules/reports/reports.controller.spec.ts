import { ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';

/**
 * Branch isolation of reports: only ADMIN may read another branch (or every branch); everyone
 * else is pinned to the branch in their token, and asking for another one is refused.
 */
describe('ReportsController branch scope', () => {
  const reportsService = {
    getRevenueReport: jest.fn().mockResolvedValue({ ok: true }),
    getTopItems: jest.fn().mockResolvedValue({ ok: true }),
    getInventoryReport: jest.fn().mockResolvedValue({ ok: true }),
    getStaffPerformance: jest.fn().mockResolvedValue({ ok: true }),
    getDashboard: jest.fn().mockResolvedValue({ ok: true }),
    getDailyStats: jest.fn().mockResolvedValue({ ok: true }),
    exportReport: jest.fn().mockResolvedValue({ contentType: 'application/pdf', filename: 'r.pdf', buffer: Buffer.from('') }),
  };
  const realtime = { emitRefresh: jest.fn(), stream: jest.fn().mockReturnValue('stream') };
  const controller = new ReportsController(reportsService as any, realtime as any);

  const admin = { user: { roles: ['admin'], branchId: 'branch-a' } };
  const manager = { user: { roles: ['MANAGER'], branchId: 'branch-a' } };
  const noBranch = { user: { roles: ['MANAGER'] } };

  beforeEach(() => jest.clearAllMocks());

  it('lets ADMIN read any branch', async () => {
    await controller.getRevenue(admin, { branchId: 'branch-b' } as any);
    expect(reportsService.getRevenueReport).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-b' }));
  });

  it('lets ADMIN read all branches when none is requested', async () => {
    await controller.getRevenue(admin, {} as any);
    expect(reportsService.getRevenueReport).toHaveBeenCalledWith(expect.objectContaining({ branchId: undefined }));
  });

  it('pins a non-admin to their own branch when none is requested', async () => {
    await controller.getRevenue(manager, {} as any);
    expect(reportsService.getRevenueReport).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-a' }));
  });

  it('allows a non-admin to ask for their own branch explicitly', async () => {
    await controller.getTopItems(manager, { branchId: ' branch-a ' } as any);
    expect(reportsService.getTopItems).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-a' }));
  });

  it.each([
    ['revenue', (q: any) => controller.getRevenue(manager, q)],
    ['top-items', (q: any) => controller.getTopItems(manager, q)],
    ['inventory', (q: any) => controller.getInventory(manager, q)],
    ['staff-performance', (q: any) => controller.getStaffPerformance(manager, q)],
    ['dashboard', (q: any) => controller.getDashboard(manager, q)],
    ['export', (q: any) => controller.exportReport(manager, q, { setHeader: jest.fn(), send: jest.fn() } as any)],
  ])('refuses another branch for a non-admin on %s', async (_name, call) => {
    await expect(call({ branchId: 'branch-b' })).rejects.toThrow(new ForbiddenException('FORBIDDEN_BRANCH_SCOPE'));
    Object.values(reportsService).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('refuses a non-admin token without a branch', async () => {
    await expect(controller.getDashboard(noBranch, {} as any)).rejects.toThrow(new ForbiddenException('MISSING_BRANCH_SCOPE'));
  });

  it('refuses a request without a user', async () => {
    await expect(controller.getDashboard({}, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes daily stats and the realtime stream too', async () => {
    await controller.getDailyStats(manager, '2026-01-01', '2026-01-31');
    expect(reportsService.getDailyStats).toHaveBeenCalledWith('2026-01-01', '2026-01-31', 'branch-a');

    expect(() => controller.streamRealtime(manager, 'branch-b')).toThrow(ForbiddenException);
    controller.streamRealtime(manager);
    expect(realtime.stream).toHaveBeenCalledWith('branch-a');
  });
});
