-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "lastLoginAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
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
    "lastLoginAt" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3),
    "complimentaryCredits" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "featuresJson" TEXT NOT NULL DEFAULT '{}',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "priceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "expiryDate" TIMESTAMPTZ(3) NOT NULL,
    "renewalDate" TIMESTAMPTZ(3),
    "exportAllowance" INTEGER NOT NULL DEFAULT 0,
    "exportsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
    "snapshotFeaturesJson" TEXT NOT NULL DEFAULT '{}',
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snapshotFeaturesJson" TEXT NOT NULL,
    "priceAmount" DECIMAL(12,2) NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "reason" TEXT,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
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
    "lastSeenAt" TIMESTAMPTZ(3),
    "telemetryVerified" BOOLEAN NOT NULL DEFAULT false,
    "telemetrySimulated" BOOLEAN NOT NULL DEFAULT false,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "demoLabel" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineAssignment" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "MachineAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineFirmwareHistory" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineFirmwareHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineConfigRevision" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "motorConfig" TEXT NOT NULL,
    "lightingConfig" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineConfigRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEntry" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "machineId" TEXT,
    "processingJobId" TEXT,
    "jobId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceRecording" TEXT,
    "preset" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "durationMs" INTEGER,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "storageMb" INTEGER,
    "exportDate" TIMESTAMPTZ(3),
    "outputRef" TEXT,
    "failureReason" TEXT,
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSession" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "machineId" TEXT,
    "sessionKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "storageMb" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "machineId" TEXT,
    "recordingSessionId" TEXT,
    "jobKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "processingJobId" TEXT,
    "usageEntryId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "outputRef" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "demoLabel" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationMessage" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "NotificationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "note" TEXT NOT NULL,
    "performedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineError" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'production',
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_key_key" ON "Tenant"("key");

-- CreateIndex
CREATE INDEX "TenantMembership_adminId_idx" ON "TenantMembership"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_tenantId_adminId_key" ON "TenantMembership"("tenantId", "adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_status_idx" ON "Admin"("status");

-- CreateIndex
CREATE INDEX "Admin_tenant_idx" ON "Admin"("tenant");

-- CreateIndex
CREATE INDEX "Admin_deletedAt_idx" ON "Admin"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_tenant_idx" ON "Customer"("tenant");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_customerId_key" ON "CustomerProfile"("customerId");

-- CreateIndex
CREATE INDEX "Plan_status_idx" ON "Plan"("status");

-- CreateIndex
CREATE INDEX "Plan_tenant_idx" ON "Plan"("tenant");

-- CreateIndex
CREATE INDEX "Plan_deletedAt_idx" ON "Plan"("deletedAt");

-- CreateIndex
CREATE INDEX "Subscription_customerId_status_idx" ON "Subscription"("customerId", "status");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_expiryDate_idx" ON "Subscription"("expiryDate");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_tenant_idx" ON "Subscription"("tenant");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_subscriptionId_recordedAt_idx" ON "SubscriptionHistory"("subscriptionId", "recordedAt");

