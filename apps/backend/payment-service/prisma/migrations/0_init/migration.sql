-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'WAITING_TRANSFER', 'WAITING_CASH', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tableId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "transactionId" TEXT,
    "transferContent" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_transaction_id" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "void_reason" TEXT,
    "voided_at" TIMESTAMP(3),
    "created_by" TEXT,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_sequence" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_tax_config" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_tax_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_relay_events" (
    "id" SERIAL NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_relay_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_provider_idx" ON "payments"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_order_id_key" ON "invoice"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_invoice_number_key" ON "invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "invoice_branch_id_issue_date_idx" ON "invoice"("branch_id", "issue_date");

-- CreateIndex
CREATE INDEX "invoice_branch_id_status_idx" ON "invoice"("branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_sequence_branch_id_year_month_key" ON "invoice_sequence"("branch_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "branch_tax_config_branch_id_key" ON "branch_tax_config"("branch_id");

-- CreateIndex
CREATE INDEX "payment_relay_events_createdAt_idx" ON "payment_relay_events"("createdAt");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

