# GearUp Backend 🏋️

Rent Sports & Outdoor Gear Instantly — a backend API for a sports and outdoor equipment rental service. Customers browse gear and place rental orders, providers manage inventory and fulfill orders, and admins moderate the platform.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js + Express | REST API |
| TypeScript | Type safety |
| PostgreSQL + Prisma | Database + ORM |
| JWT | Authentication |
| Stripe | Payment processing |
| express-validator | Server-side input validation |

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in real values
npx prisma migrate dev # creates tables from prisma/schema.prisma
npm run db:seed        # seeds admin/provider/customer + sample data
npm run dev             # starts the API on http://localhost:5000
```

Required environment variables are documented in [.env.example](./.env.example): `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, and `ADMIN_EMAIL`/`ADMIN_PASSWORD` (used by the seed script to create the admin account).

## Admin Credentials

Seeded by `npm run db:seed` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`:

```
Admin Email    : admin@gearup.com
Admin Password : admin123456
```

The seed script also creates a sample provider (`provider@gearup.com` / `provider123`) and customer (`customer@gearup.com` / `customer123`), plus sample gear and a full-lifecycle rental (placed → paid → picked up → returned, with a completed payment and a review) so every role's flow can be demoed immediately.

## API Documentation

Published docs: https://gearup-api.docs.buildwithfern.com

A Postman collection covering every endpoint lives in [postman/](./postman/):
- `GearUp.postman_collection.json` — import into Postman
- `GearUp.postman_environment.json` — local environment (`baseUrl=http://localhost:5000`)
- `GearUp.postman_environment.production.json` — production environment (`baseUrl=https://gearup-backend-flax.vercel.app`)

Logging in via the collection's Auth folder automatically populates `{{adminToken}}`, `{{providerToken}}`, and `{{customerToken}}` collection variables for use in subsequent requests.

## Error Response Format

All errors return a consistent structure:

```json
{
  "success": false,
  "message": "Human-readable summary",
  "errorDetails": "More detail, or an array of validation messages"
}
```

## Payments

Payment integration is via **Stripe** (`/api/payments/create`, `/api/payments/confirm`, `/api/payments`, `/api/payments/:id`, and a webhook at `/api/payments/webhook`). A real `STRIPE_SECRET_KEY` (free test key from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys)) is required in `.env` for payment creation to succeed end-to-end.

## Deployment

| Item | Link |
|------|------|
| Backend Repo | https://github.com/GeorgeBlaize/gearup-backend |
| Live API | https://gearup-backend-flax.vercel.app |
| API Docs | https://gearup-api.docs.buildwithfern.com |
| Demo Video | _fill in after recording_ |
