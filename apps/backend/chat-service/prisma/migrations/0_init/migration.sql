-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'STAFF');

-- CreateTable
CREATE TABLE "chat_session" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "startedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_session_branchId_status_idx" ON "chat_session"("branchId", "status");

-- CreateIndex
CREATE INDEX "chat_session_tableId_status_idx" ON "chat_session"("tableId", "status");

-- CreateIndex
CREATE INDEX "chat_message_sessionId_createdAt_idx" ON "chat_message"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_log_branchId_isRead_createdAt_idx" ON "notification_log"("branchId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notification_log_userId_isRead_idx" ON "notification_log"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

