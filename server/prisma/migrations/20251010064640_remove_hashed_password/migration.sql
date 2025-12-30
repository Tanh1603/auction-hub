/*
  Warnings:

  - You are about to drop the column `password_hash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `activity_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `asset_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `asset_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `asset_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `assets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auction_assets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auction_registrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auction_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auction_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `auto_bid_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bids` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `complaints` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contracts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_ratings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_roles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."activity_logs" DROP CONSTRAINT "activity_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."asset_categories" DROP CONSTRAINT "asset_categories_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."asset_documents" DROP CONSTRAINT "asset_documents_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."asset_documents" DROP CONSTRAINT "asset_documents_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."asset_images" DROP CONSTRAINT "asset_images_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."assets" DROP CONSTRAINT "assets_category_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."assets" DROP CONSTRAINT "assets_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_assets" DROP CONSTRAINT "auction_assets_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_assets" DROP CONSTRAINT "auction_assets_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_registrations" DROP CONSTRAINT "auction_registrations_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_registrations" DROP CONSTRAINT "auction_registrations_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_registrations" DROP CONSTRAINT "auction_registrations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_reports" DROP CONSTRAINT "auction_reports_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_reports" DROP CONSTRAINT "auction_reports_signed_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_sessions" DROP CONSTRAINT "auction_sessions_auctioneer_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_sessions" DROP CONSTRAINT "auction_sessions_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."auction_sessions" DROP CONSTRAINT "auction_sessions_winner_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auto_bid_settings" DROP CONSTRAINT "auto_bid_settings_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."auto_bid_settings" DROP CONSTRAINT "auto_bid_settings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."bids" DROP CONSTRAINT "bids_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."bids" DROP CONSTRAINT "bids_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."complaints" DROP CONSTRAINT "complaints_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."complaints" DROP CONSTRAINT "complaints_complainant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."complaints" DROP CONSTRAINT "complaints_defendant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."complaints" DROP CONSTRAINT "complaints_resolved_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."contracts" DROP CONSTRAINT "contracts_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."contracts" DROP CONSTRAINT "contracts_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."contracts" DROP CONSTRAINT "contracts_seller_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notification_preferences" DROP CONSTRAINT "notification_preferences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_registration_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_ratings" DROP CONSTRAINT "user_ratings_auction_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_ratings" DROP CONSTRAINT "user_ratings_rated_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_ratings" DROP CONSTRAINT "user_ratings_rater_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password_hash";

-- DropTable
DROP TABLE "public"."activity_logs";

-- DropTable
DROP TABLE "public"."asset_categories";

-- DropTable
DROP TABLE "public"."asset_documents";

-- DropTable
DROP TABLE "public"."asset_images";

-- DropTable
DROP TABLE "public"."assets";

-- DropTable
DROP TABLE "public"."auction_assets";

-- DropTable
DROP TABLE "public"."auction_registrations";

-- DropTable
DROP TABLE "public"."auction_reports";

-- DropTable
DROP TABLE "public"."auction_sessions";

-- DropTable
DROP TABLE "public"."auto_bid_settings";

-- DropTable
DROP TABLE "public"."bids";

-- DropTable
DROP TABLE "public"."complaints";

-- DropTable
DROP TABLE "public"."contracts";

-- DropTable
DROP TABLE "public"."notification_preferences";

-- DropTable
DROP TABLE "public"."notifications";

-- DropTable
DROP TABLE "public"."payments";

-- DropTable
DROP TABLE "public"."permissions";

-- DropTable
DROP TABLE "public"."role_permissions";

-- DropTable
DROP TABLE "public"."roles";

-- DropTable
DROP TABLE "public"."user_ratings";

-- DropTable
DROP TABLE "public"."user_roles";

-- DropEnum
DROP TYPE "public"."AssetStatus";

-- DropEnum
DROP TYPE "public"."AttendanceStatus";

-- DropEnum
DROP TYPE "public"."AuctionSessionStatus";

-- DropEnum
DROP TYPE "public"."AuctionType";

-- DropEnum
DROP TYPE "public"."BidType";

-- DropEnum
DROP TYPE "public"."ComplaintStatus";

-- DropEnum
DROP TYPE "public"."ComplaintType";

-- DropEnum
DROP TYPE "public"."ContractStatus";

-- DropEnum
DROP TYPE "public"."DocumentType";

-- DropEnum
DROP TYPE "public"."PaymentMethod";

-- DropEnum
DROP TYPE "public"."PaymentStatus";

-- DropEnum
DROP TYPE "public"."PaymentType";

-- DropEnum
DROP TYPE "public"."RegistrationStatus";

-- DropEnum
DROP TYPE "public"."ReportType";
