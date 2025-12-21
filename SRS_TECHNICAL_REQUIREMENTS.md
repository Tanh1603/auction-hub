# Software Requirements Specification (SRS) - Technical Sections

# Section 2: Non-functional Requirements

### 2.1 User Access and Security

The system implements Role-Based Access Control (RBAC) to ensure secure access to resources. Authorization is enforced at the controller level using a `RolesGuard` and `@Roles` decorators, mapping users to specific permissions based on their `UserRole`.

**Actors:**
*   **Guest (G):** Unauthenticated user browsing public listings.
*   **Bidder (B):** Standard registered user interested in participating in auctions.
*   **Auctioneer (AC):** Operational staff responsible for creating and managing auction events.
*   **Admin (AD):** System administrator managing users, configurations, and approvals.
*   **Super Admin (SA):** Highest privilege level with full system-wide control.

**Legend:**
*   **X**: Full access to the feature.
*   **X(*)**: Access to own items/records only.
*   **X()**: Access to items assigned to the actor.

| Function / Controller | Guest | Bidder | Auctioneer | Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Authentication** | | | | | |
| Login / Register | X | | | | |
| Profile Management | | X(*) | X(*) | X(*) | X |
| **Auction Management** | | | | | |
| List/View Auctions | X | X | X | X | X |
| Create/Edit Auction | | | X | X | X |
| Delete Auction | | | | X | X |
| Update Auction Relations | | | X | X | X |
| **Bidding & Participation** | | | | | |
| Register to Bid | | X | | | |
| Place Manual/Auto Bid | | X(*) | | | |
| Withdraw Bid | | X(*) | | | |
| Manage Own Registrations| | X(*) | | | |
| **Administrative Actions** | | | | | |
| Verify Documents (Tier 1)| | | X() | X | X |
| Final Approval (Tier 2) | | | X() | X | X |
| Reject Registration | | | X() | X | X |
| Refund Processing | | | | X | X |
| **System Operations** | | | | | |
| Manage System Variables | | | | X | X |
| View Audit Logs | | | X() | X | X |
| Dashboard Analytics | | | X | X | X |

### 2.2 Performance Requirements

Based on the technical stack (NestJS, PostgreSQL 16, Prisma), the following performance benchmarks are established:

*   **Concurrent Users:** The system supports a minimum of 500 concurrent active sessions. During "Live" auction phases, the bidding engine is optimized to handle 100+ bids per second with sub-200ms latency.
*   **Data Volume:** The database schema is designed for scalability. The `AuctionBid` table is optimized for millions of entries using indexing, while `JsonB` fields for media allow flexible storage of extensive asset documentation.
*   **Availability:** The application targets 99.9% availability. Real-time updates for bidding rooms are handled via WebSocket/Event-driven patterns to ensure minimal lag.
*   **Usage Frequency:** High frequency during auction end-times; standard frequency for article reading and registration during off-peak hours.

### 2.3 Implementation Requirements

*   **Deployment:** The system is containerized using Docker. The production environment utilizes a multi-stage `Dockerfile` based on `node:20-alpine`.
*   **Maintenance:** Maintenance windows are typically scheduled during low-traffic periods (e.g., 02:00 - 04:00 AM). The system supports a "Maintenance Mode" via environment configuration.
*   **Read-only Timeframes:** During database migrations or significant version upgrades, the API enters a read-only state to prevent data corruption.

---

# Section 3: Other Requirements

### 3.1 Archive Function

The system employs "Soft Delete" and "State Archiving" to maintain historical records for legal compliance in the auction industry.

| List / Table | Archived By | Condition |
| :--- | :--- | :--- |
| **User** | Admin | Record is marked with `deletedAt`. User is blocked from login but history is retained. |
| **AuctionBid** | Bidder / Admin | Bids are never physically deleted. `isWithdrawn` or `isDenied` flags are used. |
| **Auction** | Auctioneer | Auctions reaching `success` or `failed` status are archived in the list view. |
| **AuctionParticipant**| Admin | `isDisqualified` flag archives the user's ability to bid without removing registration history. |

### 3.2 Security Audit

