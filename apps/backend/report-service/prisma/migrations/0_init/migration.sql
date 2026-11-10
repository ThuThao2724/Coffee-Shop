-- CreateEnum
CREATE TYPE "AiAnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AiSentimentLabel" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateTable
CREATE TABLE "daily_revenue" (
    "date" TIMESTAMP(3) NOT NULL,
    "revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "item_sales" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "revenue" DECIMAL(65,30) NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "date" TIMESTAMP(3) NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "topItemMenuId" TEXT,
    "topItemQuantity" INTEGER,
    "topItemRevenue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "sales_forecast" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "granularity" TEXT NOT NULL DEFAULT 'daily',
    "predictedRevenue" DECIMAL(65,30) NOT NULL,
    "confidenceLow" DECIMAL(65,30),
    "confidenceHigh" DECIMAL(65,30),
    "confidence" DECIMAL(65,30),
    "modelVersion" TEXT,
    "mape" DECIMAL(65,30),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_recommendation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "targetItemId" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "modelVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_alert" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" "AiAnomalySeverity" NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "description" TEXT NOT NULL,
    "anomalyScore" DECIMAL(65,30),
    "explanation" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_analysis" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "originalText" TEXT NOT NULL,
    "label" "AiSentimentLabel" NOT NULL,
    "confidence" DECIMAL(65,30),
    "reason" TEXT,
    "modelVersion" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_query_log" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "generatedSql" TEXT,
    "sqlResult" JSONB,
    "answer" TEXT,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "isSuccessful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_query_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_log" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "endpoint" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "latencyMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_revenue_date_key" ON "daily_revenue"("date");

-- CreateIndex
CREATE INDEX "daily_revenue_date_idx" ON "daily_revenue"("date");

-- CreateIndex
CREATE INDEX "item_sales_date_idx" ON "item_sales"("date");

-- CreateIndex
CREATE INDEX "item_sales_menuItemId_idx" ON "item_sales"("menuItemId");

-- CreateIndex
CREATE INDEX "item_sales_date_menuItemId_idx" ON "item_sales"("date", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_date_key" ON "daily_stats"("date");

-- CreateIndex
CREATE INDEX "daily_stats_date_idx" ON "daily_stats"("date");

-- CreateIndex
CREATE INDEX "sales_forecast_branchId_forecastDate_idx" ON "sales_forecast"("branchId", "forecastDate");

-- CreateIndex
CREATE UNIQUE INDEX "sales_forecast_branchId_forecastDate_granularity_key" ON "sales_forecast"("branchId", "forecastDate", "granularity");

-- CreateIndex
CREATE INDEX "item_recommendation_branchId_sourceItemId_idx" ON "item_recommendation"("branchId", "sourceItemId");

-- CreateIndex
CREATE INDEX "item_recommendation_branchId_targetItemId_idx" ON "item_recommendation"("branchId", "targetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "item_recommendation_branchId_sourceItemId_targetItemId_key" ON "item_recommendation"("branchId", "sourceItemId", "targetItemId");

-- CreateIndex
CREATE INDEX "anomaly_alert_branchId_isResolved_idx" ON "anomaly_alert"("branchId", "isResolved");

-- CreateIndex
CREATE INDEX "anomaly_alert_branchId_detectedAt_idx" ON "anomaly_alert"("branchId", "detectedAt");

-- CreateIndex
CREATE INDEX "anomaly_alert_severity_alertType_idx" ON "anomaly_alert"("severity", "alertType");

-- CreateIndex
CREATE INDEX "sentiment_analysis_branchId_analyzedAt_idx" ON "sentiment_analysis"("branchId", "analyzedAt");

-- CreateIndex
CREATE INDEX "sentiment_analysis_branchId_label_idx" ON "sentiment_analysis"("branchId", "label");

-- CreateIndex
CREATE INDEX "chatbot_query_log_branchId_createdAt_idx" ON "chatbot_query_log"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "chatbot_query_log_userId_createdAt_idx" ON "chatbot_query_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_audit_log_createdAt_idx" ON "ai_audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "ai_audit_log_endpoint_createdAt_idx" ON "ai_audit_log"("endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "ai_audit_log_branchId_createdAt_idx" ON "ai_audit_log"("branchId", "createdAt");

