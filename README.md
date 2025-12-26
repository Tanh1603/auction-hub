<p align="center">
  <img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="60" alt="Nx Logo">
</p>

<h1 align="center">🔨 Auction Hub</h1>
<p align="center">
  <strong>A comprehensive Vietnamese auction platform implementing legal regulations for asset auctions</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#testing">Testing</a> •
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io">
  <img src="https://img.shields.io/badge/Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe">
</p>

---

## 📖 Overview

**Auction Hub** is a full-stack online auction platform designed specifically for the Vietnamese market. It implements legal regulations for asset auctions in accordance with Vietnamese law (Nghị định 17/2010/NĐ-CP), providing a secure, real-time bidding environment for various asset types.

### Supported Asset Types

| Asset Type                         | Vietnamese Name            |
| ---------------------------------- | -------------------------- |
| 🏦 Secured Assets                  | Tài sản bảo đảm            |
| 🏞️ Land Use Rights                 | Quyền sử dụng đất          |
| ⚖️ Administrative Violation Assets | Tài sản vi phạm hành chính |
| 🏛️ State Assets                    | Tài sản nhà nước           |
| 📜 Enforcement Assets              | Tài sản thi hành án        |
| 📦 Other Assets                    | Tài sản khác               |

---

## ✨ Features

### 🎯 Core Functionality

- **Real-time Bidding** - WebSocket-powered live auction rooms with instant bid updates
- **Two-Tier Approval System** - Document verification (Tier 1) + Deposit verification (Tier 2)
- **Auto-Bidding** - Automated bidding system for convenience
- **Secure Payments** - Stripe integration for deposits and winning payments
- **Contract Generation** - PDF contract generation for auction winners
- **Multi-Role Support** - Guest, Bidder, Auctioneer, Admin, and Super Admin roles

### 📊 Business Features

- **Auction Management** - Complete lifecycle from creation to finalization
- **Registration System** - KYC verification and document management
- **Refund Processing** - Automatic and manual refund handling
- **Cost Management** - Track auction-related expenses
- **Dashboard Analytics** - Real-time insights and reporting
- **Audit Logging** - Comprehensive action tracking for compliance

### 🔐 Security & Compliance

- **Role-Based Access Control (RBAC)** - Granular permission management
- **Vietnamese Legal Compliance** - Follows Nghị định 17/2010/NĐ-CP
- **Secure Authentication** - Supabase Auth with JWT tokens
- **Email Verification** - Mandatory email confirmation for accounts

---

## 🛠️ Tech Stack

### Backend

