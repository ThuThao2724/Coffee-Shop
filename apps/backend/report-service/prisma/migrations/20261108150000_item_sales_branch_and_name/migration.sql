-- Branch and display name per item_sales row, so branch-scoped report chat ("mon ban chay") works
-- for managers and answers show the item name instead of its id.
ALTER TABLE "item_sales" ADD COLUMN "branchId" TEXT,
ADD COLUMN "menuItemName" TEXT;

-- CreateIndex
CREATE INDEX "item_sales_branchId_date_idx" ON "item_sales"("branchId", "date");
