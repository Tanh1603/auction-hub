@startuml
!theme plain
hide circle
skinparam linetype ortho

' Enums
enum UserType {
individual
business
}

enum UserRole {
bidder
auctioneer
admin
super_admin
}

enum PaymentType {
deposit
participation_fee
winning_payment
refund
}

enum PaymentStatus {
pending
processing
completed
failed
refunded
}

enum PaymentMethod {
bank_transfer
e_wallet
cash
}

enum AssetType {
secured_asset
land_use_rights
administrative_violation_asset
state_asset
enforcement_asset
other_asset
}

enum AuctionStatus {
scheduled
live
awaiting_result
success
failed
}

enum BidType {
manual
auto
}

enum ContractStatus {
draft
signed
cancelled
completed
}

enum AuditAction {
STATUS_OVERRIDE
BID_DENIED
PARTICIPANT_APPROVED
PARTICIPANT_REJECTED
AUCTION_FINALIZED
CONTRACT_CREATED
AUCTION_CREATED
AUCTION_UPDATED
AUCTION_CANCELLED
}

enum ArticleType {
news
auction_notice
auction_report
legal_document
}

' Models

entity "User" as users {
*id : uuid <<generated>>
--
*email : varchar(255) <<unique>>
phone_number : varchar(20) <<unique>>
*full_name : varchar(255)
identity_number : varchar(20) <<unique>>
*user_type : UserType
*role : UserRole <<default: bidder>>
tax_id : varchar(50)
avatar_url : varchar(500)
*is_verified : boolean <<default: false>>
*is_banned : boolean <<default: false>>
ban_reason : text
banned_at : timestamptz
email_verified_at : timestamptz
*rating_score : decimal(3, 2) <<default: 5.00>>
*total_ratings : int <<default: 0>>
*created_at : timestamptz <<default: now()>>
\*updated_at : timestamptz
deleted_at : timestamptz
}

entity "Auction" as auctions {
*id : uuid <<generated>>
--
*property_owner : jsonb
*name : varchar(255)
*code : varchar(55) <<unique>>
*sale_start_at : timestamptz
*sale_end_at : timestamptz
*sale_fee : decimal(18, 2)
*view_time : varchar(100)
*deposit_end_at : timestamptz
*deposit_amount_required : decimal(18, 2)
*auction_start_at : timestamptz
*auction_end_at : timestamptz
*asset_description : text
*asset_address : varchar(255)
*valid_check_in_before_start_minutes : int
*valid_check_in_after_start_minutes : int
*starting_price : decimal(18, 2)
reserve_price : decimal(18, 2)
*bid_increment : decimal(18, 2)
*asset_type : AssetType
*number_of_follow : int <<default: 0>>
*status : AuctionStatus <<default: scheduled>>
dossier_fee : decimal(18, 2)
deposit_percentage : decimal(5, 2)
*created_at : timestamptz <<default: now()>>
*updated_at : timestamptz
final_sale_price : decimal(18, 2)
commission_fee : decimal(18, 2)
starting_price_snapshot : decimal(18, 2)
dossier_fee_snapshot : decimal(18, 2)
deposit_amount_snapshot : decimal(18, 2)
total_auction_costs : decimal(18, 2)
total_fees_to_property_owner : decimal(18, 2) <<default: 0>>
net_amount_to_property_owner : decimal(18, 2) <<default: 0>>
calculation_details : json
financial_calculated_at : timestamptz
images : jsonb
attachments : jsonb
*asset_ward_id : int
\*asset_province_id : int
}

entity "Location" as locations {
*id : int
--
*name : string
*value : int
*sort_order : int
parent_id : int
}

entity "AuctionRelation" as auction_relations {
*auction_id : uuid
*related_auction_id : uuid
--
*created_at : timestamptz <<default: now()>>
*updated_at : timestamptz
}

entity "AuctionCost" as auction_costs {
*id : uuid <<generated>>
--
*auction_id : uuid <<unique>>
advertising_cost : decimal(18, 2) <<default: 0>>
venue_rental_cost : decimal(18, 2) <<default: 0>>
appraisal_cost : decimal(18, 2) <<default: 0>>
asset_viewing_cost : decimal(18, 2) <<default: 0>>
other_costs : json
*total_costs : decimal(18, 2) <<default: 0>>
documents : json
*created_at : timestamptz <<default: now()>>
\*updated_at : timestamptz
}

entity "SystemVariable" as system_variables {
*id : uuid <<generated>>
--
*category : varchar(100)
*key : varchar(255)
*value : text
*data_type : varchar(20) <<default: string>>
description : text
*is_active : boolean <<default: true>>
updated_by : uuid
*created_at : timestamptz <<default: now()>>
*updated_at : timestamptz
}

