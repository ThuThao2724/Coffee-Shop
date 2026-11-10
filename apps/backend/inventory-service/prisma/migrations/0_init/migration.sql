-- CreateEnum
CREATE TYPE "StockType" AS ENUM ('IMPORT', 'EXPORT', 'ADJUST');

-- CreateEnum
CREATE TYPE "StockSource" AS ENUM ('MANUAL', 'RECEIPT', 'ORDER', 'STOCKTAKE', 'SYNC_MENU', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryBatchStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "importPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_inventory_policy" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_inventory_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "wastageRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_recipes" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "wastageRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "branchId" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "initialQty" DECIMAL(65,30) NOT NULL,
    "remainingQty" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "InventoryBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "StockType" NOT NULL,
    "source" "StockSource" NOT NULL DEFAULT 'MANUAL',
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "note" TEXT,
    "referenceCode" TEXT,
    "beforeStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "afterStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingredients_branchId_idx" ON "ingredients"("branchId");

-- CreateIndex
CREATE INDEX "ingredients_branchId_name_idx" ON "ingredients"("branchId", "name");

-- CreateIndex
CREATE INDEX "ingredients_name_idx" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "ingredients_isActive_idx" ON "ingredients"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_branchId_name_key" ON "ingredients"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "branch_inventory_policy_branchId_key" ON "branch_inventory_policy"("branchId");

-- CreateIndex
CREATE INDEX "recipes_menuItemId_idx" ON "recipes"("menuItemId");

-- CreateIndex
CREATE INDEX "recipes_ingredientId_idx" ON "recipes"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_menuItemId_ingredientId_key" ON "recipes"("menuItemId", "ingredientId");

-- CreateIndex
CREATE INDEX "branch_recipes_branchId_menuItemId_idx" ON "branch_recipes"("branchId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_recipes_branchId_menuItemId_ingredientId_key" ON "branch_recipes"("branchId", "menuItemId", "ingredientId");

-- CreateIndex
CREATE INDEX "purchase_orders_branchId_idx" ON "purchase_orders"("branchId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_createdAt_idx" ON "purchase_orders"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_ingredientId_idx" ON "purchase_order_items"("ingredientId");

-- CreateIndex
CREATE INDEX "inventory_batches_ingredientId_branchId_status_expiryDate_idx" ON "inventory_batches"("ingredientId", "branchId", "status", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_batches_branchId_expiryDate_idx" ON "inventory_batches"("branchId", "expiryDate");

-- CreateIndex
CREATE INDEX "stock_movements_ingredientId_idx" ON "stock_movements"("ingredientId");

-- CreateIndex
CREATE INDEX "stock_movements_branchId_idx" ON "stock_movements"("branchId");

-- CreateIndex
CREATE INDEX "stock_movements_branchId_createdAt_idx" ON "stock_movements"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_source_idx" ON "stock_movements"("source");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

