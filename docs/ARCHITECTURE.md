# System Architecture Documentation

This document provides visual representations of the system's data structure and core application logic.

## 1. High-Level System Architecture

This section provides a bird's-eye view of the Auction Hub platform, illustrating how clients interact with the backend infrastructure, external services, and data layers. The system follows a monolith architecture built on NestJS, employing Redis for background job queueing and third-party APIs for extended functionality.

```mermaid
flowchart TB
    subgraph Clients["Clients"]
        Web["Web Application\n(Browser)"]
    end

    subgraph ExternalServices["External Third-Party Services"]
        Supabase["Supabase\n(Identity & Authentication)"]
        Cloudinary["Cloudinary\n(Media & Image Storage)"]
        Stripe["Stripe\n(Payment Gateway)"]
    end

    subgraph BackendAPI["Auction Hub Backend (NestJS)"]
        Gateway["Controllers & Gateways\n(REST API & WebSockets)"]

        subgraph CoreModules["Service Modules"]
            AuthMod["Auth Service"]
            AuctionMod["Auction Service"]
            ContractMod["Contract Service"]
            PaymentMod["Payment Service"]
            ArticleMod["Article Service"]
        end

        subgraph BackgroundProcessors["Asynchronous Processing"]
            AuctionWorker["Auction Processor\n(Job Worker)"]
        end

        Gateway --> CoreModules
    end

    subgraph DataLayer["Data & Persistence Layer"]
        Postgres[(PostgreSQL\nPrimary Database)]
        Redis[(Redis\nQueue & Caching)]
    end

    Clients -->|HTTPS Requests| Gateway
    Clients .->|WebSocket Events| Gateway

    AuthMod -->|Validate Tokens| Supabase
    CoreModules -->|Upload Assets| Cloudinary
    PaymentMod <-->|Checkout & Webhooks| Stripe

    CoreModules -->|Prisma ORM| Postgres
    AuctionWorker -->|Prisma ORM| Postgres

    AuctionMod -->|Schedule via BullMQ| Redis
    Redis -->|Consume Jobs| AuctionWorker
```

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ AuctionParticipant : "participates"
    User ||--o{ AuctionBid : "places"
    User ||--o{ Contract : "buyer/seller"
    User ||--o{ Payment : "makes"
    User ||--o{ AuctionAuditLog : "performs"

    Auction ||--o{ AuctionParticipant : "has"
    Auction ||--o{ AuctionBid : "contains"
    Auction ||--o{ Contract : "results in"
    Auction ||--|{ AuctionCost : "incurs"
    Auction ||--o{ AuctionAuditLog : "logged"
    Auction }o--|| Location : "Province"
    Auction }o--|| Location : "Ward"

    AuctionParticipant ||--o{ AuctionBid : "submits"
    Contract ||--|| AuctionBid : "winning bid"
    Location |o--o{ Location : "hierarchy"

    User {
        UUID id PK
        VARCHAR email
        VARCHAR full_name
        UserType user_type
        UserRole role
        VARCHAR phone_number
        VARCHAR identity_number
        VARCHAR tax_id
        BOOLEAN is_verified
        BOOLEAN is_banned
        DECIMAL rating_score
    }

    Auction {
        UUID id PK
        VARCHAR code
        VARCHAR name
        JSONB property_owner
        AuctionStatus status
        AssetType asset_type
        TIMESTAMPTZ sale_start_at
        TIMESTAMPTZ sale_end_at
        TIMESTAMPTZ auction_start_at
        TIMESTAMPTZ auction_end_at
        DECIMAL starting_price
        DECIMAL deposit_amount_required
        INTEGER asset_province_id
        INTEGER asset_ward_id
    }

    AuctionCost {
        UUID id PK
        UUID auction_id FK
        DECIMAL total_costs
        DECIMAL advertising_cost
        DECIMAL venue_rental_cost
        DECIMAL appraisal_cost
    }

    AuctionParticipant {
        UUID id PK
        UUID user_id FK
        UUID auction_id FK
        VARCHAR status
        VARCHAR deposit_status
        BOOLEAN is_disqualified
    }

    AuctionBid {
        UUID id PK
        UUID auction_id FK
        UUID participant_id FK
        DECIMAL amount
        BidType bid_type
        BOOLEAN is_winning_bid
    }

    Contract {
        UUID id PK
        UUID auction_id FK
        UUID winning_bid_id FK
        UUID buyer_user_id FK
        UUID created_by FK
        DECIMAL price
        ContractStatus status
        UUID property_owner_user_id FK
        TIMESTAMPTZ signed_at
        TIMESTAMPTZ cancelled_at
    }

    Payment {
        UUID id PK
        UUID user_id FK
        PaymentType payment_type
        DECIMAL amount
        PaymentStatus status
        UUID auction_id
        UUID registration_id
        VARCHAR transaction_id
    }

    Location {
        INTEGER id PK
        VARCHAR name
        INTEGER parent_id
    }

    AuctionAuditLog {
        UUID id PK
        UUID auction_id FK
        UUID performed_by FK
        AuditAction action
    }
```

## 3. High-Detail Class Diagram

This diagram provides an exhaustive view of the system's architecture, including Controllers, Services, DTOs, Background Processors, and their complex inter-dependencies.

```mermaid
classDiagram
    class PrismaService {
        +user: Prisma.UserDelegate
        +auction: Prisma.AuctionDelegate
        +contract: Prisma.ContractDelegate
        +payment: Prisma.PaymentDelegate
        +article: Prisma.ArticleDelegate
        +location: Prisma.LocationDelegate
    }
    class SupabaseService {
        +auth: SupabaseAuthClient
        +authAdmin: SupabaseAuthAdminClient
    }
    class CloudinaryService {
        +uploadFile(file)
        +deleteFile(publicId)
        +deleteMultipleFiles(publicIds)
    }
    class PdfGeneratorService {
        +generateContractPdf(data)
        +generateContractPdfEnglish(data)
    }

    class AuthController {
        -authService: AuthService
        +register(dto)
        +login(dto)
        +forgotPassword(dto)
        +verifyEmail(dto)
    }
    class AuthService {
        -prisma: PrismaService
        -supabase: SupabaseService
        +register(request)
        +login(request)
        +validateUniqueFields(request)
    }
    class UserService {
        -prisma: PrismaService
        -supabase: SupabaseService
        +registerUser(token, req)
        +promoteUser(token, userId, data)
        +getCurrentUser(token)
    }

    class AuctionController {
        -auctionService: AuctionService
        +findAll(query)
        +findOne(id)
        +create(dto)
        +update(id, dto)
        +remove(id)
        +updateRelation(id, dto)
    }
    class AuctionService {
        -prisma: PrismaService
        -cloudinary: CloudinaryService
        -auctionQueue: Queue
        +findAll(query)
        +findOne(id)
        +create(dto)
        +update(id, dto)
        +updateRelations(id, relatedIds)
        -toAuctionDetail(entity)
    }
    class AuctionProcessor {
        -prisma: PrismaService
        +process(job)
        +openAuction(id)
        +closeAuction(id)
    }
    class AuctionQueue {
        +AUCTION_QUEUE string
        +ADD_JOB(name, data)
    }

    class ContractController {
        -contractService: ContractService
        +findAll(query, user)
        +findOne(id, user)
        +create(dto, user)
        +sign(id, dto, user)
        +cancel(id, dto, user)
        +exportToPdf(id, user)
    }
    class ContractService {
        -prisma: PrismaService
        -pdfGenerator: PdfGeneratorService
        +findAll(query, userId)
        +findOne(id, userId)
        +create(dto, userId)
        +sign(id, dto, userId)
        +exportToPdf(id, userId)
        -checkAccess(contract, userId)
    }

    class PaymentController {
        -paymentService: PaymentService
        +createPayment(dto)
        +verifyPayment(sessionId)
    }
    class PaymentService {
        -prisma: PrismaService
        -stripe: Stripe
        +createPayment(userId, req)
        +verifyPayment(sessionId)
        +constructEvent(payload, sig)
        -isZeroDecimalCurrency(currency)
    }
    class PaymentWebhookController {
        -paymentService: PaymentService
        +handleWebhook(payload, sig)
    }

    class ArticleController {
        -articleService: ArticleService
        +findAll(query)
        +findOne(id)
        +create(dto)
    }
    class ArticleService {
        -prisma: PrismaService
        -cloudinary: CloudinaryService
        +findAll(query)
        +create(dto)
        +updateRelations(id, relatedIds)
    }

    AuthController ..> AuthService
    AuctionController ..> AuctionService
    ContractController ..> ContractService
    PaymentController ..> PaymentService
    PaymentWebhookController ..> PaymentService
    ArticleController ..> ArticleService

    AuthService ..> PrismaService
    AuthService ..> SupabaseService
    UserService ..> PrismaService
    UserService ..> SupabaseService

    AuctionService ..> PrismaService
    AuctionService ..> CloudinaryService
    AuctionService ..> AuctionQueue : "schedules"

    AuctionProcessor ..> PrismaService
    AuctionProcessor --|> WorkerHost

    ContractService ..> PrismaService
    ContractService ..> PdfGeneratorService

    PaymentService ..> PrismaService

    ArticleService ..> PrismaService
    ArticleService ..> CloudinaryService
```

## 4. Interaction Diagram (General Logic Flow)

This diagram shows how a common request (e.g., Creating an Auction) flows through the system.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AC as AuctionController
    participant AS as AuctionService
    participant PS as PrismaService
    participant AQ as AuctionQueue
    participant CS as CloudinaryService

    Admin->>AC: POST /auctions (CreateAuctionDto)
    AC->>AS: create(dto)
    AS->>PS: transaction(db.auction.create)
    PS-->>AS: auctionEntity
    AS->>AQ: addJob(OPEN_AUCTION, delay)
    AS->>AQ: addJob(CLOSE_AUCTION, delay)
    AS-->>AC: success message
    AC-->>Admin: 201 Created

    Note over Admin, CS: Later (Time to Open)

    AQ->>AuctionProcessor: process(OPEN_AUCTION)
    AuctionProcessor->>PS: update status to LIVE
```
