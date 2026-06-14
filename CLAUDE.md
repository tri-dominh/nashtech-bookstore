# nashtech-bookstore — Backend API

## Project Overview

NashTech Bookstore is a full-featured e-commerce bookstore backend built with **NestJS** and **TypeScript**. It serves as the API layer for both a customer-facing frontend and an admin management interface. The server exposes both a **REST API** and a **GraphQL API**.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 |
| Language | TypeScript 5 |
| Database | PostgreSQL 13 (via Prisma ORM 5) |
| Cache / Cart | Redis 7 (via ioredis) |
| File Storage | Firebase Storage |
| Authentication | JWT (access + refresh tokens), Passport.js |
| Password Hashing | Argon2 |
| GraphQL | Apollo Server 4 (`@nestjs/graphql`, `@nestjs/apollo`) |
| Template Engine | Pug (server-side views for admin) |
| Session | express-session + connect-flash |
| Slug generation | slugify |

## Infrastructure

- **Docker Compose** spins up PostgreSQL (`localhost:5432`) and Redis (`localhost:6379`) locally.
- **Firebase** is used exclusively for image uploads (book covers, user avatars).
- App server default port is configured via `PORT` env variable.

## How to Run

```bash
# 1. Start databases
docker compose up -d

# 2. Apply migrations and generate Prisma client
yarn bootstrap   # runs: prisma migrate deploy && prisma generate

# 3. Start development server
yarn start:dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_AT_SECRET` / `JWT_AT_EXPIRES` | Access token secret + expiry |
| `JWT_RT_SECRET` / `JWT_RT_EXPIRES` | Refresh token secret + expiry |
| `FIREBASE_*` | Firebase service account credentials for file uploads |
| `PORT` | HTTP server port |
| `NODE_OPTIONS` | Node.js runtime flags |

## Module Architecture

```
src/
├── app.module.ts          # Root module — wires all modules together
├── main.ts                # Bootstrap entry point
├── auth/                  # Authentication & user profile
├── user/                  # User management (admin)
├── book/                  # Books CRUD + ratings/reviews
├── author/                # Author management
├── category/              # Category management
├── cart/                  # Redis-backed shopping cart
├── order/                 # Order lifecycle management
├── promotion-list/        # Discount/promotion groups
├── rating-review/         # Standalone ratings/reviews module
├── about/                 # About page content (editable)
├── prisma/                # PrismaService (database client)
├── services/
│   ├── firebase/          # Firebase Admin SDK init
│   ├── files/             # upload.ts + delete.ts helpers
│   └── redis/             # RedisModule (ioredis integration)
├── constants/             # Enums, pagination config, sort mappings
└── utils/                 # Calculation, currency, date, order helpers
```

Each feature module typically has:
- `*.module.ts` — DI wiring
- `*.controller.ts` — REST endpoints
- `*-view.controller.ts` — Pug-rendered admin views
- `*.service.ts` — Business logic
- `*.service.spec.ts` — Unit tests
- `dto/` — DTOs with class-validator decorators

## Data Models (Prisma Schema)

### User
```
id, email (unique), password (argon2), name, image, address, phone,
role (admin|user), refreshToken, createdAt, updatedAt
→ has many: Order, RatingReview
```

### Book
```
id (autoincrement), slug (unique), name, description, image,
price, finalPrice, discountPercentage, discountDate,
avgStars, totalReviews, soldQuantity, createdAt, updatedAt
→ belongs to: PromotionList (optional)
→ many-to-many: Author (via BookAuthor), Category (via BookCategory)
→ has many: RatingReview, OrderItem
```

### Author
```
id, slug (unique), name, image, createdAt, updatedAt
→ many-to-many: Book (via BookAuthor)
```

### Category
```
id, slug (unique), name, createdAt, updatedAt
→ many-to-many: Book (via BookCategory)
```

### PromotionList
```
id, slug (unique), name, discountPercentage, createdAt, updatedAt
→ has many: Book
```

### Order
```
id (UUID), userId, status (pending|confirmed|delivering|completed|cancelled),
totalPrice, fullName, shippingAddress, phone,
paymentMethod (cod|momo|zalo_pay|vn_pay), createdAt, updatedAt
→ belongs to: User
→ has many: OrderItem
```

### OrderItem
```
orderId, bookId (composite PK), quantity, price, finalPrice, totalPrice,
createdAt, updatedAt
```

### RatingReview
```
id, bookId, userId, star (1-5), title, content, createdAt, updatedAt
```

### About
```
id, content (rich text for the About Us page)
```

## Key Features & Business Logic

### Authentication
- **Dual-token JWT**: access token (short-lived) + refresh token (long-lived, hashed with argon2 and stored on the user record).
- **Strategies**: `local` (email/password login), `jwt` (access token), `jwt-refresh` (refresh token rotation).
- **Guards**: `JwtGuard`, `JwtRefreshGuard`, `RolesGuard`, `AuthenticatedGuard`, `UnauthenticatedGuard`, `JwtGqlGuard`, `RolesGqlGuard`.
- Profile image upload to Firebase on sign-up/edit.

### Shopping Cart (Redis)
- Cart stored as a **Redis hash** keyed `cart:{userId}`, mapping `bookId → quantity`.
- Operations: add, update quantity, remove item, clear cart, get cart detail (enriched from DB).
- **Checkout** creates an Order from cart contents then clears Redis — atomic via Prisma transaction.

### Book Catalog
- Slugs auto-generated as `{slugified-name}_{id}` on create and updated on rename.
- **Special book types**: `on_sale` (has promotion), `recommended` (avgStars ≥ 4), `popular` (soldQuantity > 0).
- Full-text search across name, description, author name, and category name (case-insensitive).
- Filtering by category slugs, author slugs, minimum star rating; sorting by price/popularity/discount.
- Pagination with configurable page size (default 8, max 20).

### Promotions
- A `PromotionList` groups books under a discount percentage.
- Adding a book to a promotion list automatically recalculates `finalPrice` and sets `discountDate`.

### Rating & Reviews
- Adding a review atomically updates `avgStars` and `totalReviews` on the book in a single transaction.
- Reviews can be filtered by star count and paginated with star count aggregates returned.

### Orders
- Status lifecycle: `pending → confirmed → delivering → completed / cancelled`.
- Only `pending` orders can be cancelled by the customer.
- On `completed`, `soldQuantity` increments for each ordered book (tracked for popularity ranking).
- Admin can update any order status and delete orders.

### GraphQL
- Schema auto-generated at `schema.gql`.
- Playground disabled in production (`playground: false`).
- Book queries/mutations exposed via `book.resolver.ts` with `BookModel`, `AuthorModel`, `CategoryModel` types in `src/book/models/`.

## Testing

```bash
yarn test          # unit tests (Jest)
yarn test:cov      # with coverage
yarn test:e2e      # end-to-end tests
```

Unit test files co-located as `*.service.spec.ts`. Modules with specs: auth, author, book, category, order, promotion-list, rating-review, user.

## API Documentation

A Postman collection and environment are available at `postman/`:
- `Bookstore.postman_collection.json`
- `Bookstore.postman_environment.json`
