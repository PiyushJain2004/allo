# Allo Inventory Reservations

This project implements inventory reservations for multi-warehouse fulfillment. Customers can reserve stock for a fixed window, confirm payment, or release the hold.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Add a Postgres connection string in `.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/allo?schema=public"
```

3. Run Prisma migration and seed data:

```bash
npx prisma migrate dev --name init
npm run db:seed
```

4. Start the dev server:

```bash
npm run dev
```

## Tech stack

- Next.js App Router (TypeScript)
- React
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Core API endpoints

- `GET /api/products` - list products with available stock per warehouse.
- `GET /api/warehouses` - list warehouses.
- `POST /api/reservations` - create a reservation (returns `409` when stock is insufficient).
- `POST /api/reservations/:id/confirm` - confirm reservation (returns `410` when expired).
- `POST /api/reservations/:id/release` - release reservation early.

## Concurrency strategy

Reservations are created inside a transaction with a single SQL update that increments `reservedUnits` only if the result would not exceed `totalUnits`. This ensures that two simultaneous requests for the last unit cannot both succeed.

## Expiry handling

Expired reservations are released lazily on read. When `/api/products` or `/api/reservations/:id` is called, the app releases any pending reservations whose `expiresAt` has passed and returns the updated availability. This keeps the demo self-contained without requiring background workers.

## Trade-offs / next steps

- The lazy cleanup approach keeps the demo simple, but production should use a background job (cron or worker) for timely releases.
- The UI flow is intentionally light on validation and would need authentication, rate limiting, and audit logging in a real system.
- Idempotency keys are not implemented yet.
