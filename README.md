# Auction Hub

> **Documentation:** [System Architecture](./docs/ARCHITECTURE.md) | [API Documentation](./docs/API_DOCUMENTATION/README.md) | [Documentation Index](./docs/DOCUMENTATION_INDEX.md)

---

## Project Overview

The Auction Hub backend is a comprehensive, highly available online platform engineered to implement and enforce Vietnamese legal regulations for asset auctions. The system prioritizes security, compliance, and real-time data consistency to handle secure bidding and the complete asset auction lifecycle.

## Core Technologies

The system is built on a modern, scalable infrastructure stack:

- **Framework:** NestJS
- **Relational Database:** PostgreSQL
- **NoSQL Database:** MongoDB
- **Real-Time Communication:** WebSockets
- **Caching & Message Broker:** Redis

## System Architecture

The following diagram illustrates the high-level request lifecycle and internal service communication.

```mermaid
graph TD
    Client[Client] -->|HTTP / WebSockets| APIGateway[API Gateway / Controllers]
    APIGateway --> AuctionService[Auction Service]
    APIGateway --> BiddingService[Bidding Service]

    AuctionService --> Database[(Database)]
    BiddingService --> Database

    AuctionService --> Redis[(Redis)]
    BiddingService --> Redis

    Redis -.->|Caching / Real-time Processing| BiddingService
```

## Environment Variables

Create a `.env` file in the root directory using the following template to properly configure the backend services.

```env
# Application Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
POSTGRES_URL=postgresql://username:password@localhost:5432/auction_hub
MONGODB_URI=mongodb://localhost:27017/auction_hub

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Security Configuration
JWT_SECRET=your_secure_jwt_secret_key
JWT_EXP_H=1
```

## Setup Instructions

Follow these steps to initialize the local development environment:

### 1. Install Dependencies

Use your preferred package manager to install the project dependencies:

```sh
npm install
```

### 2. Start Infrastructure Services

Redis is already configured for caching and real-time processing via Docker. You only need to spin up the container infrastructure:

```sh
docker-compose up -d
```

### 3. Start the Application

Run the development server for the Auction Hub:

```sh
npx nx serve auction-hub
```

## Team & Contact Information

| Full Name          | Role                            | Student ID | Email                  |
| ------------------ | ------------------------------- | ---------- | ---------------------- |
| Nguyễn Thiên An    | Team Leader / Backend Developer | 23520020   | 23520020@gm.uit.edu.vn |
| Nguyễn Lê Tuấn Anh | Fullstack Developer             | 23520064   | 23520064@gm.uit.edu.vn |
| Huỳnh Chí Hên      | Backend Developer               | 23520455   | 23520455@gm.uit.edu.vn |
| Nguyễn Cao Vũ Phan | Frontend Developer              | 23521137   | 23521137@gm.uit.edu.vn |
| Tạ Ngọc Ân         | Frontend Developer              | 23520030   | 23520030@gm.uit.edu.vn |