-- CreateIndex
CREATE INDEX "SubscriptionHistory_tenant_recordedAt_idx" ON "SubscriptionHistory"("tenant", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineId_key" ON "Machine"("machineId");

-- CreateIndex
CREATE INDEX "Machine_customerId_idx" ON "Machine"("customerId");

-- CreateIndex
CREATE INDEX "Machine_status_idx" ON "Machine"("status");

-- CreateIndex
CREATE INDEX "Machine_tenant_idx" ON "Machine"("tenant");

-- CreateIndex
CREATE INDEX "Machine_deletedAt_idx" ON "Machine"("deletedAt");

-- CreateIndex
CREATE INDEX "MachineAssignment_machineId_status_idx" ON "MachineAssignment"("machineId", "status");

-- CreateIndex
CREATE INDEX "MachineAssignment_customerId_status_idx" ON "MachineAssignment"("customerId", "status");

-- CreateIndex
CREATE INDEX "MachineAssignment_tenant_idx" ON "MachineAssignment"("tenant");

-- CreateIndex
CREATE INDEX "MachineFirmwareHistory_machineId_recordedAt_idx" ON "MachineFirmwareHistory"("machineId", "recordedAt");

-- CreateIndex
CREATE INDEX "MachineConfigRevision_machineId_recordedAt_idx" ON "MachineConfigRevision"("machineId", "recordedAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_event_idx" ON "ActivityLog"("event");

-- CreateIndex
CREATE INDEX "ActivityLog_targetType_targetId_idx" ON "ActivityLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_tenant_idx" ON "ActivityLog"("tenant");

-- CreateIndex
CREATE INDEX "ActivityLog_customerId_idx" ON "ActivityLog"("customerId");

-- CreateIndex
CREATE INDEX "LoginEvent_tenant_createdAt_idx" ON "LoginEvent"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_email_idx" ON "LoginEvent"("email");

-- CreateIndex
CREATE INDEX "LoginEvent_actorId_idx" ON "LoginEvent"("actorId");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenant_createdAt_idx" ON "SecurityEvent"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_email_idx" ON "SecurityEvent"("email");

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
CREATE INDEX "RecordingSession_customerId_startedAt_idx" ON "RecordingSession"("customerId", "startedAt");

-- CreateIndex
CREATE INDEX "RecordingSession_tenant_idx" ON "RecordingSession"("tenant");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSession_tenant_sessionKey_key" ON "RecordingSession"("tenant", "sessionKey");

-- CreateIndex
CREATE INDEX "ProcessingJob_customerId_startedAt_idx" ON "ProcessingJob"("customerId", "startedAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- CreateIndex
CREATE INDEX "ProcessingJob_tenant_idx" ON "ProcessingJob"("tenant");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingJob_tenant_jobKey_key" ON "ProcessingJob"("tenant", "jobKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExportRecord_usageEntryId_key" ON "ExportRecord"("usageEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExportRecord_idempotencyKey_key" ON "ExportRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExportRecord_tenant_createdAt_idx" ON "ExportRecord"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "ExportRecord_customerId_idx" ON "ExportRecord"("customerId");

-- CreateIndex
CREATE INDEX "ExportRecord_status_idx" ON "ExportRecord"("status");

-- CreateIndex
CREATE INDEX "Payment_tenant_createdAt_idx" ON "Payment"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Refund_tenant_createdAt_idx" ON "Refund"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationMessage_idempotencyKey_key" ON "NotificationMessage"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationMessage_tenant_createdAt_idx" ON "NotificationMessage"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationMessage_customerId_idx" ON "NotificationMessage"("customerId");

-- CreateIndex
CREATE INDEX "NotificationMessage_status_idx" ON "NotificationMessage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_attempt_key" ON "NotificationDelivery"("notificationId", "attempt");

-- CreateIndex
CREATE INDEX "SupportTicket_tenant_status_idx" ON "SupportTicket"("tenant", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_customerId_idx" ON "SupportTicket"("customerId");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_idx" ON "SupportTicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "IntegrationConfig_tenant_idx" ON "IntegrationConfig"("tenant");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_tenant_provider_key" ON "IntegrationConfig"("tenant", "provider");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_machineId_idx" ON "MaintenanceRecord"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_tenant_createdAt_idx" ON "MaintenanceRecord"("tenant", "createdAt");

-- CreateIndex
CREATE INDEX "MachineError_machineId_idx" ON "MachineError"("machineId");

-- CreateIndex
CREATE INDEX "MachineError_tenant_createdAt_idx" ON "MachineError"("tenant", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAssignment" ADD CONSTRAINT "MachineAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAssignment" ADD CONSTRAINT "MachineAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineFirmwareHistory" ADD CONSTRAINT "MachineFirmwareHistory_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConfigRevision" ADD CONSTRAINT "MachineConfigRevision_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEntry" ADD CONSTRAINT "UsageEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEntry" ADD CONSTRAINT "UsageEntry_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEntry" ADD CONSTRAINT "UsageEntry_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "ProcessingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_recordingSessionId_fkey" FOREIGN KEY ("recordingSessionId") REFERENCES "RecordingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "ProcessingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportRecord" ADD CONSTRAINT "ExportRecord_usageEntryId_fkey" FOREIGN KEY ("usageEntryId") REFERENCES "UsageEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationMessage" ADD CONSTRAINT "NotificationMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "NotificationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineError" ADD CONSTRAINT "MachineError_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
