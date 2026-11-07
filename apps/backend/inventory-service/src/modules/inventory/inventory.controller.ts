import {
  ForbiddenException,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { StockMovementDto } from './dto/stock-movement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryIngredientDto, QueryMovementDto } from './dto/query-movements.dto';
import { BulkExportStockDto } from './dto/bulk-export-stock.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ingredients')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private requireInventoryRole(req: any) {
    const roles = Array.isArray(req?.user?.roles) ? req.user.roles : [];
    const normalized = roles.map((role: unknown) => String(role || '').trim().toUpperCase());
    if (normalized.includes('INTERNAL_SERVICE')) return;
    if (!normalized.some((role) => role === 'ADMIN' || role === 'MANAGER')) {
      throw new ForbiddenException('FORBIDDEN_ROLE');
    }
  }

  private isBranchUnrestricted(req: any) {
    const roles = Array.isArray(req?.user?.roles) ? req.user.roles.map((r: unknown) => String(r || '').trim().toUpperCase()) : [];
    return roles.includes('ADMIN') || roles.includes('INTERNAL_SERVICE');
  }

  /**
   * Branch isolation for the legacy /ingredients endpoints (still used by the Inventory and Menu
   * pages): a MANAGER always works on the branch in their token; asking for another one is refused.
   * ADMIN and internal services keep the requested branch (or none = all branches).
   */
  private scopeBranch(req: any, requested?: string | null): string | undefined {
    const wanted = String(requested || '').trim() || undefined;
    if (this.isBranchUnrestricted(req)) return wanted;
    const own = String(req?.user?.branchId || req?.user?.branch_id || '').trim();
    if (!own) throw new ForbiddenException('MISSING_BRANCH_SCOPE');
    if (wanted && wanted !== own) {
      throw new ForbiddenException('Manager can only access inventory in own branch');
    }
    return own;
  }

  /** Ingredient-id based operations: every referenced ingredient must belong to the manager's branch. */
  private async assertIngredientsInScope(req: any, ingredientIds: Array<string | undefined>) {
    if (this.isBranchUnrestricted(req)) return;
    const own = this.scopeBranch(req);
    const ids = Array.from(new Set(ingredientIds.map((id) => String(id || '').trim()).filter(Boolean)));
    for (const id of ids) {
      const ingredient: any = await this.inventoryService.getIngredientById(id);
      if (String(ingredient?.branchId || '').trim() !== own) {
        throw new ForbiddenException('Manager can only access inventory in own branch');
      }
    }
  }

  private resolveActor(req: any) {
    const user = (req && req.user) || {};
    const email = String(user.email || '').trim();
    const sub = String(user.sub || '').trim();
    if (email) return email;
    if (sub) return sub;
    return 'unknown';
  }

  @Post()
  @ApiOperation({ summary: 'Create new ingredient' })
  @ApiResponse({ status: 201, description: 'Ingredient created' })
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: any, @Body() createIngredientDto: CreateIngredientDto) {
    this.requireInventoryRole(req);
    createIngredientDto.branchId = this.scopeBranch(req, createIngredientDto.branchId);
    return this.inventoryService.createIngredient(createIngredientDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ingredients' })
  @ApiResponse({ status: 200, description: 'List of ingredients' })
  findAll(@Req() req: any, @Query() query: QueryIngredientDto) {
    this.requireInventoryRole(req);
    query.branchId = this.scopeBranch(req, query.branchId);
    return this.inventoryService.findAllIngredients(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ingredient' })
  @ApiResponse({ status: 200, description: 'Ingredient updated' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    this.requireInventoryRole(req);
    await this.assertIngredientsInScope(req, [id]);
    return this.inventoryService.updateIngredient(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete ingredient' })
  @ApiResponse({ status: 200, description: 'Ingredient deleted' })
  async remove(@Req() req: any, @Param('id') id: string) {
    this.requireInventoryRole(req);
    await this.assertIngredientsInScope(req, [id]);
    return this.inventoryService.deleteIngredient(id);
  }

  @Post('stock/import')
  @ApiOperation({ summary: 'Import stock (add to inventory)' })
  @ApiResponse({ status: 200, description: 'Stock imported' })
  @HttpCode(HttpStatus.OK)
  async importStock(@Req() req: any, @Body() stockMovementDto: StockMovementDto) {
    this.requireInventoryRole(req);
    stockMovementDto.branchId = this.scopeBranch(req, stockMovementDto.branchId);
    await this.assertIngredientsInScope(req, [stockMovementDto.ingredientId]);
    return this.inventoryService.importStock({
      ...stockMovementDto,
      createdBy: stockMovementDto.createdBy || this.resolveActor(req),
    });
  }

  @Post('stock/receipts')
  @ApiOperation({ summary: 'Create stock import receipt' })
  @ApiResponse({ status: 201, description: 'Receipt created' })
  @HttpCode(HttpStatus.CREATED)
  async createReceipt(@Req() req: any, @Body() dto: CreateStockReceiptDto) {
    this.requireInventoryRole(req);
    dto.branchId = this.scopeBranch(req, dto.branchId);
    await this.assertIngredientsInScope(req, (dto.items || []).map((item) => item.ingredientId));
    return this.inventoryService.createStockReceipt({
      ...dto,
      createdBy: dto.createdBy || this.resolveActor(req),
    });
  }

  @Post('stock/adjust')
  @ApiOperation({ summary: 'Adjust stock manually after stocktaking' })
  @ApiResponse({ status: 200, description: 'Stock adjusted' })
  @HttpCode(HttpStatus.OK)
  async adjustStock(@Req() req: any, @Body() dto: AdjustStockDto) {
    this.requireInventoryRole(req);
    dto.branchId = this.scopeBranch(req, dto.branchId);
    await this.assertIngredientsInScope(req, [dto.ingredientId]);
    return this.inventoryService.adjustStock({
      ...dto,
      createdBy: dto.createdBy || this.resolveActor(req),
    });
  }

  @Post('stock/export-bulk')
  @ApiOperation({ summary: 'Export stock in bulk (atomic)' })
  @ApiResponse({ status: 200, description: 'Stock exported in bulk' })
  @HttpCode(HttpStatus.OK)
  async exportBulk(@Req() req: any, @Body() dto: BulkExportStockDto) {
    this.requireInventoryRole(req);
    dto.branchId = this.scopeBranch(req, dto.branchId);
    await this.assertIngredientsInScope(req, (dto.items || []).map((item) => item.ingredientId));
    return this.inventoryService.exportStockBulk({
      ...dto,
      createdBy: dto.createdBy || this.resolveActor(req),
    });
  }

  @Get('stock/movements')
  @ApiOperation({ summary: 'Get stock movement history' })
  @ApiResponse({ status: 200, description: 'Stock movement list' })
  async getMovements(@Req() req: any, @Query() query: QueryMovementDto) {
    this.requireInventoryRole(req);
    query.branchId = this.scopeBranch(req, query.branchId);
    if (query.ingredientId) await this.assertIngredientsInScope(req, [query.ingredientId]);
    return this.inventoryService.getStockMovements(query);
  }

  @Post('sync-menu')
  @ApiOperation({ summary: 'Sync menu items as inventory ingredients' })
  @ApiResponse({ status: 200, description: 'Menu items synced to inventory' })
  @HttpCode(HttpStatus.OK)
  syncMenu(@Req() req: any, @Body() body: { branchId?: string; items: { id: string; name: string; unit?: string }[] }) {
    this.requireInventoryRole(req);
    return this.inventoryService.syncMenuItems(body.items || [], this.scopeBranch(req, body.branchId));
  }
}
