import { ForbiddenException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';

/**
 * Branch isolation of the /ingredients endpoints: a MANAGER only works on the branch in the token
 * (also for operations addressed by ingredient id); ADMIN and internal services are unrestricted.
 */
describe('InventoryController branch scope', () => {
  const ingredients: Record<string, { id: string; branchId: string }> = {
    'ing-a1': { id: 'ing-a1', branchId: 'branch-a' },
    'ing-a2': { id: 'ing-a2', branchId: 'branch-a' },
    'ing-b1': { id: 'ing-b1', branchId: 'branch-b' },
  };
  const inventoryService = {
    getIngredientById: jest.fn(async (id: string) => ingredients[id] ?? null),
    createIngredient: jest.fn().mockResolvedValue({ ok: true }),
    findAllIngredients: jest.fn().mockResolvedValue([]),
    updateIngredient: jest.fn().mockResolvedValue({ ok: true }),
    deleteIngredient: jest.fn().mockResolvedValue({ ok: true }),
    importStock: jest.fn().mockResolvedValue({ ok: true }),
    createStockReceipt: jest.fn().mockResolvedValue({ ok: true }),
    adjustStock: jest.fn().mockResolvedValue({ ok: true }),
    exportStockBulk: jest.fn().mockResolvedValue({ ok: true }),
    getStockMovements: jest.fn().mockResolvedValue([]),
    syncMenuItems: jest.fn().mockResolvedValue({ ok: true }),
  };
  const controller = new InventoryController(inventoryService as any);

  const admin = { user: { roles: ['ADMIN'], email: 'admin@test.local' } };
  const internal = { user: { roles: ['INTERNAL_SERVICE'] } };
  const manager = { user: { roles: ['manager'], branchId: 'branch-a', email: 'm@test.local' } };
  const managerNoBranch = { user: { roles: ['MANAGER'] } };
  const staff = { user: { roles: ['STAFF'], branchId: 'branch-a' } };

  const writeCalls = () =>
    [
      inventoryService.createIngredient,
      inventoryService.updateIngredient,
      inventoryService.deleteIngredient,
      inventoryService.importStock,
      inventoryService.createStockReceipt,
      inventoryService.adjustStock,
      inventoryService.exportStockBulk,
      inventoryService.syncMenuItems,
    ].reduce((n, fn) => n + fn.mock.calls.length, 0);

  beforeEach(() => jest.clearAllMocks());

  describe('scopeBranch', () => {
    it('pins a manager to their own branch when none is requested', () => {
      controller.findAll(manager, {} as any);
      expect(inventoryService.findAllIngredients).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-a' }));
    });

    it('refuses another branch for a manager', () => {
      expect(() => controller.findAll(manager, { branchId: 'branch-b' } as any)).toThrow(ForbiddenException);
      expect(() => controller.create(manager, { name: 'x', branchId: 'branch-b' } as any)).toThrow(ForbiddenException);
      expect(() => controller.syncMenu(manager, { branchId: 'branch-b', items: [] })).toThrow(ForbiddenException);
      expect(writeCalls()).toBe(0);
    });

    it('refuses a manager token without a branch', () => {
      expect(() => controller.findAll(managerNoBranch, {} as any)).toThrow(new ForbiddenException('MISSING_BRANCH_SCOPE'));
    });

    it('keeps the requested branch (or all branches) for ADMIN and internal services', () => {
      controller.findAll(admin, { branchId: 'branch-b' } as any);
      controller.findAll(internal, {} as any);
      expect(inventoryService.findAllIngredients).toHaveBeenNthCalledWith(1, expect.objectContaining({ branchId: 'branch-b' }));
      expect(inventoryService.findAllIngredients).toHaveBeenNthCalledWith(2, expect.objectContaining({ branchId: undefined }));
    });

    it('refuses roles other than ADMIN / MANAGER', () => {
      expect(() => controller.findAll(staff, {} as any)).toThrow(new ForbiddenException('FORBIDDEN_ROLE'));
    });
  });

  describe('assertIngredientsInScope', () => {
    it('lets a manager update and delete an ingredient of their branch', async () => {
      await controller.update(manager, 'ing-a1', {} as any);
      await controller.remove(manager, 'ing-a1');
      expect(inventoryService.updateIngredient).toHaveBeenCalledWith('ing-a1', {});
      expect(inventoryService.deleteIngredient).toHaveBeenCalledWith('ing-a1');
    });

    it('refuses to update or delete an ingredient of another branch', async () => {
      await expect(controller.update(manager, 'ing-b1', {} as any)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.remove(manager, 'ing-b1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(writeCalls()).toBe(0);
    });

    it('refuses an ingredient that does not exist', async () => {
      await expect(controller.update(manager, 'missing', {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a stock movement on another branch ingredient even when the body names the own branch', async () => {
      await expect(
        controller.importStock(manager, { ingredientId: 'ing-b1', branchId: 'branch-a', quantity: 5 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        controller.adjustStock(manager, { ingredientId: 'ing-b1', branchId: 'branch-a', actualQuantity: 1 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(writeCalls()).toBe(0);
    });

    it('refuses a receipt or bulk export when any one item belongs to another branch', async () => {
      const items = [{ ingredientId: 'ing-a1' }, { ingredientId: 'ing-b1' }];
      await expect(controller.createReceipt(manager, { items } as any)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.exportBulk(manager, { items } as any)).rejects.toBeInstanceOf(ForbiddenException);
      expect(writeCalls()).toBe(0);
    });

    it('accepts a receipt whose items all belong to the manager branch', async () => {
      await controller.createReceipt(manager, { items: [{ ingredientId: 'ing-a1' }, { ingredientId: 'ing-a2' }] } as any);
      expect(inventoryService.createStockReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: 'branch-a', createdBy: 'm@test.local' }),
      );
    });

    it('refuses movement history of another branch ingredient', async () => {
      await expect(controller.getMovements(manager, { ingredientId: 'ing-b1' } as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(inventoryService.getStockMovements).not.toHaveBeenCalled();
    });

    it('does not restrict ADMIN', async () => {
      await controller.update(admin, 'ing-b1', {} as any);
      expect(inventoryService.updateIngredient).toHaveBeenCalledWith('ing-b1', {});
      expect(inventoryService.getIngredientById).not.toHaveBeenCalled();
    });
  });
});
