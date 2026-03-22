# System Deployment Architecture - Auction Hub

This document provides a reverse-engineered UML Deployment Diagram and a proposed Physical Infrastructure Diagram for the Auction Hub project.

## 1. Logical Deployment Diagram (UML)

This diagram represents the logical nodes and artifacts as defined in the current `docker-compose.yml` and environment configurations.

```mermaid
graph LR
    %% Subgraphs and Nodes
    subgraph "Client Side"
        Browser["🌐 Web Browser<br/>(User Device)"]
    end

    subgraph "Frontend Layer"
        NextJS["📦 Next.js Frontend<br/>(SSR & Client)"]
    end

    subgraph "Backend Layer (Docker Environment)"
        direction TB

        subgraph "Application Container"
            NestJS["📦 NestJS API Server<br/>(Port: 3000)<br/><i>Includes: Prisma ORM, BullMQ Workers</i>"]
        end

        subgraph "Data Persistence"
            direction TB
            Redis[("⚡ Redis Alpine<br/>(Cache/Queue)<br/>Port: 6379")]
            Postgres[("🐘 PostgreSQL 16<br/>(Primary DB)<br/>Port: 5432")]
        end
    end

    subgraph "External Cloud Services"
        direction TB
        Supabase["🔐 Supabase<br/>(Auth/BaaS)"]
        Cloudinary["🖼️ Cloudinary<br/>(Media)"]
        Stripe["💳 Stripe<br/>(Payments)"]
        SMTP["📧 SMTP Provider<br/>(Email)"]
    end

    %% Client Interactions
    Browser -->|HTTPS| NextJS
    Browser -.->|WSS (Socket.io)| NestJS

    %% Frontend to Backend
    NextJS -->|HTTP REST API /api/*| NestJS

    %% Backend Internal Flows
    NestJS -->|Job Data| Redis
    NestJS -->|TCP Connection| Postgres

    %% External Service Integrations
    NestJS -->|HTTPS| Supabase
    NestJS -->|HTTPS| Cloudinary
    NestJS -->|HTTPS| Stripe
    NestJS -->|SMTP| SMTP

    %% Styles
    classDef device fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef container fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef app fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef db fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef ext fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class Browser device
    class NextJS container
    class NestJS app
    class Redis,Postgres db
    class Supabase,Cloudinary,Stripe,SMTP ext
```

---

## 2. Physical Deployment Diagram (Proposed Production Infrastructure)

In a live production environment, the services would likely be distributed across public and private subnets for enhanced security and scalability. Note that the Frontend (Vercel) and DNS exist at the Global Edge, outside the VPC.

```mermaid
graph LR
    subgraph "Global Edge Network"
        UserDevice["💻 User Device<br/>(Browser/App)"]
        DNS["🌐 DNS<br/>(Route 53 / Cloudflare)"]
        CDN["⚡ Edge Network / CDN<br/>(Vercel / CloudFront)"]
    end

    subgraph "Cloud Infrastructure (VPC)"

        subgraph "Public Subnet (DMZ)"
            LB["⚖️ Load Balancer<br/>(ALB / NGINX)"]
        end

        subgraph "Private Subnet (App Tier)"
            AppCluster["🐳 Application Cluster<br/>(NestJS Containers)<br/>Autoscaling Group"]
        end

        subgraph "Private Subnet (Data Tier)"
            RDS[("🐘 Managed DB<br/>(RDS / Cloud SQL)")]
            ElastiCache[("⚡ Managed Redis<br/>(ElastiCache)")]
        end
    end

    subgraph "Managed External Services"
        AuthService["🔐 Supabase Auth"]
        MediaService["🖼️ Cloudinary"]
        PaymentService["💳 Stripe"]
        EmailService["📧 Email Service"]
    end

    %% Network Flow
    UserDevice -->|HTTPS| DNS
    DNS -->|Resolved IP| LB
    DNS -->|Static Assets| CDN

    CDN -->|API Calls (Proxied)| LB
    LB -->|Forward:3000| AppCluster

    %% Application Flow
    AppCluster -->|SQL| RDS
    AppCluster -->|Cache/Queue| ElastiCache

    %% External Integrations
    AppCluster -->|Auth Verify| AuthService
    AppCluster -->|Uploads| MediaService
    AppCluster -->|Process| PaymentService
    AppCluster -->|Send| EmailService

    %% Styles
    style UserDevice fill:#fafafa,stroke:#333
    style DNS fill:#fff,stroke:#333,stroke-dasharray: 5 5
    style CDN fill:#e0f7fa,stroke:#0097a7
    style LB fill:#fff9c4,stroke:#fbc02d
    style AppCluster fill:#ffe0b2,stroke:#f57c00
    style RDS fill:#e1bee7,stroke:#8e24aa
    style ElastiCache fill:#ef9a9a,stroke:#c62828
```

---

## 3. Deployment Mapping & Artifacts

| Component       | Technology       | Build Artifact            | Target Node             |
| :-------------- | :--------------- | :------------------------ | :---------------------- |
| **API Backend** | NestJS / Node.js | `dist/server/main.js`     | Docker Container        |
| **Frontend**    | Next.js / React  | `.next/` standalone build | Vercel / Static Hosting |
| **Database**    | PostgreSQL 16    | SQL Schema (Prisma)       | Managed DB Instance     |
| **Cache/Queue** | Redis Alpine     | Key-Value Store           | Managed Redis Instance  |
| **Auth**        | Supabase         | JWT / OAuth               | External BaaS           |
| **Media**       | Cloudinary       | Upload API                | External CDN            |
| **Payments**    | Stripe           | SDK / Webhooks            | External Gateway        |

## 4. Assumptions & Infrastructure Notes

1.  **Frontend Deployment**: While the project has a `client` folder, it is not explicitly containerized in the root `docker-compose.yml`. We assume it will be deployed to a platform like Vercel or as a static site behind a CDN.
2.  **Stateless API**: The NestJS backend is designed to be stateless, allowing it to scale horizontally within the "App Tier Cluster".
3.  **Background Jobs**: BullMQ workers run within the Node.js process (or sidecar containers) but share the same codebase.
4.  **Database Persistence**: In production, we move from a Docker local volume to a managed database service (RDS) for automated backups and multi-AZ availability.
5.  **Security**: The backend and database are isolated in private subnets, accessible only through the Load Balancer or specific VPC gateways.