entity "AuctionParticipant" as auction_participants {
*id : uuid <<generated>>
--
*user_id : uuid
*auction_id : uuid
registered_at : timestamptz
submitted_at : timestamptz
documents_verified_at : timestamptz
documents_verified_by : uuid
documents_rejected_at : timestamptz
documents_rejected_reason : text
documents : jsonb
media : jsonb
deposit_paid_at : timestamptz
deposit_amount : decimal(18, 2)
deposit_payment_id : uuid
confirmed_at : timestamptz
confirmed_by : uuid
rejected_at : timestamptz
rejected_reason : varchar(255)
checked_in_at : timestamptz
withdrawn_at : timestamptz
withdrawal_reason : varchar(500)
*is_disqualified : boolean <<default: false>>
disqualified_at : timestamptz
disqualified_reason : varchar(500)
refund_status : varchar(50)
refund_requested_at : timestamptz
refund_processed_at : timestamptz
}

entity "AuctionBid" as auction_bids {
*id : uuid <<generated>>
--
*auction_id : uuid
*participant_id : uuid
*amount : decimal(18, 2)
*bid_at : timestamptz
*bid_type : BidType <<default: manual>>
*is_winning_bid : boolean <<default: false>>
*is_withdrawn : boolean <<default: false>>
withdrawn_at : timestamptz
withdrawal_reason : varchar(255)
denied_at : timestamptz
*is_denied : boolean <<default: false>>
denied_by : uuid
denied_reason : varchar(255)
*created_at : timestamptz <<default: now()>>
\*updated_at : timestamptz
}

entity "AutoBidSetting" as auto_bid_settings {
*id : uuid <<generated>>
--
*participant_id : uuid
*max_amount : decimal(20, 2)
*increment_amount : decimal(20, 2)
*is_active : boolean <<default: true>>
*created_at : timestamptz <<default: now()>>
\*updated_at : timestamptz
}

entity "Contract" as contracts {
*id : uuid <<generated>>
--
*auction_id : uuid
*winning_bid_id : uuid
property_owner_user_id : uuid
*buyer_user_id : uuid
*created_by : uuid
*price : decimal(18, 2)
*status : ContractStatus
signed_at : timestamptz
cancelled_at : timestamptz
doc_url : varchar(1000)
*created_at : timestamptz <<default: now()>>
\*updated_at : timestamptz
}

entity "AuctionAuditLog" as auction_audit_logs {
*id : uuid <<generated>>
--
*auction_id : uuid
*performed_by : uuid
*action : AuditAction
previous_status : AuctionStatus
new_status : AuctionStatus
reason : text
notes : text
metadata : json
\*created_at : timestamptz <<default: now()>>
}

entity "Payment" as payments {
*id : uuid <<generated>>
--
*user_id : uuid
auction_id : uuid
registration_id : uuid
*payment_type : PaymentType
*amount : decimal(20, 2)
*currency : varchar(3) <<default: VND>>
*status : PaymentStatus <<default: pending>>
payment_method : PaymentMethod
transaction_id : varchar(100)
bank_code : varchar(50)
payment_details : json
paid_at : timestamptz
refunded_at : timestamptz
refund_reason : text
*created_at : timestamptz <<default: now()>>
*updated_at : timestamptz
}

entity "Article" as articles {
*id : uuid <<generated>>
--
*type : ArticleType
*title : varchar(255)
*description : text
image : jsonb
*author : varchar(255)
*content : text
*created_at : timestamptz <<default: now()>>
*updated_at : timestamptz
}

entity "ArticleRelation" as article_relations {
*article_id : uuid
*related_article_id : uuid
}

' Relationships

auctions }o..|| locations : asset_ward
auctions }o..|| locations : asset_province

locations }o..|| locations : parent

auction_relations }o..|| auctions : auction
auction_relations }o..|| auctions : relatedAuction
auction_relations }o..|| auctions : primary_key(auction_id, related_auction_id)

auction_costs |o..|| auctions : auction

auction_participants }o..|| users : user
auction_participants }o..|| auctions : auction
auction_participants }o..|| users : documentsVerifier
auction_participants }o..|| users : confirmer

auction_bids }o..|| auctions : auction
auction_bids }o..|| auction_participants : participant
auction_bids }o..|| users : denier

auto_bid_settings }o..|| auction_participants : participant

contracts }o..|| auctions : auction
contracts }o..|| auction_bids : winningBid
contracts }o..|| users : propertyOwner
contracts }o..|| users : buyer
contracts }o..|| users : creator

auction_audit_logs }o..|| auctions : auction
auction_audit_logs }o..|| users : performedBy

payments }o..|| users : user

article_relations }o..|| articles : article
article_relations }o..|| articles : relatedArticle

@enduml