| Technology                                   | Purpose                   |
| -------------------------------------------- | ------------------------- |
| [NestJS](https://nestjs.com/)                | Backend framework         |
| [PostgreSQL 16](https://www.postgresql.org/) | Primary database          |
| [Prisma](https://www.prisma.io/)             | ORM & database management |
| [Socket.io](https://socket.io/)              | Real-time communication   |
| [BullMQ](https://docs.bullmq.io/)            | Job queue processing      |
| [Redis](https://redis.io/)                   | Caching & queue backend   |

### Frontend

| Technology                              | Purpose               |
| --------------------------------------- | --------------------- |
| [Next.js 15](https://nextjs.org/)       | React framework       |
| [React 19](https://react.dev/)          | UI library            |
| [TailwindCSS](https://tailwindcss.com/) | Styling               |
| [Radix UI](https://www.radix-ui.com/)   | Accessible components |
| [Recharts](https://recharts.org/)       | Data visualization    |

### Services & Integrations

| Service                               | Purpose            |
| ------------------------------------- | ------------------ |
| [Supabase](https://supabase.com/)     | Authentication     |
| [Stripe](https://stripe.com/)         | Payment processing |
| [Cloudinary](https://cloudinary.com/) | Media storage      |
| [Nodemailer](https://nodemailer.com/) | Email delivery     |

### DevOps & Tooling

| Tool                              | Purpose             |
| --------------------------------- | ------------------- |
| [Nx](https://nx.dev/)             | Monorepo management |
| [Docker](https://www.docker.com/) | Containerization    |
| [Jest](https://jestjs.io/)        | Testing framework   |
| [Swagger](https://swagger.io/)    | API documentation   |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** & **Docker Compose** (for local development)
- **PostgreSQL 16** (if not using Docker)
- **Redis** (if not using Docker)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/auction-hub.git
   cd auction-hub
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp server/.env.example server/.env
   ```

   Configure the following in `server/.env`:

   - `DATABASE_URL` - PostgreSQL connection string
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` - Supabase credentials
   - `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET` - Stripe API keys
   - `CLOUDINARY_*` - Cloudinary configuration
   - `SMTP_*` - Email server settings

4. **Start services with Docker** (recommended)

   ```bash
   npm run docker:start
   ```

   Or start individual services:

   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**

   ```bash
   npx prisma db push --schema=server/prisma/schema.prisma
   ```

6. **Seed the database**
   ```bash
   npm run db:seed
   ```

### Development

**Start the backend server:**

```bash
npx nx serve server
```

**Start the frontend client:**

```bash
npx nx serve client
```

**Run both simultaneously:**

```bash
npx nx run-many -t serve -p server client
```

### Build for Production

```bash
# Build backend
npx nx build server

# Build frontend
npx nx build client
```

---

## 📚 Documentation

| Document                                                             | Description                        |
| -------------------------------------------------------------------- | ---------------------------------- |
| [📋 SRS - Functional Requirements](./SRS_FUNCTIONAL_REQUIREMENTS.md) | Complete functional specifications |
| [⚙️ SRS - Technical Requirements](./SRS_TECHNICAL_REQUIREMENTS.md)   | Non-functional & technical specs   |
| [🔌 WebSocket Integration Guide](./WEBSOCKET_INTEGRATION_GUIDE.md)   | Real-time bidding implementation   |
| [📮 Postman API Testing Guide](./POSTMAN_API_TESTING_GUIDE.md)       | API testing with Postman           |
| [🧪 Quick Test Setup](./QUICK_TEST_SETUP_GUIDE.md)                   | Fast testing environment setup     |
| [📊 Project Diagrams](./project_diagrams.md)                         | Architecture & flow diagrams       |

### API Documentation

Additional API documentation is available in the `API_DOCUMENTATION/` directory:

- `01_AUTHENTICATION.md` - Auth endpoints
- `02_REGISTER_TO_BID.md` - Registration system
- `03_BIDDING.md` - Bidding mechanics
- `04_FINALIZATION_PAYMENT.md` - Post-auction processes
- `05_AUCTIONS.md` - Auction CRUD operations
- `06_AUCTION_POLICY.md` - Policy configurations
- `07_AUCTION_COSTS.md` - Cost management
- `08_REFUNDS.md` - Refund processing

### Swagger/OpenAPI

Interactive API documentation is available at `/api/docs` when the server is running.

---

## 🧪 Testing

### Integration Tests

The project includes comprehensive integration tests organized by feature:

```bash
# Run all integration tests
npm run test:integration

# Run with verbose output
npm run test:integration:verbose

# Run with coverage
npm run test:integration:coverage

# Run specific feature tests
npm run test:3.1    # User Management
npm run test:3.2    # Authentication
npm run test:3.3    # Auction Management
npm run test:3.4    # Registration to Bid
npm run test:3.5    # Bidding System
npm run test:3.6    # Auction Finalization
npm run test:3.7    # Payment
npm run test:3.8    # Auction Costs
npm run test:3.9    # System Config
npm run test:3.10   # Locations
npm run test:3.11   # Articles
npm run test:3.12   # Contracts

# Security tests
npm run test:4.1    # Security (IDOR, SQL Injection, etc.)

# Reliability tests
npm run test:5.1    # Race conditions, Idempotency, Concurrency
```

### WebSocket Testing

HTML-based WebSocket test interfaces are available:

- `websocket-test.html` - Basic connection testing
- `websocket-full-test.html` - Comprehensive bidding tests

---

## 🐳 Deployment

### Docker Compose (Development)

```bash
# Start all services
npm run docker:start

# View logs
npm run docker:logs

# Stop all services
npm run docker:stop
```

### Docker Compose Services

| Service    | Port | Description         |
| ---------- | ---- | ------------------- |
| `postgres` | 5432 | PostgreSQL database |
| `redis`    | 6379 | Redis cache & queue |
| `backend`  | 3000 | NestJS API server   |

### Production Deployment

The project includes a production-ready `Dockerfile` using multi-stage builds:

```bash
docker build -t auction-hub .
docker run -p 3000:3000 --env-file server/.env auction-hub
```

---

## 📁 Project Structure

```
auction-hub/
├── client/                 # Next.js frontend application
│   ├── src/
│   │   └── app/           # App router pages & components
│   └── public/            # Static assets
├── server/                 # NestJS backend application
│   ├── src/
│   │   ├── app/           # Application module
│   │   ├── auth/          # Authentication module
│   │   ├── auctions/      # Auction management
│   │   ├── feature/       # Feature modules
│   │   ├── payment/       # Payment processing
│   │   └── common/        # Shared utilities
│   └── prisma/            # Database schema & migrations
├── libs/                   # Shared libraries
├── test/                   # Integration tests
│   └── integration/       # Feature-based tests
├── API_DOCUMENTATION/      # API guides
├── DETAILED_SRS/          # Detailed specifications
├── QA_DOCUMENTATION/      # QA documents
├── docker-compose.yml     # Docker services
├── Dockerfile             # Production build
└── nx.json                # Nx configuration
```

---

## 🔧 Available Scripts

| Command                    | Description                    |
| -------------------------- | ------------------------------ |
| `npx nx serve server`      | Start backend dev server       |
| `npx nx serve client`      | Start frontend dev server      |
| `npx nx build server`      | Build backend for production   |
| `npx nx build client`      | Build frontend for production  |
| `npx nx graph`             | Visualize project dependencies |
| `npm run db:seed`          | Seed database with sample data |
| `npm run test:integration` | Run all integration tests      |
| `npm run docker:start`     | Start Docker services          |
| `npm run docker:stop`      | Stop Docker services           |

---

## 👥 User Roles

| Role            | Permissions                                                     |
| --------------- | --------------------------------------------------------------- |
| **Guest**       | View public auctions and articles                               |
| **Bidder**      | Register for auctions, place bids, manage registrations         |
| **Auctioneer**  | Create/manage auctions, verify documents, approve registrations |
| **Admin**       | Full auction management, user management, system configuration  |
| **Super Admin** | All admin permissions + role promotion to any level             |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<p align="center">
  Built with ❤️ using <a href="https://nx.dev">Nx</a>
</p>
