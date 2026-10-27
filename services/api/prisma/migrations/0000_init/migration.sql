-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'DELIVERED', 'APPROVED', 'DISPUTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('NON_DELIVERY', 'POOR_QUALITY', 'INCOMPLETE_REQUIREMENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('NEW_DEVICE_DETECTED', 'GEO_IMPOSSIBLE_TRAVEL', 'EXCESSIVE_SUBNET_SPREAD', 'DEVICE_TRUSTED', 'DEVICE_REVOKED', 'STRIKE_ISSUED', 'STRIKE_TWO_REACHED', 'STRIKE_THREE_REACHED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REINSTATED', 'ESCROW_COOLDOWN_STARTED', 'ESCROW_COOLDOWN_EXPIRED', 'COOLDOWN_BYPASS_2FA', 'PASSWORD_CHANGED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED');

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('ALGERIA', 'EGYPT', 'MOROCCO', 'TUNISIA', 'LIBYA');

-- CreateEnum
CREATE TYPE "City" AS ENUM ('ALGIERS', 'ORAN', 'CONSTANTINE', 'ANNABA', 'BLIDA', 'BATNA', 'DJELFA', 'SETIF', 'SIDI_BEL_ABBES', 'BISKRA', 'TEBESSA', 'EL_OUED', 'SKIKDA', 'TIARET', 'BEJAIA', 'TLEMCEN', 'OUARGLA', 'MOSTAGANEM', 'MSILA', 'GHARDAIA', 'CAIRO', 'ALEXANDRIA', 'GIZA', 'PORT_SAID', 'SUEZ', 'CASABLANCA', 'RABAT', 'MARRAKESH', 'TANGIER', 'FES', 'TUNIS', 'SFAX', 'SOUSSE', 'ETTADHAMEN', 'KAIROUAN', 'TRIPOLI', 'BENGHAZI', 'MISRATA', 'SIRTE', 'SABHA');

