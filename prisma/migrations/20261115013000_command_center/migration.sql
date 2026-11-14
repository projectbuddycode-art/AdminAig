-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'PASSWORD',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "customerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "machineId" TEXT,
    "jobId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceRecording" TEXT,
    "preset" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "storageMb" INTEGER,
    "exportDate" DATETIME,
    "outputRef" TEXT,
    "failureReason" TEXT,
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageEntry_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "demoLabel" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "NotificationMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "performedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineError_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "adminRole" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "customerId" TEXT,
    "machineRef" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ActivityLog" ("actorEmail", "actorId", "actorType", "createdAt", "event", "id", "metadata", "targetId", "targetType") SELECT "actorEmail", "actorId", "actorType", "createdAt", "event", "id", "metadata", "targetId", "targetType" FROM "ActivityLog";
DROP TABLE "ActivityLog";
ALTER TABLE "new_ActivityLog" RENAME TO "ActivityLog";
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_event_idx" ON "ActivityLog"("event");
CREATE INDEX "ActivityLog_targetType_targetId_idx" ON "ActivityLog"("targetType", "targetId");
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
CREATE INDEX "ActivityLog_tenant_idx" ON "ActivityLog"("tenant");
CREATE INDEX "ActivityLog_customerId_idx" ON "ActivityLog"("customerId");
CREATE TABLE "new_Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Admin" ("createdAt", "email", "id", "name", "passwordHash", "role", "status") SELECT "createdAt", "email", "id", "name", "passwordHash", "role", "status" FROM "Admin";
DROP TABLE "Admin";
ALTER TABLE "new_Admin" RENAME TO "Admin";
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE INDEX "Admin_status_idx" ON "Admin"("status");
CREATE INDEX "Admin_tenant_idx" ON "Admin"("tenant");
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "demoLabel" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "loginMethod" TEXT NOT NULL DEFAULT 'PASSWORD',
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "complimentaryCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Customer" ("createdAt", "email", "id", "name", "passwordHash", "phone", "status", "updatedAt") SELECT "createdAt", "email", "id", "name", "passwordHash", "phone", "status", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");
CREATE INDEX "Customer_tenant_idx" ON "Customer"("tenant");
CREATE TABLE "new_Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "firmwareVersion" TEXT,
    "model" TEXT NOT NULL DEFAULT 'DiamondCam',
    "serialNumber" TEXT,
    "hardwareRevision" TEXT,
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "motorConfig" TEXT NOT NULL DEFAULT '{}',
    "lightingConfig" TEXT NOT NULL DEFAULT '{}',
    "lastSeenAt" DATETIME,
    "telemetryVerified" BOOLEAN NOT NULL DEFAULT false,
    "telemetrySimulated" BOOLEAN NOT NULL DEFAULT false,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "demoLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Machine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Machine" ("createdAt", "customerId", "firmwareVersion", "id", "lastSeenAt", "machineId", "status", "updatedAt") SELECT "createdAt", "customerId", "firmwareVersion", "id", "lastSeenAt", "machineId", "status", "updatedAt" FROM "Machine";
DROP TABLE "Machine";
ALTER TABLE "new_Machine" RENAME TO "Machine";
CREATE UNIQUE INDEX "Machine_machineId_key" ON "Machine"("machineId");
CREATE INDEX "Machine_customerId_idx" ON "Machine"("customerId");
CREATE INDEX "Machine_status_idx" ON "Machine"("status");
CREATE INDEX "Machine_tenant_idx" ON "Machine"("tenant");
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "featuresJson" TEXT NOT NULL DEFAULT '{}',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Plan" ("createdAt", "description", "durationDays", "featuresJson", "id", "name", "status", "updatedAt") SELECT "createdAt", "description", "durationDays", "featuresJson", "id", "name", "status", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE INDEX "Plan_status_idx" ON "Plan"("status");
CREATE INDEX "Plan_tenant_idx" ON "Plan"("tenant");
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "renewalDate" DATETIME,
    "exportAllowance" INTEGER NOT NULL DEFAULT 0,
    "exportsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
    "snapshotFeaturesJson" TEXT NOT NULL DEFAULT '{}',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("createdAt", "customerId", "expiryDate", "id", "planId", "startDate", "status", "updatedAt") SELECT "createdAt", "customerId", "expiryDate", "id", "planId", "startDate", "status", "updatedAt" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE INDEX "Subscription_customerId_status_idx" ON "Subscription"("customerId", "status");
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX "Subscription_expiryDate_idx" ON "Subscription"("expiryDate");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_tenant_idx" ON "Subscription"("tenant");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LoginEvent_tenant_createdAt_idx" ON "LoginEvent"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_email_idx" ON "LoginEvent"("email");

-- CreateIndex
CREATE INDEX "LoginEvent_actorId_idx" ON "LoginEvent"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEntry_idempotencyKey_key" ON "UsageEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEntry_customerId_createdAt_idx" ON "UsageEntry"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEntry_status_idx" ON "UsageEntry"("status");

-- CreateIndex
CREATE INDEX "UsageEntry_tenant_idx" ON "UsageEntry"("tenant");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEntry_tenant_jobId_key" ON "UsageEntry"("tenant", "jobId");

-- CreateIndex
CREATE INDEX "Payment_tenant_createdAt_idx" ON "Payment"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationMessage_idempotencyKey_key" ON "NotificationMessage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationMessage_tenant_createdAt_idx" ON "NotificationMessage"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationMessage_customerId_idx" ON "NotificationMessage"("customerId");

-- CreateIndex
CREATE INDEX "NotificationMessage_status_idx" ON "NotificationMessage"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_machineId_idx" ON "MaintenanceRecord"("machineId");

-- CreateIndex
CREATE INDEX "MachineError_machineId_idx" ON "MachineError"("machineId");
