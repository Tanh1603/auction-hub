-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('bidder', 'auctioneer', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('deposit', 'participation_fee', 'winning_payment', 'refund');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bank_transfer', 'e_wallet', 'cash');

-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('secured_asset', 'land_use_rights', 'administrative_violation_asset', 'state_asset', 'enforcement_asset', 'other_asset');

-- CreateEnum
CREATE TYPE "auction_status" AS ENUM ('scheduled', 'live', 'awaiting_result', 'success', 'failed');

-- CreateEnum
CREATE TYPE "bid_type" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('draft', 'signed', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('STATUS_OVERRIDE', 'BID_DENIED', 'PARTICIPANT_APPROVED', 'PARTICIPANT_REJECTED', 'AUCTION_FINALIZED', 'CONTRACT_CREATED', 'AUCTION_CREATED', 'AUCTION_UPDATED', 'AUCTION_CANCELLED');

-- CreateEnum
CREATE TYPE "article_type" AS ENUM ('news', 'auction_notice', 'auction_report', 'legal_document');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'bidder',
ALTER COLUMN "banned_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "email_verified_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "auctions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_owner" JSONB NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(55) NOT NULL,
    "sale_start_at" TIMESTAMPTZ(6) NOT NULL,
    "sale_end_at" TIMESTAMPTZ(6) NOT NULL,
    "sale_fee" DECIMAL(18,2) NOT NULL,
    "view_time" VARCHAR(100) NOT NULL,
    "deposit_end_at" TIMESTAMPTZ(6) NOT NULL,
    "deposit_amount_required" DECIMAL(18,2) NOT NULL,
    "auction_start_at" TIMESTAMPTZ(6) NOT NULL,
    "auction_end_at" TIMESTAMPTZ(6) NOT NULL,
    "asset_description" TEXT NOT NULL,
    "asset_address" VARCHAR(255) NOT NULL,
    "valid_check_in_before_start_minutes" INTEGER NOT NULL,
    "valid_check_in_after_start_minutes" INTEGER NOT NULL,
    "starting_price" DECIMAL(18,2) NOT NULL,
    "reserve_price" DECIMAL(18,2),
    "bid_increment" DECIMAL(18,2) NOT NULL,
    "asset_type" "asset_type" NOT NULL,
    "number_of_follow" INTEGER NOT NULL DEFAULT 0,
    "status" "auction_status" NOT NULL DEFAULT 'scheduled',
    "dossier_fee" DECIMAL(18,2),
    "deposit_percentage" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "final_sale_price" DECIMAL(18,2),
    "commission_fee" DECIMAL(18,2),
    "starting_price_snapshot" DECIMAL(18,2),
    "dossier_fee_snapshot" DECIMAL(18,2),
    "deposit_amount_snapshot" DECIMAL(18,2),
    "total_auction_costs" DECIMAL(18,2),
    "total_fees_to_property_owner" DECIMAL(18,2) DEFAULT 0,
    "net_amount_to_property_owner" DECIMAL(18,2) DEFAULT 0,
    "calculation_details" JSONB,
    "financial_calculated_at" TIMESTAMPTZ(6),
    "images" JSONB,
    "attachments" JSONB,
    "asset_ward_id" INTEGER NOT NULL,
    "asset_province_id" INTEGER NOT NULL,

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_relations" (
    "auction_id" UUID NOT NULL,
    "related_auction_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auction_relations_pkey" PRIMARY KEY ("auction_id","related_auction_id")
);

-- CreateTable
CREATE TABLE "auction_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auction_id" UUID NOT NULL,
    "advertising_cost" DECIMAL(18,2) DEFAULT 0,
    "venue_rental_cost" DECIMAL(18,2) DEFAULT 0,
    "appraisal_cost" DECIMAL(18,2) DEFAULT 0,
    "asset_viewing_cost" DECIMAL(18,2) DEFAULT 0,
    "other_costs" JSONB,
    "total_costs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "documents" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auction_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_variables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" VARCHAR(100) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "data_type" VARCHAR(20) NOT NULL DEFAULT 'string',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "registered_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "documents_verified_at" TIMESTAMPTZ(6),
    "documents_verified_by" UUID,
    "documents_rejected_at" TIMESTAMPTZ(6),
    "documents_rejected_reason" TEXT,
    "documents" JSONB,
    "media" JSONB,
    "deposit_paid_at" TIMESTAMPTZ(6),
    "deposit_amount" DECIMAL(18,2),
    "deposit_payment_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejected_reason" VARCHAR(255),
    "checked_in_at" TIMESTAMPTZ(6),
    "withdrawn_at" TIMESTAMPTZ(6),
    "withdrawal_reason" VARCHAR(500),

    CONSTRAINT "auction_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_bids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auction_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bid_at" TIMESTAMPTZ(6) NOT NULL,
    "bid_type" "bid_type" NOT NULL DEFAULT 'manual',
    "is_winning_bid" BOOLEAN NOT NULL DEFAULT false,
    "is_withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawn_at" TIMESTAMPTZ(6),
    "withdrawal_reason" VARCHAR(255),
    "denied_at" TIMESTAMPTZ(6),
    "is_denied" BOOLEAN NOT NULL DEFAULT false,
    "denied_by" UUID,
    "denied_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_bid_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participant_id" UUID NOT NULL,
    "max_amount" DECIMAL(20,2) NOT NULL,
    "increment_amount" DECIMAL(20,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auto_bid_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auction_id" UUID NOT NULL,
    "winning_bid_id" UUID NOT NULL,
    "property_owner_user_id" UUID,
    "buyer_user_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "status" "contract_status" NOT NULL,
    "signed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "doc_url" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auction_id" UUID NOT NULL,
    "performed_by" UUID NOT NULL,
    "action" "audit_action" NOT NULL,
    "previous_status" "auction_status",
    "new_status" "auction_status",
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_audit_logs_pkey" PRIMARY KEY ("id")
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
    "paid_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "refund_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "article_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "image" JSONB,
    "author" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_relations" (
    "articleId" UUID NOT NULL,
    "relatedArticleId" UUID NOT NULL,

    CONSTRAINT "article_relations_pkey" PRIMARY KEY ("articleId","relatedArticleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "auctions_code_key" ON "auctions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "auction_costs_auction_id_key" ON "auction_costs"("auction_id");

-- CreateIndex
CREATE INDEX "system_variables_category_idx" ON "system_variables"("category");

-- CreateIndex
CREATE UNIQUE INDEX "system_variables_category_key_key" ON "system_variables"("category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "auction_participants_auction_id_user_id_key" ON "auction_participants"("auction_id", "user_id");

-- CreateIndex
CREATE INDEX "article_relations_articleId_idx" ON "article_relations"("articleId");

-- CreateIndex
CREATE INDEX "article_relations_relatedArticleId_idx" ON "article_relations"("relatedArticleId");

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_asset_ward_id_fkey" FOREIGN KEY ("asset_ward_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_asset_province_id_fkey" FOREIGN KEY ("asset_province_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_relations" ADD CONSTRAINT "auction_relations_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_relations" ADD CONSTRAINT "auction_relations_related_auction_id_fkey" FOREIGN KEY ("related_auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_costs" ADD CONSTRAINT "auction_costs_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_documents_verified_by_fkey" FOREIGN KEY ("documents_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_participants" ADD CONSTRAINT "auction_participants_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "auction_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_denied_by_fkey" FOREIGN KEY ("denied_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_bid_settings" ADD CONSTRAINT "auto_bid_settings_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "auction_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_winning_bid_id_fkey" FOREIGN KEY ("winning_bid_id") REFERENCES "auction_bids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_property_owner_user_id_fkey" FOREIGN KEY ("property_owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_audit_logs" ADD CONSTRAINT "auction_audit_logs_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_audit_logs" ADD CONSTRAINT "auction_audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_relations" ADD CONSTRAINT "article_relations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_relations" ADD CONSTRAINT "article_relations_relatedArticleId_fkey" FOREIGN KEY ("relatedArticleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