-- CreateEnum
CREATE TYPE "OrganizationSector" AS ENUM ('TECHNOLOGY_AND_SOFTWARE', 'BANKING_AND_FINANCIAL_SERVICES', 'HEALTHCARE_AND_PHARMACEUTICALS', 'ENERGY_AND_OIL_AND_GAS', 'AUTOMOTIVE_AND_MANUFACTURING', 'RETAIL_AND_CONSUMER_GOODS', 'TELECOMMUNICATIONS', 'AEROSPACE_AND_DEFENSE', 'AGRICULTURE_AND_FOOD_PRODUCTION', 'TRANSPORTATION_AND_LOGISTICS');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'BUSINESS', 'FREELANCER', 'ADMIN', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'GITHUB', 'LINKEDIN', 'PHONE');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('KPI', 'METRIC', 'BAR', 'LINE', 'AREA', 'PIE', 'SCATTER', 'BUBBLE', 'HISTOGRAM', 'TABLE', 'HEATMAP', 'SANKEY', 'RADAR', 'FUNNEL', 'MAP', 'TREEMAP', 'GAUGE', 'CUSTOM', 'CHART');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('COURSE_PURCHASE', 'PATH_PURCHASE', 'STUDENT_SUBSCRIPTION', 'BI_SUBSCRIPTION', 'CONTRACT_PAYMENT', 'REFUND', 'LIVE_SESSION_PURCHASE', 'LIVE_SESSION_REFUND', 'CERTIFICATE_PURCHASE', 'PODAPOINT_PURCHASE', 'FEATURE_PURCHASE', 'FREELANCER_SUBSCRIPTION', 'BUSINESS_SUBSCRIPTION', 'DEPOSIT', 'CONTRACT_ESCROW', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('CHARGILY', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('CHARGILY', 'MOCK', 'SATIM', 'CIB', 'EDAHABIA');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_CANCELED', 'PAYMENT_REFUNDED', 'PAYMENT_DISPUTED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STUDENT_STARTER', 'STUDENT_PLUS', 'STUDENT_PRO', 'BI_GROWTH', 'BI_SCALE', 'BI_ELITE', 'CUSTOM', 'FREELANCER_PLUS', 'FREELANCER_PREMIUM', 'BUSINESS_STARTER', 'BUSINESS_PRO', 'BUSINESS_ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED', 'GRACE_PERIOD', 'PENDING_PAYMENT');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SectionVisibility" AS ENUM ('INHERIT', 'PUBLIC', 'CONNECTIONS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('ERROR', 'WARN', 'INFO', 'DEBUG');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('WEB', 'MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SECURITY', 'PROJECT', 'COURSE', 'MARKETING', 'SYSTEM', 'BILLING');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "FreelancerTier" AS ENUM ('NEW', 'STANDARD', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'VERIFIED', 'CONVERTED', 'BOUNCED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('FREE_MONTH', 'FREE_YEAR', 'DISCOUNT_50', 'DISCOUNT_25', 'EARLY_ACCESS', 'BADGE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('FREELANCE', 'EDUCATION', 'SYSTEM', 'BI_COLLABORATION', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('CLIENT', 'FREELANCER', 'INSTRUCTOR', 'STUDENT', 'ADMIN', 'MEMBER', 'OWNER', 'MODERATOR', 'SUPPORT_AGENT', 'GUEST');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE', 'SYSTEM', 'TYPING_INDICATOR', 'REACTION');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('ACTIVE', 'REDACTED', 'PENDING_APPEAL');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('CLIENT_TO_FREELANCER', 'FREELANCER_TO_CLIENT');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TierCategory" AS ENUM ('EDTECH', 'BI');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('GENERAL', 'BILLING', 'TECHNICAL', 'ACCOUNT', 'COURSE_CONTENT', 'FREELANCING', 'FEATURE_REQUEST', 'BUG_REPORT');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveSessionVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "LiveSessionType" AS ENUM ('COURSE', 'MEETING');

-- CreateEnum
CREATE TYPE "LiveSessionParticipantRole" AS ENUM ('HOST', 'CO_HOST', 'PARTICIPANT');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "podaPoints" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PODAPOINT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTopUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowHold" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "status" TEXT NOT NULL DEFAULT 'HOLD',
    "releaseConditions" JSONB,
    "scheduledReleaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "releasedAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EscrowHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "previousBalance" INTEGER NOT NULL,
    "newBalance" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "referenceId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tier" "FreelancerTier" NOT NULL DEFAULT 'NEW',
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "completedProjects" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "featuredUntil" TIMESTAMP(3),
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "skillPassportVerified" BOOLEAN NOT NULL DEFAULT false,
    "skillPassportVerifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelancerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "headline" TEXT,
    "learningGoals" TEXT,
    "careerPath" TEXT,
    "totalLearningHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedCourses" INTEGER NOT NULL DEFAULT 0,
    "averageQuizScore" DOUBLE PRECISION,
    "bestSubject" TEXT,
    "badges" JSONB,
    "wishlist" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "headline" TEXT,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "totalCourses" INTEGER NOT NULL DEFAULT 0,
    "totalCourseHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION,
    "responseTimeHours" INTEGER,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credentials" JSONB,
    "workExperience" JSONB,
    "publications" JSONB,
    "teachingCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featuredCourseId" INTEGER,
    "instructorSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCourseUpdate" TIMESTAMP(3),
    "satisfactionRate" DOUBLE PRECISION,
    "curriculumVitae" TEXT,
    "researchInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "headline" TEXT,
    "companyRole" TEXT,
    "department" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "yearsOfExperience" INTEGER,
    "areasOfExpertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedIn" TEXT,
    "portfolioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerService" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "pricingType" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "basicPrice" DOUBLE PRECISION,
    "basicDescription" TEXT,
    "standardPrice" DOUBLE PRECISION,
    "standardDescription" TEXT,
    "premiumPrice" DOUBLE PRECISION,
    "premiumDescription" TEXT,
    "deliveryDays" INTEGER,
    "revisions" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "video" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBoosted" BOOLEAN NOT NULL DEFAULT false,
    "boostExpiresAt" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faq" JSONB,
    "requirements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelancerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEndorsement" (
    "id" SERIAL NOT NULL,
    "skillName" TEXT NOT NULL,
    "endorserId" INTEGER NOT NULL,
    "endorsedId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEndorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFollow" (
    "id" SERIAL NOT NULL,
    "followerId" INTEGER NOT NULL,
    "followingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" SERIAL NOT NULL,
    "blockerId" INTEGER NOT NULL,
    "blockedId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgProfile" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "longDescription" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fundingRound" TEXT,
    "fundingAmount" DOUBLE PRECISION,
    "revenueRange" TEXT,
    "products" JSONB,
    "jobs" JSONB,
    "culture" TEXT,
    "benefits" TEXT,
    "mission" TEXT,
    "achievements" JSONB,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mapLocation" JSONB,
    "algerianHealthScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgReview" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "isRecommended" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgFollow" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicDashboard" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "embedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "method" "PaymentProvider" NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "accountHolderName" TEXT,
    "accountNumber" TEXT,
    "adminNotes" TEXT,
    "bankName" TEXT,
    "batchId" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "slug" TEXT,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "headline" TEXT,
    "tagline" TEXT,
    "pronouns" TEXT,
    "deletedAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phoneNumber" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerifiedAt" TIMESTAMP(3),
    "primaryOrganizationId" INTEGER,
    "profilePictureUrl" TEXT,
    "coverImageUrl" TEXT,
    "provider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "providerId" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialLinks" JSONB,
    "availability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "timezone" TEXT,
    "profileViewCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "subscribeNewsletter" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeactivated" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "deactivatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastPasswordChangeAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "country" "Country",
    "city" "City",
    "securityStrikes" INTEGER NOT NULL DEFAULT 0,
    "accountRestricted" BOOLEAN NOT NULL DEFAULT false,
    "accountRestrictedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsernameRedirect" (
    "id" SERIAL NOT NULL,
    "oldUsername" TEXT NOT NULL,
    "newUserId" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsernameRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservedUsername" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ReservedUsername_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAnswer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT,
    "primaryGoal" TEXT,
    "experienceLevel" TEXT,
    "fieldOfInterest" TEXT,
    "weeklyTime" TEXT,
    "discoverySource" TEXT,
    "openAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "ownerId" INTEGER,
    "city" "City" NOT NULL DEFAULT 'ALGIERS',
    "sector" "OrganizationSector" NOT NULL DEFAULT 'TECHNOLOGY_AND_SOFTWARE',
    "country" "Country" NOT NULL DEFAULT 'ALGERIA',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "inviterId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT,
    "invitedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Path" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "price" JSONB,
    "thumbnailUrl" TEXT,

    CONSTRAINT "Path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fullDescription" TEXT,
    "durationMinutes" INTEGER,
    "estimatedEffort" TEXT,
    "totalLessons" INTEGER DEFAULT 0,
    "level" TEXT,
    "instructorId" INTEGER,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "reviewedBy" INTEGER,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3),
    "price" JSONB,
    "thumbnailUrl" TEXT,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathModule" (
    "id" SERIAL NOT NULL,
    "pathId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER,

    CONSTRAINT "PathModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER,
    "type" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "videoUrl" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'supabase',
    "hlsPath" TEXT,
    "rawPath" TEXT,
    "transcodingStatus" TEXT,
    "transcript" TEXT,
    "subtitlesPath" TEXT,
    "subtitlesLanguage" TEXT DEFAULT 'ar',
    "subtitlesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "attachments" JSONB,
    "quizId" INTEGER,
    "requiredPassScore" INTEGER,
    "order" INTEGER NOT NULL,
    "thumbnailUrl" TEXT,
    "thumbnailBlurDataURL" TEXT,
    "learningObjectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyTakeaways" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instructorNotes" TEXT,
    "estimatedCompletionTime" INTEGER,
    "difficulty" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedResources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "moduleId" TEXT,
    "pathId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "transactionId" INTEGER,
    "certificateId" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "lessonId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" SERIAL NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 90,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "allowRetake" BOOLEAN NOT NULL DEFAULT true,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "retakeCooldownMinutes" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "questionType" "QuizQuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "options" JSONB,
    "correctAnswer" TEXT,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "quizId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpent" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizUserAnswer" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedAnswer" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "pointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QuizUserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "moduleId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "pathId" TEXT,
    "certificateId" TEXT NOT NULL,
    "digitalSignature" TEXT,
    "qrCodeUrl" TEXT,
    "revokedAt" TIMESTAMP(3),
    "verificationUrl" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "organizationId" INTEGER,
    "ownerId" INTEGER,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "featureExpiresAt" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "freelancerId" INTEGER,
    "message" TEXT,
    "amount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "freelancerId" INTEGER,
    "clientId" INTEGER,
    "terms" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "freelancerProfileId" INTEGER,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "description" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "files" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "milestoneId" INTEGER,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractMilestone" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "dueDate" TIMESTAMP(3),
    "deliverables" JSONB,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),

    CONSTRAINT "ContractMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "checkoutUrl" TEXT,
    "commission" INTEGER,
    "contractId" INTEGER,
    "escrowHoldId" INTEGER,
    "freelancerPayout" INTEGER,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'MOCK',
    "gatewayMetadata" JSONB,
    "lastWebhookAttemptAt" TIMESTAMP(3),
    "metadata" JSONB,
    "netAmount" INTEGER,
    "parentTransactionId" INTEGER,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'CHARGILY',
    "providerReference" TEXT,
    "purpose" "PaymentPurpose" NOT NULL,
    "subscriptionId" INTEGER,
    "walletId" INTEGER,
    "webhookAttempts" INTEGER NOT NULL DEFAULT 0,
    "webhookUrl" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "plan" "SubscriptionPlan" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethodId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEntitlement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "entitlementType" TEXT NOT NULL,
    "resourceId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionCalculation" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "freelancerTier" "FreelancerTier" NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commission" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "tierJustification" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "CommissionCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionTierHistory" (
    "id" SERIAL NOT NULL,
    "freelancerId" INTEGER NOT NULL,
    "tier" "FreelancerTier" NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "completedProjects" INTEGER NOT NULL,
    "totalEarned" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "CommissionTierHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRevenue" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "referenceId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementCache" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'CHARGILY',
    "providerType" TEXT NOT NULL,
    "providerId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "filePath" TEXT,
    "metadata" JSONB,
    "name" TEXT NOT NULL,
    "organizationId" INTEGER,
    "previewRows" JSONB,
    "processingStatus" "DatasetStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "schema_" JSONB,
    "columnCount" INTEGER,
    "columns" JSONB,
    "domain" TEXT,
    "fileSize" INTEGER,
    "format" TEXT,
    "originalFilename" TEXT,
    "processedAt" TIMESTAMP(3),
    "qualityScore" DOUBLE PRECISION,
    "rowCount" INTEGER,
    "status" TEXT,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "organizationId" INTEGER,
    "ownerId" INTEGER,
    "config" JSONB,
    "layout" JSONB,
    "theme" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardDataset" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Widget" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER,
    "datasetId" INTEGER,
    "type" "WidgetType" NOT NULL,
    "config" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "description" TEXT,
    "h" INTEGER NOT NULL DEFAULT 4,
    "minH" INTEGER,
    "minW" INTEGER,
    "name" TEXT,
    "w" INTEGER NOT NULL DEFAULT 4,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" SERIAL NOT NULL,
    "dashboardId" INTEGER NOT NULL,
    "userId" INTEGER,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLModel" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "creatorId" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "modelPath" TEXT,
    "metrics" JSONB,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MLModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "impactLevel" TEXT NOT NULL DEFAULT 'medium',
    "rationale" TEXT,
    "expectedOutcome" TEXT,
    "actualOutcome" TEXT,
    "datasetId" INTEGER,
    "ownerId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionHistory" (
    "id" SERIAL NOT NULL,
    "decisionId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "changedById" INTEGER NOT NULL,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionComment" (
    "id" SERIAL NOT NULL,
    "decisionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dashboardId" INTEGER,
    "format" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL DEFAULT 'manual',
    "scheduleCron" TEXT,
    "scheduleInterval" INTEGER,
    "recipients" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRun" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityIssue" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "columnName" TEXT,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedRows" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAssessment" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "completeness" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "consistency" DOUBLE PRECISION,
    "validity" DOUBLE PRECISION,
    "issuesCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageTracking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "metricType" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionId" INTEGER,

    CONSTRAINT "UsageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "category" "NotificationCategory",
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "expiresAt" TIMESTAMP(3),
    "inAppDelivered" BOOLEAN NOT NULL DEFAULT false,
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "pushSentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "opponentId" INTEGER NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB,
    "resolutionNotes" TEXT,
    "resolutionReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "autoResolvedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "milestoneId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "digestTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryPreferences" JSONB,
    "digestDay" INTEGER,
    "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
    "digestTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "contentType" TEXT,
    "category" TEXT,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER,
    "currency" TEXT,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppearanceSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "fontSize" TEXT NOT NULL DEFAULT 'medium',
    "density" TEXT NOT NULL DEFAULT 'comfortable',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppearanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacySettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "searchVisibility" BOOLEAN NOT NULL DEFAULT true,
    "activityStatus" BOOLEAN NOT NULL DEFAULT true,
    "readReceipts" BOOLEAN NOT NULL DEFAULT true,
    "showBio" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showSkills" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showPortfolio" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showCertificates" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showReviews" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showEnrollments" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showContactInfo" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showOrganization" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showTagline" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showHeadline" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showPronouns" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showAvailability" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showRating" "SectionVisibility" NOT NULL DEFAULT 'INHERIT',
    "showEmail" BOOLEAN NOT NULL DEFAULT false,
    "showPhone" BOOLEAN NOT NULL DEFAULT false,
    "showLastActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIntegration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailOtpVerified" BOOLEAN NOT NULL DEFAULT false,
    "webauthnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loginAlerts" BOOLEAN NOT NULL DEFAULT true,
    "deviceManagement" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 24,
    "lastPasswordChange" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOtpCode" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "platform" TEXT,
    "browserName" TEXT,
    "browserVersion" TEXT,
    "osVersion" TEXT,
    "deviceModel" TEXT,
    "screenResolution" TEXT,
    "lastKnownIp" TEXT,
    "lastKnownWilaya" TEXT,
    "lastKnownSubnet" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" "SecurityEventType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "wilaya" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCooldown" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "cooldownType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bypassedAt" TIMESTAMP(3),
    "bypassMethod" TEXT,

    CONSTRAINT "DeviceCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvancedSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "apiAccess" BOOLEAN NOT NULL DEFAULT false,
    "webhooks" BOOLEAN NOT NULL DEFAULT false,
    "dataExport" BOOLEAN NOT NULL DEFAULT false,
    "debugMode" BOOLEAN NOT NULL DEFAULT false,
    "performanceMode" BOOLEAN NOT NULL DEFAULT false,
    "cacheSize" INTEGER NOT NULL DEFAULT 500,
    "logLevel" "LogLevel" NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvancedSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "format" TEXT NOT NULL DEFAULT 'JSON',

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT,
    "feedback" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verifications" (
    "id" SERIAL NOT NULL,
    "phone_number" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredById" INTEGER,
    "friendsReferredCount" INTEGER NOT NULL DEFAULT 0,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
    "lastDripSentAt" TIMESTAMP(3),
    "convertedToUserId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistReferralMilestone" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "referralsRequired" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "rewardType" "ReferralRewardType" NOT NULL DEFAULT 'FREE_MONTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistReferralMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER,
    "eventType" "WebhookEventType" NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "userId" INTEGER,
    "transactionId" INTEGER,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "responseCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" SERIAL NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'FREELANCE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "title" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "lastReadMessageId" TEXT,
    "mutedUntil" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "deletedById" INTEGER,
    "editedById" INTEGER,
    "replyToId" INTEGER,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" INTEGER NOT NULL,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReadReceipt" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractReview" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reviewType" "ReviewType" NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "subRatings" JSONB NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAppeal" (
    "id" SERIAL NOT NULL,
    "reviewId" INTEGER NOT NULL,
    "appealerId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" SERIAL NOT NULL,
    "reviewId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReview" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "moduleId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiAuditLog" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "BiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossPillarEvent" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "pillarSource" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossPillarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SubscriptionTierConfig" (
    "id" SERIAL NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "category" "TierCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "yearlyPrice" INTEGER,
    "maxCourses" INTEGER,
    "maxStorage" INTEGER,
    "maxStudents" INTEGER,
    "maxDatasets" INTEGER,
    "maxDashboards" INTEGER,
    "maxApiCalls" INTEGER,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionTierConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRateConfig" (
    "id" SERIAL NOT NULL,
    "tier" "FreelancerTier" NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL,
    "minProject" INTEGER,
    "maxProject" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "id" SERIAL NOT NULL,
    "gateway" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "config" JSONB,
    "supportedCurrencies" TEXT[] DEFAULT ARRAY['DZD']::TEXT[],
    "minAmount" INTEGER,
    "maxAmount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'general',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformLimitsConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" INTEGER NOT NULL,
    "unit" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformLimitsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationConfig" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "providerName" TEXT,
    "config" JSONB,
    "rateLimitPerHour" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'auth',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" "TicketCategory" NOT NULL DEFAULT 'GENERAL',
    "slaResponseDeadline" TIMESTAMP(3),
    "slaResolutionDeadline" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "csatScore" INTEGER,
    "csatFeedback" TEXT,
    "csatSubmittedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedInsight" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'health',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SharedInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "type" "LiveSessionType" NOT NULL DEFAULT 'COURSE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visibility" "LiveSessionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "ownerId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "maxParticipants" INTEGER DEFAULT 100,
    "priceAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "roomName" TEXT,
    "roomSid" TEXT,
    "roomMetadata" JSONB,
    "recordingUrl" TEXT,
    "replayUrl" TEXT,
    "replayExpiresAt" TIMESTAMP(3),
    "transactionId" INTEGER,
    "moduleId" TEXT,
    "lessonId" TEXT,
    "contractId" INTEGER,
    "orgOnly" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionModuleLink" (
    "id" SERIAL NOT NULL,
    "moduleId" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSessionModuleLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionParticipant" (
    "id" SERIAL NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "LiveSessionParticipantRole" NOT NULL DEFAULT 'PARTICIPANT',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "attendancePct" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionBooking" (
    "id" SERIAL NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "transactionId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "cancelledAt" TIMESTAMP(3),
    "refundProcessed" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN,
    "hostCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionWaitlist" (
    "id" SERIAL NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSessionWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionChatMessage" (
    "id" SERIAL NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSessionChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionReview" (
    "id" SERIAL NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSessionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionCoHost" (
    "id" SERIAL NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSessionCoHost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostCoupon" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "liveSessionId" TEXT,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HostCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" INTEGER NOT NULL,
    "minPurchaseAmount" INTEGER,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 100,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsagesPerUser" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applicablePlans" JSONB,
    "applicableProducts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturePurchase" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "featureKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "referenceId" TEXT,
    "walletTransactionId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_organizationId_key" ON "Wallet"("organizationId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_organizationId_idx" ON "Wallet"("organizationId");

-- CreateIndex
CREATE INDEX "Wallet_podaPoints_idx" ON "Wallet"("podaPoints");

-- CreateIndex
CREATE INDEX "Wallet_isActive_idx" ON "Wallet"("isActive");

-- CreateIndex
CREATE INDEX "Wallet_createdAt_idx" ON "Wallet"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowHold_contractId_key" ON "EscrowHold"("contractId");

-- CreateIndex
CREATE INDEX "EscrowHold_contractId_idx" ON "EscrowHold"("contractId");

-- CreateIndex
CREATE INDEX "EscrowHold_walletId_idx" ON "EscrowHold"("walletId");

-- CreateIndex
CREATE INDEX "EscrowHold_status_idx" ON "EscrowHold"("status");

-- CreateIndex
CREATE INDEX "EscrowHold_scheduledReleaseAt_idx" ON "EscrowHold"("scheduledReleaseAt");

-- CreateIndex
CREATE INDEX "EscrowHold_createdAt_idx" ON "EscrowHold"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceId_idx" ON "WalletTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_purpose_idx" ON "WalletTransaction"("purpose");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerProfile_userId_key" ON "FreelancerProfile"("userId");

-- CreateIndex
CREATE INDEX "FreelancerProfile_userId_idx" ON "FreelancerProfile"("userId");

-- CreateIndex
CREATE INDEX "FreelancerProfile_tier_idx" ON "FreelancerProfile"("tier");

-- CreateIndex
CREATE INDEX "FreelancerProfile_commissionRate_idx" ON "FreelancerProfile"("commissionRate");

-- CreateIndex
CREATE INDEX "FreelancerProfile_completedProjects_idx" ON "FreelancerProfile"("completedProjects");

-- CreateIndex
CREATE INDEX "FreelancerProfile_isVerified_idx" ON "FreelancerProfile"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_userId_idx" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorProfile_userId_key" ON "InstructorProfile"("userId");

-- CreateIndex
CREATE INDEX "InstructorProfile_userId_idx" ON "InstructorProfile"("userId");

-- CreateIndex
CREATE INDEX "InstructorProfile_averageRating_idx" ON "InstructorProfile"("averageRating");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");

-- CreateIndex
CREATE INDEX "BusinessProfile_userId_idx" ON "BusinessProfile"("userId");

-- CreateIndex
CREATE INDEX "FreelancerService_userId_isActive_idx" ON "FreelancerService"("userId", "isActive");

-- CreateIndex
CREATE INDEX "FreelancerService_category_subcategory_idx" ON "FreelancerService"("category", "subcategory");

-- CreateIndex
CREATE INDEX "FreelancerService_isActive_isBoosted_idx" ON "FreelancerService"("isActive", "isBoosted");

-- CreateIndex
CREATE INDEX "SkillEndorsement_endorsedId_skillName_idx" ON "SkillEndorsement"("endorsedId", "skillName");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEndorsement_skillName_endorserId_endorsedId_key" ON "SkillEndorsement"("skillName", "endorserId", "endorsedId");

-- CreateIndex
CREATE INDEX "UserFollow_followerId_idx" ON "UserFollow"("followerId");

-- CreateIndex
CREATE INDEX "UserFollow_followingId_idx" ON "UserFollow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgProfile_organizationId_key" ON "OrgProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrgProfile_organizationId_idx" ON "OrgProfile"("organizationId");

-- CreateIndex
CREATE INDEX "OrgReview_organizationId_idx" ON "OrgReview"("organizationId");

-- CreateIndex
CREATE INDEX "OrgReview_rating_idx" ON "OrgReview"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "OrgReview_organizationId_userId_key" ON "OrgReview"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrgFollow_organizationId_idx" ON "OrgFollow"("organizationId");

-- CreateIndex
CREATE INDEX "OrgFollow_userId_idx" ON "OrgFollow"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgFollow_organizationId_userId_key" ON "OrgFollow"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "PublicDashboard_organizationId_isPublic_idx" ON "PublicDashboard"("organizationId", "isPublic");

-- CreateIndex
CREATE INDEX "PublicDashboard_userId_isPublic_idx" ON "PublicDashboard"("userId", "isPublic");

-- CreateIndex
CREATE INDEX "Payout_walletId_idx" ON "Payout"("walletId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_requestedAt_idx" ON "Payout"("requestedAt");

-- CreateIndex
CREATE INDEX "Payout_method_idx" ON "Payout"("method");

-- CreateIndex
CREATE INDEX "Payout_reference_idx" ON "Payout"("reference");

-- CreateIndex
CREATE INDEX "Payout_batchId_idx" ON "Payout"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_deletedAt_idx" ON "User"("role", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "User_phoneVerified_idx" ON "User"("phoneVerified");

-- CreateIndex
CREATE INDEX "User_skills_idx" ON "User"("skills");

-- CreateIndex
CREATE INDEX "User_fullName_idx" ON "User"("fullName");

-- CreateIndex
CREATE INDEX "User_city_country_idx" ON "User"("city", "country");

-- CreateIndex
CREATE INDEX "User_provider_providerId_idx" ON "User"("provider", "providerId");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

-- CreateIndex
CREATE INDEX "User_isActive_role_idx" ON "User"("isActive", "role");

-- CreateIndex
CREATE INDEX "User_emailVerified_email_idx" ON "User"("emailVerified", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UsernameRedirect_oldUsername_key" ON "UsernameRedirect"("oldUsername");

-- CreateIndex
CREATE INDEX "UsernameRedirect_oldUsername_idx" ON "UsernameRedirect"("oldUsername");

-- CreateIndex
CREATE INDEX "UsernameRedirect_expiresAt_idx" ON "UsernameRedirect"("expiresAt");

-- CreateIndex
CREATE INDEX "UsernameRedirect_newUserId_idx" ON "UsernameRedirect"("newUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservedUsername_name_key" ON "ReservedUsername"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAnswer_userId_key" ON "OnboardingAnswer"("userId");

-- CreateIndex
CREATE INDEX "OnboardingAnswer_userId_idx" ON "OnboardingAnswer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_ownerId_key" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE INDEX "Organization_sector_idx" ON "Organization"("sector");

-- CreateIndex
CREATE INDEX "Organization_country_idx" ON "Organization"("country");

-- CreateIndex
CREATE INDEX "Organization_city_idx" ON "Organization"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_role_idx" ON "OrganizationMember"("role");

-- CreateIndex
CREATE INDEX "OrganizationMember_invitedById_idx" ON "OrganizationMember"("invitedById");

-- CreateIndex
CREATE INDEX "OrganizationMember_createdAt_idx" ON "OrganizationMember"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Path_createdAt_idx" ON "Path"("createdAt");

-- CreateIndex
CREATE INDEX "Path_title_idx" ON "Path"("title");

-- CreateIndex
CREATE INDEX "Path_deletedAt_idx" ON "Path"("deletedAt");

-- CreateIndex
CREATE INDEX "Path_featured_idx" ON "Path"("featured");

-- CreateIndex
CREATE INDEX "Path_createdAt_featured_idx" ON "Path"("createdAt", "featured");

-- CreateIndex
CREATE INDEX "Module_instructorId_idx" ON "Module"("instructorId");

-- CreateIndex
CREATE INDEX "Module_featured_idx" ON "Module"("featured");

-- CreateIndex
CREATE INDEX "Module_createdAt_idx" ON "Module"("createdAt");

-- CreateIndex
CREATE INDEX "Module_level_idx" ON "Module"("level");

-- CreateIndex
CREATE INDEX "Module_tags_idx" ON "Module"("tags");

-- CreateIndex
CREATE INDEX "Module_skills_idx" ON "Module"("skills");

-- CreateIndex
CREATE INDEX "Module_deletedAt_idx" ON "Module"("deletedAt");

-- CreateIndex
CREATE INDEX "Module_title_idx" ON "Module"("title");

-- CreateIndex
CREATE INDEX "Module_status_idx" ON "Module"("status");

-- CreateIndex
CREATE INDEX "Module_instructorId_status_idx" ON "Module"("instructorId", "status");

-- CreateIndex
CREATE INDEX "Module_status_featured_idx" ON "Module"("status", "featured");

-- CreateIndex
CREATE INDEX "Module_instructorId_featured_idx" ON "Module"("instructorId", "featured");

-- CreateIndex
CREATE INDEX "Module_createdAt_featured_idx" ON "Module"("createdAt", "featured");

-- CreateIndex
CREATE INDEX "PathModule_pathId_idx" ON "PathModule"("pathId");

-- CreateIndex
CREATE INDEX "PathModule_moduleId_idx" ON "PathModule"("moduleId");

-- CreateIndex
CREATE INDEX "PathModule_order_idx" ON "PathModule"("order");

-- CreateIndex
CREATE INDEX "PathModule_pathId_order_idx" ON "PathModule"("pathId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PathModule_pathId_moduleId_key" ON "PathModule"("pathId", "moduleId");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- CreateIndex
CREATE INDEX "Lesson_order_idx" ON "Lesson"("order");

-- CreateIndex
CREATE INDEX "Lesson_type_idx" ON "Lesson"("type");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE INDEX "Lesson_difficulty_idx" ON "Lesson"("difficulty");

-- CreateIndex
CREATE INDEX "Lesson_createdAt_idx" ON "Lesson"("createdAt");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_order_idx" ON "Lesson"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_status_idx" ON "Lesson"("moduleId", "status");

-- CreateIndex
CREATE INDEX "Lesson_title_idx" ON "Lesson"("title");

-- CreateIndex
CREATE INDEX "Lesson_deletedAt_idx" ON "Lesson"("deletedAt");

-- CreateIndex
CREATE INDEX "Lesson_quizId_idx" ON "Lesson"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_certificateId_key" ON "Enrollment"("certificateId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE INDEX "Enrollment_moduleId_idx" ON "Enrollment"("moduleId");

-- CreateIndex
CREATE INDEX "Enrollment_pathId_idx" ON "Enrollment"("pathId");

-- CreateIndex
CREATE INDEX "Enrollment_progress_idx" ON "Enrollment"("progress");

-- CreateIndex
CREATE INDEX "Enrollment_createdAt_idx" ON "Enrollment"("createdAt");

-- CreateIndex
CREATE INDEX "Enrollment_startedAt_idx" ON "Enrollment"("startedAt");

-- CreateIndex
CREATE INDEX "Enrollment_completedAt_idx" ON "Enrollment"("completedAt");

-- CreateIndex
CREATE INDEX "Enrollment_expiresAt_idx" ON "Enrollment"("expiresAt");

-- CreateIndex
CREATE INDEX "Enrollment_deletedAt_idx" ON "Enrollment"("deletedAt");

-- CreateIndex
CREATE INDEX "Enrollment_transactionId_idx" ON "Enrollment"("transactionId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_moduleId_completedAt_idx" ON "Enrollment"("userId", "moduleId", "completedAt");

-- CreateIndex
CREATE INDEX "Enrollment_userId_pathId_completedAt_idx" ON "Enrollment"("userId", "pathId", "completedAt");

-- CreateIndex
CREATE INDEX "Enrollment_moduleId_userId_idx" ON "Enrollment"("moduleId", "userId");

-- CreateIndex
CREATE INDEX "Enrollment_pathId_userId_idx" ON "Enrollment"("pathId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_moduleId_key" ON "Enrollment"("userId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_pathId_key" ON "Enrollment"("userId", "pathId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");

-- CreateIndex
CREATE INDEX "LessonProgress_isCompleted_idx" ON "LessonProgress"("isCompleted");

-- CreateIndex
CREATE INDEX "LessonProgress_completedAt_idx" ON "LessonProgress"("completedAt");

-- CreateIndex
CREATE INDEX "LessonProgress_progress_idx" ON "LessonProgress"("progress");

-- CreateIndex
CREATE INDEX "LessonProgress_createdAt_idx" ON "LessonProgress"("createdAt");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_isCompleted_idx" ON "LessonProgress"("userId", "isCompleted");

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_isCompleted_idx" ON "LessonProgress"("lessonId", "isCompleted");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_lessonId_completedAt_idx" ON "LessonProgress"("userId", "lessonId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_lessonId_key" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");

-- CreateIndex
CREATE INDEX "Quiz_createdAt_idx" ON "Quiz"("createdAt");

-- CreateIndex
CREATE INDEX "Quiz_deletedAt_idx" ON "Quiz"("deletedAt");

-- CreateIndex
CREATE INDEX "Quiz_title_idx" ON "Quiz"("title");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "QuizQuestion_order_idx" ON "QuizQuestion"("order");

-- CreateIndex
CREATE INDEX "QuizQuestion_questionType_idx" ON "QuizQuestion"("questionType");

-- CreateIndex
CREATE INDEX "QuizQuestion_points_idx" ON "QuizQuestion"("points");

-- CreateIndex
CREATE INDEX "QuizQuestion_createdAt_idx" ON "QuizQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "QuizQuestion_deletedAt_idx" ON "QuizQuestion"("deletedAt");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_order_idx" ON "QuizQuestion"("quizId", "order");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_score_idx" ON "QuizAttempt"("score");

-- CreateIndex
CREATE INDEX "QuizAttempt_isPassed_idx" ON "QuizAttempt"("isPassed");

-- CreateIndex
CREATE INDEX "QuizAttempt_startedAt_idx" ON "QuizAttempt"("startedAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_completedAt_idx" ON "QuizAttempt"("completedAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_deletedAt_idx" ON "QuizAttempt"("deletedAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_isPassed_idx" ON "QuizAttempt"("userId", "isPassed");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_isPassed_idx" ON "QuizAttempt"("quizId", "isPassed");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_completedAt_idx" ON "QuizAttempt"("userId", "quizId", "completedAt");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_attemptId_idx" ON "QuizUserAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_questionId_idx" ON "QuizUserAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_isCorrect_idx" ON "QuizUserAnswer"("isCorrect");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_pointsEarned_idx" ON "QuizUserAnswer"("pointsEarned");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_createdAt_idx" ON "QuizUserAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_deletedAt_idx" ON "QuizUserAnswer"("deletedAt");

-- CreateIndex
CREATE INDEX "QuizUserAnswer_attemptId_isCorrect_idx" ON "QuizUserAnswer"("attemptId", "isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "QuizUserAnswer_attemptId_questionId_key" ON "QuizUserAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateId_key" ON "Certificate"("certificateId");

-- CreateIndex
CREATE INDEX "Certificate_certificateId_idx" ON "Certificate"("certificateId");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- CreateIndex
CREATE INDEX "Certificate_moduleId_idx" ON "Certificate"("moduleId");

-- CreateIndex
CREATE INDEX "Certificate_pathId_idx" ON "Certificate"("pathId");

-- CreateIndex
CREATE INDEX "Certificate_issuedAt_idx" ON "Certificate"("issuedAt");

-- CreateIndex
CREATE INDEX "Certificate_userId_moduleId_idx" ON "Certificate"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "Certificate_userId_pathId_idx" ON "Certificate"("userId", "pathId");

-- CreateIndex
CREATE INDEX "Certificate_deletedAt_idx" ON "Certificate"("deletedAt");

-- CreateIndex
CREATE INDEX "Certificate_createdAt_idx" ON "Certificate"("createdAt");

-- CreateIndex
CREATE INDEX "Certificate_revokedAt_idx" ON "Certificate"("revokedAt");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Project_ownerId_status_idx" ON "Project"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Project_skills_idx" ON "Project"("skills");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Project_title_description_idx" ON "Project"("title", "description");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "Project_organizationId_status_idx" ON "Project"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Project_budget_idx" ON "Project"("budget");

-- CreateIndex
CREATE INDEX "Proposal_projectId_status_idx" ON "Proposal"("projectId", "status");

-- CreateIndex
CREATE INDEX "Proposal_freelancerId_status_idx" ON "Proposal"("freelancerId", "status");

-- CreateIndex
CREATE INDEX "Proposal_status_createdAt_idx" ON "Proposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_amount_idx" ON "Proposal"("amount");

-- CreateIndex
CREATE INDEX "Proposal_projectId_freelancerId_idx" ON "Proposal"("projectId", "freelancerId");

-- CreateIndex
CREATE INDEX "Proposal_createdAt_idx" ON "Proposal"("createdAt");

-- CreateIndex
CREATE INDEX "Proposal_deletedAt_idx" ON "Proposal"("deletedAt");

-- CreateIndex
CREATE INDEX "Contract_freelancerId_status_idx" ON "Contract"("freelancerId", "status");

-- CreateIndex
CREATE INDEX "Contract_clientId_status_idx" ON "Contract"("clientId", "status");

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- CreateIndex
CREATE INDEX "Contract_status_createdAt_idx" ON "Contract"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_startDate_idx" ON "Contract"("startDate");

-- CreateIndex
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");

-- CreateIndex
CREATE INDEX "Contract_createdAt_idx" ON "Contract"("createdAt");

-- CreateIndex
CREATE INDEX "Contract_deletedAt_idx" ON "Contract"("deletedAt");

-- CreateIndex
CREATE INDEX "Contract_clientId_freelancerId_idx" ON "Contract"("clientId", "freelancerId");

-- CreateIndex
CREATE INDEX "Contract_projectId_status_idx" ON "Contract"("projectId", "status");

-- CreateIndex
CREATE INDEX "Contract_amount_idx" ON "Contract"("amount");

-- CreateIndex
CREATE INDEX "Contract_freelancerProfileId_idx" ON "Contract"("freelancerProfileId");

-- CreateIndex
CREATE INDEX "Delivery_contractId_idx" ON "Delivery"("contractId");

-- CreateIndex
CREATE INDEX "Delivery_deliveredAt_idx" ON "Delivery"("deliveredAt");

-- CreateIndex
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");

-- CreateIndex
CREATE INDEX "Delivery_deletedAt_idx" ON "Delivery"("deletedAt");

-- CreateIndex
CREATE INDEX "Delivery_milestoneId_idx" ON "Delivery"("milestoneId");

-- CreateIndex
CREATE INDEX "ContractMilestone_contractId_idx" ON "ContractMilestone"("contractId");

-- CreateIndex
CREATE INDEX "ContractMilestone_status_idx" ON "ContractMilestone"("status");

-- CreateIndex
CREATE INDEX "ContractMilestone_order_idx" ON "ContractMilestone"("order");

-- CreateIndex
CREATE INDEX "ContractMilestone_dueDate_idx" ON "ContractMilestone"("dueDate");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "Transaction_purpose_idx" ON "Transaction"("purpose");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_provider_idx" ON "Transaction"("provider");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_providerReference_idx" ON "Transaction"("providerReference");

-- CreateIndex
CREATE INDEX "Transaction_contractId_idx" ON "Transaction"("contractId");

-- CreateIndex
CREATE INDEX "Transaction_subscriptionId_idx" ON "Transaction"("subscriptionId");

-- CreateIndex
CREATE INDEX "Transaction_purpose_status_idx" ON "Transaction"("purpose", "status");

-- CreateIndex
CREATE INDEX "Transaction_parentTransactionId_idx" ON "Transaction"("parentTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_userId_purpose_status_idx" ON "Transaction"("userId", "purpose", "status");

-- CreateIndex
CREATE INDEX "Transaction_gateway_status_idx" ON "Transaction"("gateway", "status");

-- CreateIndex
CREATE INDEX "Transaction_checkoutUrl_idx" ON "Transaction"("checkoutUrl");

-- CreateIndex
CREATE INDEX "Transaction_webhookAttempts_idx" ON "Transaction"("webhookAttempts");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_gateway_idx" ON "Transaction"("createdAt", "gateway");

-- CreateIndex
CREATE INDEX "Transaction_walletId_idx" ON "Transaction"("walletId");

-- CreateIndex
CREATE INDEX "Transaction_escrowHoldId_idx" ON "Transaction"("escrowHoldId");

-- CreateIndex
CREATE INDEX "Transaction_commission_idx" ON "Transaction"("commission");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_plan_key" ON "Subscription"("userId", "plan");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_plan_key" ON "Subscription"("organizationId", "plan");

-- CreateIndex
CREATE INDEX "UserEntitlement_userId_idx" ON "UserEntitlement"("userId");

-- CreateIndex
CREATE INDEX "UserEntitlement_expiresAt_idx" ON "UserEntitlement"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_userId_entitlementType_resourceId_key" ON "UserEntitlement"("userId", "entitlementType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCalculation_contractId_key" ON "CommissionCalculation"("contractId");

-- CreateIndex
CREATE INDEX "CommissionCalculation_contractId_idx" ON "CommissionCalculation"("contractId");

-- CreateIndex
CREATE INDEX "CommissionTierHistory_freelancerId_effectiveFrom_idx" ON "CommissionTierHistory"("freelancerId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PlatformRevenue_source_idx" ON "PlatformRevenue"("source");

-- CreateIndex
CREATE INDEX "PlatformRevenue_periodStart_periodEnd_idx" ON "PlatformRevenue"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PlatformRevenue_createdAt_idx" ON "PlatformRevenue"("createdAt");

-- CreateIndex
CREATE INDEX "EntitlementCache_userId_idx" ON "EntitlementCache"("userId");

-- CreateIndex
CREATE INDEX "EntitlementCache_expiresAt_idx" ON "EntitlementCache"("expiresAt");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_organizationId_idx" ON "PaymentMethod"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentMethod_provider_idx" ON "PaymentMethod"("provider");

-- CreateIndex
CREATE INDEX "PaymentMethod_isDefault_idx" ON "PaymentMethod"("isDefault");

-- CreateIndex
CREATE INDEX "PaymentMethod_createdAt_idx" ON "PaymentMethod"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentMethod_providerId_idx" ON "PaymentMethod"("providerId");

-- CreateIndex
CREATE INDEX "UserSkill_userId_idx" ON "UserSkill"("userId");

-- CreateIndex
CREATE INDEX "UserSkill_name_idx" ON "UserSkill"("name");

-- CreateIndex
CREATE INDEX "UserSkill_userId_name_idx" ON "UserSkill"("userId", "name");

-- CreateIndex
CREATE INDEX "UserSkill_createdAt_idx" ON "UserSkill"("createdAt");

-- CreateIndex
CREATE INDEX "Dataset_processingStatus_idx" ON "Dataset"("processingStatus");

-- CreateIndex
CREATE INDEX "Dataset_userId_idx" ON "Dataset"("userId");

-- CreateIndex
CREATE INDEX "Dataset_organizationId_idx" ON "Dataset"("organizationId");

-- CreateIndex
CREATE INDEX "Dataset_createdAt_idx" ON "Dataset"("createdAt");

-- CreateIndex
CREATE INDEX "Dataset_name_idx" ON "Dataset"("name");

-- CreateIndex
CREATE INDEX "Dataset_deletedAt_idx" ON "Dataset"("deletedAt");

-- CreateIndex
CREATE INDEX "Dataset_userId_processingStatus_idx" ON "Dataset"("userId", "processingStatus");

-- CreateIndex
CREATE INDEX "Dataset_domain_idx" ON "Dataset"("domain");

-- CreateIndex
CREATE INDEX "Dataset_format_idx" ON "Dataset"("format");

-- CreateIndex
CREATE INDEX "Dataset_sourceType_idx" ON "Dataset"("sourceType");

-- CreateIndex
CREATE INDEX "Dataset_status_idx" ON "Dataset"("status");

-- CreateIndex
CREATE INDEX "Dataset_organizationId_status_idx" ON "Dataset"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Dataset_organizationId_createdAt_idx" ON "Dataset"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Dashboard_organizationId_idx" ON "Dashboard"("organizationId");

-- CreateIndex
CREATE INDEX "Dashboard_ownerId_idx" ON "Dashboard"("ownerId");

-- CreateIndex
CREATE INDEX "Dashboard_createdAt_idx" ON "Dashboard"("createdAt");

-- CreateIndex
CREATE INDEX "Dashboard_title_idx" ON "Dashboard"("title");

-- CreateIndex
CREATE INDEX "Dashboard_deletedAt_idx" ON "Dashboard"("deletedAt");

-- CreateIndex
CREATE INDEX "Dashboard_organizationId_ownerId_idx" ON "Dashboard"("organizationId", "ownerId");

-- CreateIndex
CREATE INDEX "Dashboard_organizationId_createdAt_idx" ON "Dashboard"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DashboardDataset_dashboardId_idx" ON "DashboardDataset"("dashboardId");

-- CreateIndex
CREATE INDEX "DashboardDataset_datasetId_idx" ON "DashboardDataset"("datasetId");

-- CreateIndex
CREATE INDEX "DashboardDataset_addedAt_idx" ON "DashboardDataset"("addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardDataset_dashboardId_datasetId_key" ON "DashboardDataset"("dashboardId", "datasetId");

-- CreateIndex
CREATE INDEX "Widget_dashboardId_idx" ON "Widget"("dashboardId");

-- CreateIndex
CREATE INDEX "Widget_datasetId_idx" ON "Widget"("datasetId");

-- CreateIndex
CREATE INDEX "Widget_type_idx" ON "Widget"("type");

-- CreateIndex
CREATE INDEX "Widget_order_idx" ON "Widget"("order");

-- CreateIndex
CREATE INDEX "Widget_createdAt_idx" ON "Widget"("createdAt");

-- CreateIndex
CREATE INDEX "Widget_deletedAt_idx" ON "Widget"("deletedAt");

-- CreateIndex
CREATE INDEX "Widget_dashboardId_order_idx" ON "Widget"("dashboardId", "order");

-- CreateIndex
CREATE INDEX "Insight_dashboardId_idx" ON "Insight"("dashboardId");

-- CreateIndex
CREATE INDEX "Insight_userId_idx" ON "Insight"("userId");

-- CreateIndex
CREATE INDEX "Insight_createdAt_idx" ON "Insight"("createdAt");

-- CreateIndex
CREATE INDEX "Insight_deletedAt_idx" ON "Insight"("deletedAt");

-- CreateIndex
CREATE INDEX "Insight_dashboardId_userId_idx" ON "Insight"("dashboardId", "userId");

-- CreateIndex
CREATE INDEX "MLModel_datasetId_idx" ON "MLModel"("datasetId");

-- CreateIndex
CREATE INDEX "MLModel_creatorId_idx" ON "MLModel"("creatorId");

-- CreateIndex
CREATE INDEX "MLModel_type_idx" ON "MLModel"("type");

-- CreateIndex
CREATE INDEX "MLModel_createdAt_idx" ON "MLModel"("createdAt");

-- CreateIndex
CREATE INDEX "MLModel_name_idx" ON "MLModel"("name");

-- CreateIndex
CREATE INDEX "MLModel_deletedAt_idx" ON "MLModel"("deletedAt");

-- CreateIndex
CREATE INDEX "MLModel_datasetId_creatorId_idx" ON "MLModel"("datasetId", "creatorId");

-- CreateIndex
CREATE INDEX "Decision_organizationId_idx" ON "Decision"("organizationId");

-- CreateIndex
CREATE INDEX "Decision_ownerId_idx" ON "Decision"("ownerId");

-- CreateIndex
CREATE INDEX "Decision_status_idx" ON "Decision"("status");

-- CreateIndex
CREATE INDEX "Decision_datasetId_idx" ON "Decision"("datasetId");

-- CreateIndex
CREATE INDEX "Decision_createdAt_idx" ON "Decision"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionHistory_decisionId_idx" ON "DecisionHistory"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionHistory_changedById_idx" ON "DecisionHistory"("changedById");

-- CreateIndex
CREATE INDEX "DecisionComment_decisionId_idx" ON "DecisionComment"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionComment_userId_idx" ON "DecisionComment"("userId");

-- CreateIndex
CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");

-- CreateIndex
CREATE INDEX "Report_createdById_idx" ON "Report"("createdById");

-- CreateIndex
CREATE INDEX "Report_dashboardId_idx" ON "Report"("dashboardId");

-- CreateIndex
CREATE INDEX "Report_isActive_idx" ON "Report"("isActive");

-- CreateIndex
CREATE INDEX "Report_scheduleType_idx" ON "Report"("scheduleType");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "ReportRun_reportId_idx" ON "ReportRun"("reportId");

-- CreateIndex
CREATE INDEX "ReportRun_status_idx" ON "ReportRun"("status");

-- CreateIndex
CREATE INDEX "ReportRun_startedAt_idx" ON "ReportRun"("startedAt");

-- CreateIndex
CREATE INDEX "QualityIssue_datasetId_idx" ON "QualityIssue"("datasetId");

-- CreateIndex
CREATE INDEX "QualityIssue_issueType_idx" ON "QualityIssue"("issueType");

-- CreateIndex
CREATE INDEX "QualityIssue_severity_idx" ON "QualityIssue"("severity");

-- CreateIndex
CREATE INDEX "QualityIssue_status_idx" ON "QualityIssue"("status");

-- CreateIndex
CREATE INDEX "QualityIssue_createdAt_idx" ON "QualityIssue"("createdAt");

-- CreateIndex
CREATE INDEX "QualityAssessment_datasetId_idx" ON "QualityAssessment"("datasetId");

-- CreateIndex
CREATE INDEX "QualityAssessment_createdAt_idx" ON "QualityAssessment"("createdAt");

-- CreateIndex
CREATE INDEX "UsageTracking_userId_metricType_idx" ON "UsageTracking"("userId", "metricType");

-- CreateIndex
CREATE INDEX "UsageTracking_organizationId_idx" ON "UsageTracking"("organizationId");

-- CreateIndex
CREATE INDEX "UsageTracking_subscriptionId_idx" ON "UsageTracking"("subscriptionId");

-- CreateIndex
CREATE INDEX "UsageTracking_periodStart_idx" ON "UsageTracking"("periodStart");

-- CreateIndex
CREATE INDEX "UsageTracking_periodEnd_idx" ON "UsageTracking"("periodEnd");

-- CreateIndex
CREATE INDEX "UsageTracking_userId_periodStart_idx" ON "UsageTracking"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "UsageTracking_organizationId_metricType_idx" ON "UsageTracking"("organizationId", "metricType");

-- CreateIndex
CREATE INDEX "UsageTracking_metricType_periodStart_idx" ON "UsageTracking"("metricType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageTracking_userId_metricType_periodStart_key" ON "UsageTracking"("userId", "metricType", "periodStart");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_emailSent_idx" ON "Notification"("emailSent");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_deletedAt_idx" ON "Notification"("deletedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_category_idx" ON "Notification"("userId", "category");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_deletedAt_createdAt_idx" ON "Notification"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_contractId_key" ON "Dispute"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_milestoneId_key" ON "Dispute"("milestoneId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_contractId_idx" ON "Dispute"("contractId");

-- CreateIndex
CREATE INDEX "Dispute_createdAt_idx" ON "Dispute"("createdAt");

-- CreateIndex
CREATE INDEX "Dispute_autoResolvedAt_idx" ON "Dispute"("autoResolvedAt");

-- CreateIndex
CREATE INDEX "Dispute_milestoneId_idx" ON "Dispute"("milestoneId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_idx" ON "NotificationDelivery"("channel");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_nextRetryAt_idx" ON "NotificationDelivery"("nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextRetryAt_idx" ON "NotificationDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreferences_userId_idx" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreferences_emailNotifications_idx" ON "NotificationPreferences"("emailNotifications");

-- CreateIndex
CREATE INDEX "NotificationPreferences_updatedAt_idx" ON "NotificationPreferences"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");

-- CreateIndex
CREATE INDEX "AuthToken_userId_idx" ON "AuthToken"("userId");

-- CreateIndex
CREATE INDEX "AuthToken_token_idx" ON "AuthToken"("token");

-- CreateIndex
CREATE INDEX "AuthToken_type_idx" ON "AuthToken"("type");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthToken_usedAt_idx" ON "AuthToken"("usedAt");

-- CreateIndex
CREATE INDEX "AuthToken_createdAt_idx" ON "AuthToken"("createdAt");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_usedAt_idx" ON "AuthToken"("expiresAt", "usedAt");

-- CreateIndex
CREATE INDEX "File_ownerId_idx" ON "File"("ownerId");

-- CreateIndex
CREATE INDEX "File_filename_idx" ON "File"("filename");

-- CreateIndex
CREATE INDEX "File_category_idx" ON "File"("category");

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");

-- CreateIndex
CREATE INDEX "File_deletedAt_idx" ON "File"("deletedAt");

-- CreateIndex
CREATE INDEX "File_ownerId_category_idx" ON "File"("ownerId", "category");

-- CreateIndex
CREATE INDEX "File_storedName_idx" ON "File"("storedName");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_createdAt_idx" ON "AuditLog"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_language_idx" ON "UserSettings"("language");

-- CreateIndex
CREATE INDEX "UserSettings_timezone_idx" ON "UserSettings"("timezone");

-- CreateIndex
CREATE INDEX "UserSettings_updatedAt_idx" ON "UserSettings"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppearanceSettings_userId_key" ON "AppearanceSettings"("userId");

-- CreateIndex
CREATE INDEX "AppearanceSettings_userId_idx" ON "AppearanceSettings"("userId");

-- CreateIndex
CREATE INDEX "AppearanceSettings_theme_idx" ON "AppearanceSettings"("theme");

-- CreateIndex
CREATE INDEX "AppearanceSettings_updatedAt_idx" ON "AppearanceSettings"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacySettings_userId_key" ON "PrivacySettings"("userId");

-- CreateIndex
CREATE INDEX "PrivacySettings_userId_idx" ON "PrivacySettings"("userId");

-- CreateIndex
CREATE INDEX "PrivacySettings_profileVisibility_idx" ON "PrivacySettings"("profileVisibility");

-- CreateIndex
CREATE INDEX "PrivacySettings_updatedAt_idx" ON "PrivacySettings"("updatedAt");

-- CreateIndex
CREATE INDEX "UserIntegration_userId_idx" ON "UserIntegration"("userId");

-- CreateIndex
CREATE INDEX "UserIntegration_provider_idx" ON "UserIntegration"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserIntegration_userId_provider_key" ON "UserIntegration"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySettings_userId_key" ON "SecuritySettings"("userId");

-- CreateIndex
CREATE INDEX "SecuritySettings_userId_idx" ON "SecuritySettings"("userId");

-- CreateIndex
CREATE INDEX "SecuritySettings_twoFactorEnabled_idx" ON "SecuritySettings"("twoFactorEnabled");

-- CreateIndex
CREATE INDEX "SecuritySettings_updatedAt_idx" ON "SecuritySettings"("updatedAt");

-- CreateIndex
CREATE INDEX "SecuritySettings_lastPasswordChange_idx" ON "SecuritySettings"("lastPasswordChange");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_credentialId_idx" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "EmailOtpCode_userId_purpose_idx" ON "EmailOtpCode"("userId", "purpose");

-- CreateIndex
CREATE INDEX "EmailOtpCode_email_code_idx" ON "EmailOtpCode"("email", "code");

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

-- CreateIndex
CREATE INDEX "UserDevice_fingerprintHash_idx" ON "UserDevice"("fingerprintHash");

-- CreateIndex
CREATE INDEX "UserDevice_userId_isTrusted_idx" ON "UserDevice"("userId", "isTrusted");

-- CreateIndex
CREATE INDEX "UserDevice_lastActiveAt_idx" ON "UserDevice"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_userId_fingerprintHash_key" ON "UserDevice"("userId", "fingerprintHash");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_idx" ON "SecurityEvent"("eventType");

-- CreateIndex
CREATE INDEX "DeviceCooldown_userId_idx" ON "DeviceCooldown"("userId");

-- CreateIndex
CREATE INDEX "DeviceCooldown_fingerprintHash_idx" ON "DeviceCooldown"("fingerprintHash");

-- CreateIndex
CREATE INDEX "DeviceCooldown_userId_isActive_idx" ON "DeviceCooldown"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AdvancedSettings_userId_key" ON "AdvancedSettings"("userId");

-- CreateIndex
CREATE INDEX "AdvancedSettings_userId_idx" ON "AdvancedSettings"("userId");

-- CreateIndex
CREATE INDEX "AdvancedSettings_debugMode_idx" ON "AdvancedSettings"("debugMode");

-- CreateIndex
CREATE INDEX "AdvancedSettings_performanceMode_idx" ON "AdvancedSettings"("performanceMode");

-- CreateIndex
CREATE INDEX "AdvancedSettings_updatedAt_idx" ON "AdvancedSettings"("updatedAt");

-- CreateIndex
CREATE INDEX "DataExport_userId_idx" ON "DataExport"("userId");

-- CreateIndex
CREATE INDEX "DataExport_status_idx" ON "DataExport"("status");

-- CreateIndex
CREATE INDEX "DataExport_requestedAt_idx" ON "DataExport"("requestedAt");

-- CreateIndex
CREATE INDEX "DataExport_completedAt_idx" ON "DataExport"("completedAt");

-- CreateIndex
CREATE INDEX "DataExport_expiresAt_idx" ON "DataExport"("expiresAt");

-- CreateIndex
CREATE INDEX "DataExport_userId_status_idx" ON "DataExport"("userId", "status");

-- CreateIndex
CREATE INDEX "DataExport_format_idx" ON "DataExport"("format");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_status_idx" ON "AccountDeletionRequest"("status");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_scheduledFor_idx" ON "AccountDeletionRequest"("scheduledFor");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_requestedAt_idx" ON "AccountDeletionRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_userId_status_idx" ON "AccountDeletionRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_scheduledFor_status_idx" ON "AccountDeletionRequest"("scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_verifications_phone_number_key" ON "phone_verifications"("phone_number");

-- CreateIndex
CREATE INDEX "phone_verifications_phone_number_idx" ON "phone_verifications"("phone_number");

-- CreateIndex
CREATE INDEX "phone_verifications_expires_at_idx" ON "phone_verifications"("expires_at");

-- CreateIndex
CREATE INDEX "phone_verifications_verified_idx" ON "phone_verifications"("verified");

-- CreateIndex
CREATE INDEX "phone_verifications_created_at_idx" ON "phone_verifications"("created_at");

-- CreateIndex
CREATE INDEX "phone_verifications_phone_number_verified_idx" ON "phone_verifications"("phone_number", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_referralCode_key" ON "WaitlistEntry"("referralCode");

-- CreateIndex
CREATE INDEX "WaitlistEntry_email_idx" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_referralCode_idx" ON "WaitlistEntry"("referralCode");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_referredById_idx" ON "WaitlistEntry"("referredById");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistReferralMilestone_position_key" ON "WaitlistReferralMilestone"("position");

-- CreateIndex
CREATE INDEX "WaitlistReferralMilestone_position_idx" ON "WaitlistReferralMilestone"("position");

-- CreateIndex
CREATE INDEX "WaitlistReferralMilestone_isActive_idx" ON "WaitlistReferralMilestone"("isActive");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_transactionId_idx" ON "PaymentWebhookLog"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_eventType_idx" ON "PaymentWebhookLog"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_gateway_idx" ON "PaymentWebhookLog"("gateway");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_createdAt_idx" ON "PaymentWebhookLog"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_processed_idx" ON "PaymentWebhookLog"("processed");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_isVerified_idx" ON "PaymentWebhookLog"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_key_idx" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_idx" ON "IdempotencyKey"("userId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_conversationId_key" ON "Conversation"("conversationId");

-- CreateIndex
CREATE INDEX "Conversation_conversationId_idx" ON "Conversation"("conversationId");

-- CreateIndex
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_deletedAt_idx" ON "Conversation"("deletedAt");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_archivedAt_idx" ON "Conversation"("archivedAt");

-- CreateIndex
CREATE INDEX "Conversation_type_createdAt_idx" ON "Conversation"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_type_updatedAt_idx" ON "Conversation"("type", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_deletedAt_updatedAt_idx" ON "Conversation"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_userId_idx" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_joinedAt_idx" ON "ConversationParticipant"("joinedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_leftAt_idx" ON "ConversationParticipant"("leftAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_lastReadAt_idx" ON "ConversationParticipant"("lastReadAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_leftAt_idx" ON "ConversationParticipant"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_isArchived_idx" ON "ConversationParticipant"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_isPinned_idx" ON "ConversationParticipant"("userId", "isPinned");

-- CreateIndex
CREATE INDEX "ConversationParticipant_mutedUntil_idx" ON "ConversationParticipant"("mutedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_messageId_key" ON "Message"("messageId");

-- CreateIndex
CREATE INDEX "Message_messageId_idx" ON "Message"("messageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_deletedAt_idx" ON "Message"("deletedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_deletedAt_createdAt_idx" ON "Message"("conversationId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "Message_conversationId_status_idx" ON "Message"("conversationId", "status");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageAttachment_conversationId_idx" ON "MessageAttachment"("conversationId");

-- CreateIndex
CREATE INDEX "MessageAttachment_createdAt_idx" ON "MessageAttachment"("createdAt");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");

-- CreateIndex
CREATE INDEX "MessageReaction_createdAt_idx" ON "MessageReaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_messageId_idx" ON "MessageReadReceipt"("messageId");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_userId_idx" ON "MessageReadReceipt"("userId");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_readAt_idx" ON "MessageReadReceipt"("readAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReadReceipt_messageId_userId_key" ON "MessageReadReceipt"("messageId", "userId");

-- CreateIndex
CREATE INDEX "ContractReview_contractId_idx" ON "ContractReview"("contractId");

-- CreateIndex
CREATE INDEX "ContractReview_authorId_idx" ON "ContractReview"("authorId");

-- CreateIndex
CREATE INDEX "ContractReview_targetId_idx" ON "ContractReview"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractReview_contractId_authorId_key" ON "ContractReview"("contractId", "authorId");

-- CreateIndex
CREATE INDEX "ReviewAppeal_reviewId_idx" ON "ReviewAppeal"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewAppeal_status_idx" ON "ReviewAppeal"("status");

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_idx" ON "ReviewReport"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewReport_reporterId_idx" ON "ReviewReport"("reporterId");

-- CreateIndex
CREATE INDEX "ReviewReport_status_idx" ON "ReviewReport"("status");

-- CreateIndex
CREATE INDEX "CourseReview_moduleId_idx" ON "CourseReview"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_userId_moduleId_key" ON "CourseReview"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "BiAuditLog_datasetId_idx" ON "BiAuditLog"("datasetId");

-- CreateIndex
CREATE INDEX "BiAuditLog_organizationId_idx" ON "BiAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "BiAuditLog_userId_idx" ON "BiAuditLog"("userId");

-- CreateIndex
CREATE INDEX "BiAuditLog_createdAt_idx" ON "BiAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CrossPillarEvent_organizationId_idx" ON "CrossPillarEvent"("organizationId");

-- CreateIndex
CREATE INDEX "CrossPillarEvent_userId_idx" ON "CrossPillarEvent"("userId");

-- CreateIndex
CREATE INDEX "CrossPillarEvent_pillarSource_idx" ON "CrossPillarEvent"("pillarSource");

-- CreateIndex
CREATE INDEX "CrossPillarEvent_createdAt_idx" ON "CrossPillarEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionTierConfig_category_idx" ON "SubscriptionTierConfig"("category");

-- CreateIndex
CREATE INDEX "SubscriptionTierConfig_isActive_idx" ON "SubscriptionTierConfig"("isActive");

-- CreateIndex
CREATE INDEX "SubscriptionTierConfig_sortOrder_idx" ON "SubscriptionTierConfig"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTierConfig_plan_category_key" ON "SubscriptionTierConfig"("plan", "category");

-- CreateIndex
CREATE INDEX "CommissionRateConfig_tier_idx" ON "CommissionRateConfig"("tier");

-- CreateIndex
CREATE INDEX "CommissionRateConfig_isActive_idx" ON "CommissionRateConfig"("isActive");

-- CreateIndex
CREATE INDEX "CommissionRateConfig_effectiveFrom_idx" ON "CommissionRateConfig"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRateConfig_tier_isActive_key" ON "CommissionRateConfig"("tier", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayConfig_gateway_key" ON "PaymentGatewayConfig"("gateway");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_isEnabled_idx" ON "PaymentGatewayConfig"("isEnabled");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_isDefault_idx" ON "PaymentGatewayConfig"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_category_idx" ON "FeatureFlag"("category");

-- CreateIndex
CREATE INDEX "FeatureFlag_isEnabled_idx" ON "FeatureFlag"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformLimitsConfig_key_key" ON "PlatformLimitsConfig"("key");

-- CreateIndex
CREATE INDEX "PlatformLimitsConfig_category_idx" ON "PlatformLimitsConfig"("category");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationConfig_channel_key" ON "NotificationConfig"("channel");

-- CreateIndex
CREATE INDEX "NotificationConfig_isEnabled_idx" ON "NotificationConfig"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityConfig_key_key" ON "SecurityConfig"("key");

-- CreateIndex
CREATE INDEX "SecurityConfig_category_idx" ON "SecurityConfig"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_category_idx" ON "Ticket"("category");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "Ticket_slaResponseDeadline_idx" ON "Ticket"("slaResponseDeadline");

-- CreateIndex
CREATE INDEX "Ticket_slaResolutionDeadline_idx" ON "Ticket"("slaResolutionDeadline");

-- CreateIndex
CREATE INDEX "Ticket_status_priority_idx" ON "Ticket"("status", "priority");

-- CreateIndex
CREATE INDEX "Ticket_userId_status_idx" ON "Ticket"("userId", "status");

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_status_idx" ON "Ticket"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "TicketMessage_senderId_idx" ON "TicketMessage"("senderId");

-- CreateIndex
CREATE INDEX "TicketMessage_createdAt_idx" ON "TicketMessage"("createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedInsight_token_key" ON "SharedInsight"("token");

-- CreateIndex
CREATE INDEX "SharedInsight_token_idx" ON "SharedInsight"("token");

-- CreateIndex
CREATE INDEX "SharedInsight_expiresAt_idx" ON "SharedInsight"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_transactionId_key" ON "LiveSession"("transactionId");

-- CreateIndex
CREATE INDEX "LiveSession_ownerId_idx" ON "LiveSession"("ownerId");

-- CreateIndex
CREATE INDEX "LiveSession_type_idx" ON "LiveSession"("type");

-- CreateIndex
CREATE INDEX "LiveSession_status_idx" ON "LiveSession"("status");

-- CreateIndex
CREATE INDEX "LiveSession_scheduledAt_idx" ON "LiveSession"("scheduledAt");

-- CreateIndex
CREATE INDEX "LiveSession_category_idx" ON "LiveSession"("category");

-- CreateIndex
CREATE INDEX "LiveSession_visibility_status_scheduledAt_idx" ON "LiveSession"("visibility", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "LiveSession_deletedAt_idx" ON "LiveSession"("deletedAt");

-- CreateIndex
CREATE INDEX "LiveSessionModuleLink_moduleId_idx" ON "LiveSessionModuleLink"("moduleId");

-- CreateIndex
CREATE INDEX "LiveSessionModuleLink_liveSessionId_idx" ON "LiveSessionModuleLink"("liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionModuleLink_moduleId_order_idx" ON "LiveSessionModuleLink"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionModuleLink_moduleId_liveSessionId_key" ON "LiveSessionModuleLink"("moduleId", "liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionParticipant_userId_idx" ON "LiveSessionParticipant"("userId");

-- CreateIndex
CREATE INDEX "LiveSessionParticipant_liveSessionId_idx" ON "LiveSessionParticipant"("liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionParticipant_liveSessionId_role_idx" ON "LiveSessionParticipant"("liveSessionId", "role");

-- CreateIndex
CREATE INDEX "LiveSessionParticipant_deletedAt_idx" ON "LiveSessionParticipant"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionParticipant_liveSessionId_userId_key" ON "LiveSessionParticipant"("liveSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionBooking_transactionId_key" ON "LiveSessionBooking"("transactionId");

-- CreateIndex
CREATE INDEX "LiveSessionBooking_userId_idx" ON "LiveSessionBooking"("userId");

-- CreateIndex
CREATE INDEX "LiveSessionBooking_liveSessionId_idx" ON "LiveSessionBooking"("liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionBooking_transactionId_idx" ON "LiveSessionBooking"("transactionId");

-- CreateIndex
CREATE INDEX "LiveSessionBooking_status_idx" ON "LiveSessionBooking"("status");

-- CreateIndex
CREATE INDEX "LiveSessionBooking_deletedAt_idx" ON "LiveSessionBooking"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionBooking_liveSessionId_userId_key" ON "LiveSessionBooking"("liveSessionId", "userId");

-- CreateIndex
CREATE INDEX "LiveSessionWaitlist_liveSessionId_idx" ON "LiveSessionWaitlist"("liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionWaitlist_userId_idx" ON "LiveSessionWaitlist"("userId");

-- CreateIndex
CREATE INDEX "LiveSessionWaitlist_deletedAt_idx" ON "LiveSessionWaitlist"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionWaitlist_liveSessionId_userId_key" ON "LiveSessionWaitlist"("liveSessionId", "userId");

-- CreateIndex
CREATE INDEX "LiveSessionChatMessage_liveSessionId_createdAt_idx" ON "LiveSessionChatMessage"("liveSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveSessionChatMessage_liveSessionId_messageType_idx" ON "LiveSessionChatMessage"("liveSessionId", "messageType");

-- CreateIndex
CREATE INDEX "LiveSessionReview_liveSessionId_idx" ON "LiveSessionReview"("liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionReview_userId_idx" ON "LiveSessionReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionReview_liveSessionId_userId_key" ON "LiveSessionReview"("liveSessionId", "userId");

-- CreateIndex
CREATE INDEX "LiveSessionCoHost_liveSessionId_idx" ON "LiveSessionCoHost"("liveSessionId");

-- CreateIndex
CREATE INDEX "LiveSessionCoHost_userId_idx" ON "LiveSessionCoHost"("userId");

-- CreateIndex
CREATE INDEX "LiveSessionCoHost_deletedAt_idx" ON "LiveSessionCoHost"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionCoHost_liveSessionId_userId_key" ON "LiveSessionCoHost"("liveSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HostCoupon_code_key" ON "HostCoupon"("code");

-- CreateIndex
CREATE INDEX "HostCoupon_creatorId_idx" ON "HostCoupon"("creatorId");

-- CreateIndex
CREATE INDEX "HostCoupon_code_idx" ON "HostCoupon"("code");

-- CreateIndex
CREATE INDEX "HostCoupon_liveSessionId_idx" ON "HostCoupon"("liveSessionId");

-- CreateIndex
CREATE INDEX "HostCoupon_deletedAt_idx" ON "HostCoupon"("deletedAt");

-- CreateIndex
CREATE INDEX "PortfolioItem_userId_idx" ON "PortfolioItem"("userId");

-- CreateIndex
CREATE INDEX "PortfolioItem_userId_createdAt_idx" ON "PortfolioItem"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");

-- CreateIndex
CREATE INDEX "PromoCode_deletedAt_idx" ON "PromoCode"("deletedAt");

-- CreateIndex
CREATE INDEX "FeaturePurchase_userId_featureKey_idx" ON "FeaturePurchase"("userId", "featureKey");

-- CreateIndex
CREATE INDEX "FeaturePurchase_userId_featureKey_expiresAt_idx" ON "FeaturePurchase"("userId", "featureKey", "expiresAt");

-- CreateIndex
CREATE INDEX "FeaturePurchase_featureKey_expiresAt_idx" ON "FeaturePurchase"("featureKey", "expiresAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowHold" ADD CONSTRAINT "EscrowHold_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowHold" ADD CONSTRAINT "EscrowHold_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "FreelancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorProfile" ADD CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerService" ADD CONSTRAINT "FreelancerService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEndorsement" ADD CONSTRAINT "SkillEndorsement_endorserId_fkey" FOREIGN KEY ("endorserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEndorsement" ADD CONSTRAINT "SkillEndorsement_endorsedId_fkey" FOREIGN KEY ("endorsedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFollow" ADD CONSTRAINT "OrgFollow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgFollow" ADD CONSTRAINT "OrgFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicDashboard" ADD CONSTRAINT "PublicDashboard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicDashboard" ADD CONSTRAINT "PublicDashboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryOrganizationId_fkey" FOREIGN KEY ("primaryOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsernameRedirect" ADD CONSTRAINT "UsernameRedirect_newUserId_fkey" FOREIGN KEY ("newUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAnswer" ADD CONSTRAINT "OnboardingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathModule" ADD CONSTRAINT "PathModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathModule" ADD CONSTRAINT "PathModule_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("certificateId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizUserAnswer" ADD CONSTRAINT "QuizUserAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizUserAnswer" ADD CONSTRAINT "QuizUserAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_freelancerProfileId_fkey" FOREIGN KEY ("freelancerProfileId") REFERENCES "FreelancerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ContractMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractMilestone" ADD CONSTRAINT "ContractMilestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_escrowHoldId_fkey" FOREIGN KEY ("escrowHoldId") REFERENCES "EscrowHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardDataset" ADD CONSTRAINT "DashboardDataset_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardDataset" ADD CONSTRAINT "DashboardDataset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Widget" ADD CONSTRAINT "Widget_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLModel" ADD CONSTRAINT "MLModel_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLModel" ADD CONSTRAINT "MLModel_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityIssue" ADD CONSTRAINT "QualityIssue_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAssessment" ADD CONSTRAINT "QualityAssessment_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ContractMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppearanceSettings" ADD CONSTRAINT "AppearanceSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacySettings" ADD CONSTRAINT "PrivacySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIntegration" ADD CONSTRAINT "UserIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySettings" ADD CONSTRAINT "SecuritySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOtpCode" ADD CONSTRAINT "EmailOtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCooldown" ADD CONSTRAINT "DeviceCooldown_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancedSettings" ADD CONSTRAINT "AdvancedSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookLog" ADD CONSTRAINT "PaymentWebhookLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAppeal" ADD CONSTRAINT "ReviewAppeal_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ContractReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAppeal" ADD CONSTRAINT "ReviewAppeal_appealerId_fkey" FOREIGN KEY ("appealerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ContractReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiAuditLog" ADD CONSTRAINT "BiAuditLog_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiAuditLog" ADD CONSTRAINT "BiAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiAuditLog" ADD CONSTRAINT "BiAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossPillarEvent" ADD CONSTRAINT "CrossPillarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossPillarEvent" ADD CONSTRAINT "CrossPillarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionModuleLink" ADD CONSTRAINT "LiveSessionModuleLink_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionModuleLink" ADD CONSTRAINT "LiveSessionModuleLink_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionParticipant" ADD CONSTRAINT "LiveSessionParticipant_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionParticipant" ADD CONSTRAINT "LiveSessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionBooking" ADD CONSTRAINT "LiveSessionBooking_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionBooking" ADD CONSTRAINT "LiveSessionBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionBooking" ADD CONSTRAINT "LiveSessionBooking_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionWaitlist" ADD CONSTRAINT "LiveSessionWaitlist_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionWaitlist" ADD CONSTRAINT "LiveSessionWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionChatMessage" ADD CONSTRAINT "LiveSessionChatMessage_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionChatMessage" ADD CONSTRAINT "LiveSessionChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionReview" ADD CONSTRAINT "LiveSessionReview_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionReview" ADD CONSTRAINT "LiveSessionReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionCoHost" ADD CONSTRAINT "LiveSessionCoHost_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionCoHost" ADD CONSTRAINT "LiveSessionCoHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostCoupon" ADD CONSTRAINT "HostCoupon_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostCoupon" ADD CONSTRAINT "HostCoupon_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturePurchase" ADD CONSTRAINT "FeaturePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

