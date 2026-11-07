-- CreateEnum
CREATE TYPE "MenuOptionGroupType" AS ENUM ('SINGLE', 'MULTI', 'TEXT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('WAITING', 'PREPARING', 'DONE');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('ORDER', 'ITEM');

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "image" TEXT,
    "categoryId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'coffee',
    "customizations" JSONB,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_menu_items" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "customOptions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_option_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "MenuOptionGroupType" NOT NULL DEFAULT 'SINGLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_option_values" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_option_groups" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_ingredients" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientName" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "appliesTo" "PromotionScope" NOT NULL DEFAULT 'ORDER',
    "menuItemIds" JSONB,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "idempotencyKey" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "promotionCode" TEXT,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "note" TEXT,
    "options" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'WAITING',

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_items_categoryId_idx" ON "menu_items"("categoryId");

-- CreateIndex
CREATE INDEX "menu_items_available_idx" ON "menu_items"("available");

-- CreateIndex
CREATE INDEX "branch_menu_items_branchId_isAvailable_idx" ON "branch_menu_items"("branchId", "isAvailable");

-- CreateIndex
CREATE INDEX "branch_menu_items_menuItemId_idx" ON "branch_menu_items"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_menu_items_branchId_menuItemId_key" ON "branch_menu_items"("branchId", "menuItemId");

-- CreateIndex
CREATE INDEX "menu_categories_branchId_idx" ON "menu_categories"("branchId");

-- CreateIndex
CREATE INDEX "menu_categories_isActive_sortOrder_idx" ON "menu_categories"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_name_branchId_key" ON "menu_categories"("name", "branchId");

-- CreateIndex
CREATE INDEX "menu_option_groups_branchId_idx" ON "menu_option_groups"("branchId");

-- CreateIndex
CREATE INDEX "menu_option_groups_isActive_sortOrder_idx" ON "menu_option_groups"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "menu_option_values_groupId_isActive_sortOrder_idx" ON "menu_option_values"("groupId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "menu_option_values_groupId_value_key" ON "menu_option_values"("groupId", "value");

-- CreateIndex
CREATE INDEX "menu_item_option_groups_menuItemId_sortOrder_idx" ON "menu_item_option_groups"("menuItemId", "sortOrder");

-- CreateIndex
CREATE INDEX "menu_item_option_groups_groupId_idx" ON "menu_item_option_groups"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_option_groups_menuItemId_groupId_key" ON "menu_item_option_groups"("menuItemId", "groupId");

-- CreateIndex
CREATE INDEX "menu_item_ingredients_menuItemId_idx" ON "menu_item_ingredients"("menuItemId");

-- CreateIndex
CREATE INDEX "menu_item_ingredients_ingredientId_idx" ON "menu_item_ingredients"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_ingredients_menuItemId_ingredientId_key" ON "menu_item_ingredients"("menuItemId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_codes_code_key" ON "promotion_codes"("code");

-- CreateIndex
CREATE INDEX "promotion_codes_branchId_idx" ON "promotion_codes"("branchId");

-- CreateIndex
CREATE INDEX "promotion_codes_code_isActive_idx" ON "promotion_codes"("code", "isActive");

-- CreateIndex
CREATE INDEX "promotion_codes_appliesTo_isActive_idx" ON "promotion_codes"("appliesTo", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_tableId_idx" ON "orders"("tableId");

-- CreateIndex
CREATE INDEX "orders_branchId_idx" ON "orders"("branchId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_customerEmail_idx" ON "orders"("customerEmail");

-- CreateIndex
CREATE INDEX "orders_customerPhone_idx" ON "orders"("customerPhone");

-- CreateIndex
CREATE INDEX "orders_idempotencyKey_idx" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_menu_items" ADD CONSTRAINT "branch_menu_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_option_values" ADD CONSTRAINT "menu_option_values_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "menu_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_option_groups" ADD CONSTRAINT "menu_item_option_groups_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_option_groups" ADD CONSTRAINT "menu_item_option_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "menu_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

