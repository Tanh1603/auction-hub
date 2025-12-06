# Docker Setup for Auction Hub

Simple Docker configuration for the course project.

## Quick Start

1. Make sure your `server/.env` file has the correct database URL:

   ```
   DATABASE_URL=""
   ```

2. Start the services:

   ```bash
   docker-compose up -d --build
   ```

3. Run database migrations:

   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

4. Access your application:
   - Backend API: http://localhost:3000/api
   - Health check: http://localhost:3000/api/health
   - Database: localhost:5432

## Useful Commands

```bash
# Start services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Seed database (if you have seed data)
docker-compose exec backend npx prisma db seed
```

## What's Included

- **PostgreSQL Database** (port 5432)
- **Backend API** (port 3000)

The setup is minimal and perfect for a course project!