*   **Logging:** The system utilizes an `AuctionAuditLog` model to track sensitive administrative actions.
*   **Tracking:** Every critical state change (e.g., overriding auction status, denying a bid, final approval) records the `performedBy` (User ID), `action`, `previousStatus`, `newStatus`, and a mandatory `reason`.
*   **Audit Trail:** Admins can view a chronological timeline of modifications per auction via the `getAuctionAuditLogs` endpoint.

### 3.3 Auction Hub Sites

| Portal / Service | Description |
| :--- | :--- |
| **Client Portal** | Next.js frontend for Bidders to browse assets, manage profiles, and participate in live bidding. |
| **Admin Dashboard** | Management interface for Auctioneers and Admins to oversee events and approve participants. |
| **API Engine** | The NestJS backend service (server) handling business logic and third-party integrations (Stripe, Cloudinary). |
| **API Documentation** | Swagger/OpenAPI interactive documentation for technical integration. |

### 3.4 Auction Hub Lists

| Code | List Name | Description |
| :--- | :--- | :--- |
| **List01** | **Users** | Primary identity storage including roles (Bidder, Admin) and KYC verification status. |
| **List02** | **Auctions** | Master list of assets for sale, including timing, pricing, and status. |
| **List03** | **Participants** | Registration records linking users to specific auctions with document/deposit status. |
| **List04** | **Bids** | Immutable ledger of all manual and automatic bids placed in the system. |
| **List05** | **Payments** | Financial transaction records for deposits, fees, and final winning payments. |
| **List06** | **Contracts** | Post-auction legal agreements between buyers, sellers, and the platform. |
| **List07** | **Articles** | Content management for news, auction notices, and legal documentation. |
| **List08** | **System Config** | Key-value store for global variables like deposit percentages and service fees. |

### 3.5 Custom Pages

*   **Live Auction Room:** A real-time interface with WebSocket integration for active bidding.
*   **KYC Verification Page:** A specialized workflow for users to upload identity documents.

### 3.6 Scheduled Agents

The system uses `@nestjs/schedule` to manage background tasks.

| Agent Name | Frequency | Function |
| :--- | :--- | :--- |
| **Auto-Refund Service** | Daily (06:00) | Identifies losing bidders and initiates deposit refunds via Stripe/Bank transfer. |
| **Dashboard Refresher** | Hourly | Regenerates materialized views or cached analytics for the Admin dashboard. |

### 3.7 Technical Concern

*   **High Traffic (Concurrency):** During the final minutes of an auction, the system must handle high-volume bid submissions. Caching strategies (Redis) and database transaction isolation levels are critical.
*   **Large Data Volume:** The `AuctionBid` table grows rapidly. Partitioning strategies based on `auctionId` or `createdAt` should be considered for long-term growth.
*   **Security:** High-value transactions require encryption of sensitive user data and secure webhook handling for payments.
*   **Pagination:** All major lists (Auctions, Bids, Registrations) implement cursor-based or offset pagination to prevent UI rendering bottlenecks.

---

# Section 4: Appendixes

### 4.1 Glossary

*   **KYC:** Know Your Customer; the process of verifying a bidder's identity.
*   **Tier 1 Approval:** Verification of physical/legal documents submitted by a bidder.
*   **Tier 2 Approval:** Verification of the required deposit payment.
*   **Dossier Fee:** A non-refundable fee for accessing detailed auction documentation.
*   **Asset Type:** Classification of the item (e.g., Land Use Rights, State Asset).

### 4.3 Messages

| Message Code | Content | Button |
| :--- | :--- | :--- |
| `AUTH_001` | "Login successful. Welcome back!" | Ok |
| `BID_001` | "Bid placed successfully." | Ok |
| `BID_ERR_001` | "Bid amount must be higher than current price." | Ok |
| `REG_001` | "Your registration is pending document verification." | Ok |
| `ADMIN_001` | "Status override completed. Audit log updated." | Ok |
| `PAY_001` | "Payment confirmed. You are now authorized to bid." | Ok |
| `SYS_ERR_001` | "An unexpected error occurred. Please try again." | Ok |
