-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'PROFESSIONAL', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('AGREED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(16),
    "passwordHash" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "cityId" UUID,
    "avatarPath" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "regionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresLicense" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "categoryId" UUID NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("categoryId","locale")
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "biography" VARCHAR(3000) NOT NULL,
    "experienceDescription" VARCHAR(2000) NOT NULL DEFAULT '',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationEvidence" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "indicativePrice" DECIMAL(12,2),
    "currencyCode" CHAR(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "professionalId" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "zone" VARCHAR(100) NOT NULL DEFAULT '',

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("professionalId","cityId","zone")
);

-- CreateTable
CREATE TABLE "PortfolioImage" (
    "id" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "storagePath" TEXT NOT NULL,
    "description" VARCHAR(300),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "cityId" UUID NOT NULL,
    "approximateLocation" VARCHAR(120) NOT NULL,
    "budgetMin" DECIMAL(12,2),
    "budgetMax" DECIMAL(12,2),
    "currencyCode" CHAR(3) NOT NULL,
    "preferredDate" TIMESTAMPTZ,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestImage" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "estimatedPrice" DECIMAL(12,2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "estimatedDuration" VARCHAR(120) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "requestId" UUID,
    "proposalId" UUID,
    "directKey" TEXT,
    "title" VARCHAR(120) NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'AGREED',
    "agreedPrice" DECIMAL(12,2),
    "currencyCode" CHAR(3) NOT NULL,
    "professionalAgreedAt" TIMESTAMPTZ,
    "clientCompletedAt" TIMESTAMPTZ,
    "professionalCompletedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "requestId" UUID,
    "engagementId" UUID,
    "directKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "reviewedUserId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE',

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" VARCHAR(30) NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "reportId" UUID,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "resourceId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Region_countryCode_name_key" ON "Region"("countryCode", "name");

-- CreateIndex
CREATE INDEX "City_countryCode_name_idx" ON "City"("countryCode", "name");

-- CreateIndex
CREATE UNIQUE INDEX "City_regionId_name_key" ON "City"("regionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE INDEX "ProfessionalService_categoryId_active_idx" ON "ProfessionalService"("categoryId", "active");

-- CreateIndex
CREATE INDEX "ProfessionalService_professionalId_idx" ON "ProfessionalService"("professionalId");

-- CreateIndex
CREATE INDEX "ServiceArea_cityId_idx" ON "ServiceArea"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioImage_storagePath_key" ON "PortfolioImage"("storagePath");

-- CreateIndex
CREATE INDEX "PortfolioImage_professionalId_position_idx" ON "PortfolioImage"("professionalId", "position");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_categoryId_cityId_createdAt_idx" ON "ServiceRequest"("status", "categoryId", "cityId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_clientId_createdAt_idx" ON "ServiceRequest"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestImage_storagePath_key" ON "RequestImage"("storagePath");

-- CreateIndex
CREATE INDEX "RequestImage_requestId_idx" ON "RequestImage"("requestId");

-- CreateIndex
CREATE INDEX "Proposal_professionalId_status_idx" ON "Proposal"("professionalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_requestId_professionalId_key" ON "Proposal"("requestId", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_requestId_key" ON "Engagement"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_proposalId_key" ON "Engagement"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_directKey_key" ON "Engagement"("directKey");

-- CreateIndex
CREATE INDEX "Engagement_clientId_status_idx" ON "Engagement"("clientId", "status");

-- CreateIndex
CREATE INDEX "Engagement_professionalId_status_idx" ON "Engagement"("professionalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_engagementId_key" ON "Conversation"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Review_reviewedUserId_moderationStatus_createdAt_idx" ON "Review"("reviewedUserId", "moderationStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_engagementId_reviewerId_key" ON "Review"("engagementId", "reviewerId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceArea" ADD CONSTRAINT "ServiceArea_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestImage" ADD CONSTRAINT "RequestImage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedUserId_fkey" FOREIGN KEY ("reviewedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants remain enforced if an application transaction is bypassed.
CREATE UNIQUE INDEX "one_accepted_proposal_per_request" ON "Proposal" ("requestId") WHERE status = 'ACCEPTED';
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_range" CHECK (rating BETWEEN 1 AND 5), ADD CONSTRAINT "review_distinct_parties" CHECK ("reviewerId" <> "reviewedUserId");
ALTER TABLE "Engagement" ADD CONSTRAINT "engagement_distinct_parties" CHECK ("clientId" <> "professionalId"), ADD CONSTRAINT "engagement_nonnegative_price" CHECK ("agreedPrice" IS NULL OR "agreedPrice" >= 0);
ALTER TABLE "Proposal" ADD CONSTRAINT "proposal_nonnegative_price" CHECK ("estimatedPrice" >= 0);
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "service_nonnegative_price" CHECK ("indicativePrice" IS NULL OR "indicativePrice" >= 0);
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "request_valid_budget" CHECK (("budgetMin" IS NULL OR "budgetMin" >= 0) AND ("budgetMax" IS NULL OR "budgetMax" >= 0) AND ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMin" <= "budgetMax"));
ALTER TABLE "UserBlock" ADD CONSTRAINT "no_self_block" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Message" ADD CONSTRAINT "nonempty_message" CHECK (length(trim(body)) > 0);
ALTER TABLE "City" ADD CONSTRAINT "valid_coordinates" CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
