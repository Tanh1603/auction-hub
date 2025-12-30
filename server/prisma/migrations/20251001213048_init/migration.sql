-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('individual', 'business');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('draft', 'published', 'in_auction', 'sold', 'cancelled');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('legal', 'technical', 'valuation', 'other');

-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('ascending', 'descending', 'sealed_bid');

-- CreateEnum
CREATE TYPE "AuctionSessionStatus" AS ENUM ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('not_checked', 'checked_in', 'absent');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('deposit', 'participation_fee', 'winning_payment', 'refund');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bank_transfer', 'e_wallet', 'cash');

-- CreateEnum
CREATE TYPE "BidType" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('fraud', 'harassment', 'payment_issue', 'other');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('pending', 'investigating', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('success', 'failure', 'monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'signed', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(20),
    "full_name" VARCHAR(255) NOT NULL,
    "identity_number" VARCHAR(20),
    "user_type" "UserType" NOT NULL,
    "tax_id" VARCHAR(50),
    "avatar_url" VARCHAR(500),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "banned_at" TIMESTAMP,
    "email_verified_at" TIMESTAMP,
    "rating_score" DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,
    "deleted_at" TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50),
    "action" VARCHAR(50),
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parent_id" INTEGER,
    "slug" VARCHAR(100),
    "icon" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" INTEGER,
    "starting_price" DECIMAL(20,2) NOT NULL,
    "price_step" DECIMAL(20,2) NOT NULL,
    "max_price_steps" INTEGER NOT NULL DEFAULT 10,
    "status" "AssetStatus" NOT NULL DEFAULT 'draft',
    "owner_info" TEXT,
    "legal_status" TEXT,
    "location" VARCHAR(500),
    "valuation_document_url" VARCHAR(500),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,
    "deleted_at" TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_images" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_documents" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "document_url" VARCHAR(500) NOT NULL,
    "document_type" "DocumentType",
    "file_name" VARCHAR(255),
    "file_size" BIGINT,
    "mime_type" VARCHAR(100),
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_sessions" (
    "id" UUID NOT NULL,
    "session_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "auction_type" "AuctionType" NOT NULL DEFAULT 'ascending',
    "start_time" TIMESTAMP NOT NULL,
    "end_time" TIMESTAMP NOT NULL,
    "registration_deadline" TIMESTAMP NOT NULL,
    "deposit_amount" DECIMAL(20,2) NOT NULL,
    "participation_fee" DECIMAL(20,2),
    "min_participants" INTEGER NOT NULL DEFAULT 2,
    "max_participants" INTEGER,
    "status" "AuctionSessionStatus" NOT NULL DEFAULT 'draft',
    "auctioneer_id" UUID,
    "created_by" UUID NOT NULL,
    "winner_id" UUID,
    "winning_bid" DECIMAL(20,2),
    "completed_at" TIMESTAMP,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "auction_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_assets" (
    "auction_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "auction_assets_pkey" PRIMARY KEY ("auction_id","asset_id")
);

-- CreateTable
CREATE TABLE "auction_registrations" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'pending',
    "registration_time" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approval_time" TIMESTAMP,
    "approved_by" UUID,
    "rejection_reason" TEXT,
    "attendance_status" "AttendanceStatus" NOT NULL DEFAULT 'not_checked',
    "checked_in_at" TIMESTAMP,

    CONSTRAINT "auction_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "auction_id" UUID,
    "registration_id" UUID,
    "payment_type" "PaymentType" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_method" "PaymentMethod",
    "transaction_id" VARCHAR(100),
    "bank_code" VARCHAR(50),
    "payment_details" JSONB,
    "paid_at" TIMESTAMP,
    "refunded_at" TIMESTAMP,
    "refund_reason" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bid_amount" DECIMAL(20,2) NOT NULL,
    "bid_type" "BidType" NOT NULL DEFAULT 'manual',
    "is_winning_bid" BOOLEAN NOT NULL DEFAULT false,
    "is_withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawn_at" TIMESTAMP,
    "withdrawal_reason" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_bid_settings" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "max_amount" DECIMAL(20,2) NOT NULL,
    "increment_amount" DECIMAL(20,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "auto_bid_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "new_asset_notification" BOOLEAN NOT NULL DEFAULT true,
    "auction_reminder" BOOLEAN NOT NULL DEFAULT true,
    "bid_updates" BOOLEAN NOT NULL DEFAULT true,
    "result_notification" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(100),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ratings" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "rated_user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "complainant_id" UUID NOT NULL,
    "defendant_id" UUID,
    "auction_id" UUID,
    "complaint_type" "ComplaintType" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_urls" JSONB,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'pending',
    "resolution" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_reports" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "report_data" JSONB,
    "file_url" VARCHAR(500),
    "digital_signature" TEXT,
    "signed_by" UUID,
    "signed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID,
    "contract_number" VARCHAR(100),
    "contract_date" DATE,
    "total_amount" DECIMAL(20,2),
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "file_url" VARCHAR(500),
    "signed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_identity_number_key" ON "users"("identity_number");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_slug_key" ON "asset_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "auction_sessions_session_code_key" ON "auction_sessions"("session_code");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_number_key" ON "contracts"("contract_number");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_images" ADD CONSTRAINT "asset_images_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_auctioneer_id_fkey" FOREIGN KEY ("auctioneer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_sessions" ADD CONSTRAINT "auction_sessions_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_assets" ADD CONSTRAINT "auction_assets_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_assets" ADD CONSTRAINT "auction_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "auction_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_bid_settings" ADD CONSTRAINT "auto_bid_settings_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_bid_settings" ADD CONSTRAINT "auto_bid_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_complainant_id_fkey" FOREIGN KEY ("complainant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_defendant_id_fkey" FOREIGN KEY ("defendant_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_reports" ADD CONSTRAINT "auction_reports_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_reports" ADD CONSTRAINT "auction_reports_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auction_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
