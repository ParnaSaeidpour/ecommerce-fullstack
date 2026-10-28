# Next.js E-commerce Store

A full-stack online store built with **Next.js 13 (App Router)**, **TypeScript**, **Prisma + PostgreSQL**, **NextAuth (Google login)** and **Stripe payments**.

Products and prices are managed in Stripe. Logged-in users add products to a cart, pay with Stripe Elements, and see their completed orders on a dashboard.

> Originally built in April 2023. Security fixes, tests and CI were added in October 2026 (see [Changelog](#changelog)).

## Features

- Product catalogue loaded from Stripe (server components)
- Persistent shopping cart with Zustand (`localStorage`)
- Google sign-in with NextAuth and the Prisma adapter; a Stripe customer is created for each new user
- Checkout with Stripe Payment Intents and Stripe Elements
- Stripe webhook (signature verified) marks orders as complete
- Order history dashboard for the logged-in user
- Light/dark theme with Tailwind CSS and daisyUI, animations with Framer Motion

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 13, React 18, TypeScript, Tailwind CSS, daisyUI, Framer Motion |
| State | Zustand |
| Auth | NextAuth.js (Google OAuth), Prisma adapter |
| Database | PostgreSQL, Prisma ORM |
| Payments | Stripe (Payment Intents, Elements, Webhooks) |
| Testing / CI | Vitest, GitHub Actions |

## Architecture

```
Browser ──► Next.js App Router pages (server components)
   │            └─ app/page.tsx ──► Stripe API (products + prices)
   │
   ├─► POST /api/create-payment-intent
   │       1. checks the NextAuth session
   │       2. validates cart (product ids + quantities only)
   │       3. looks up the real prices in Stripe       (util/pricing.ts)
   │       4. creates/updates the Stripe PaymentIntent and the Order in PostgreSQL
   │
   ├─► /api/auth/[...nextauth]  ──► Google OAuth, users stored via Prisma
   │
Stripe ──► POST /api/webhooks (signature verified) ──► Order.status = "complete"
```

Data model (`prisma/schema.prisma`): `User`, `Account`, `Session` (NextAuth), `Order`, `Product`.

### Checkout security

The checkout API never trusts prices sent by the browser. The client only sends product ids and quantities; the server validates them (`parseCartItems`), fetches each product's price from Stripe (`priceCartItems`) and calculates the total (`calculateOrderAmount`). An existing order is only updated when it is a **pending order of the logged-in user**.

## Getting started

### Prerequisites

- Node.js 18+
- PostgreSQL
- A Stripe account (test mode) with at least one product that has a price
- A Google OAuth client ([Google Cloud Console](https://console.cloud.google.com/apis/credentials)), redirect URI `http://localhost:3000/api/auth/callback/google`
- [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhooks

### Setup

```bash
git clone https://github.com/ParnaSaeidpour/ecommerce-fullstack.git
cd ecommerce-fullstack/next-ecommerce
npm install
cp .env.example .env        # then fill in your own values
npx prisma migrate dev      # creates the database tables
npm run dev                 # http://localhost:3000
```

In a second terminal, forward Stripe webhooks to the app and copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --forward-to localhost:3000/api/webhooks
```

Use Stripe's test card `4242 4242 4242 4242` with any future date and CVC.

### Environment variables

See [`next-ecommerce/.env.example`](next-ecommerce/.env.example). Never commit your real `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for Prisma |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth base URL and session encryption secret |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client |
| `STRIPE_SECRET_KEY` | Stripe secret key (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (browser) |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures |

## Tests

```bash
cd next-ecommerce
npm test
```

- `__tests__/pricing.test.ts`: cart validation and price calculation
- `__tests__/create-payment-intent.test.ts`: the checkout API with Stripe, Prisma and NextAuth replaced by in-memory fakes (no keys or network needed). Covers tampered prices, unknown products, invalid quantities, unauthenticated users and orders that belong to another user.

GitHub Actions runs the tests and a production build on every push and pull request.

## Project structure

```
next-ecommerce/
├── app/                      # App Router pages and components
│   ├── page.tsx              # product list (from Stripe)
│   ├── product/[id]/         # product details + add to cart
│   ├── dashboard/            # the user's completed orders
│   └── component/            # Cart, Checkout, Nav, ...
├── pages/api/
│   ├── auth/[...nextauth].ts # Google login, creates Stripe customer
│   ├── create-payment-intent.ts
│   └── webhooks.ts           # Stripe webhook handler
├── prisma/                   # schema and migrations
├── util/pricing.ts           # server-side cart validation and pricing
├── store.ts                  # Zustand cart and theme stores
└── __tests__/                # Vitest tests
```

## Changelog

**October 2026**
- Fixed: the checkout total was calculated from prices sent by the browser, so a modified request could change the amount charged. Prices are now looked up in Stripe on the server.
- Fixed: a payment intent id from another user's order could be used to overwrite that order. Only the user's own pending orders are updated now.
- Fixed: the API kept running after sending an error response; added input validation and `405` for non-POST requests.
- Fixed: production build failed on a fresh clone (`session.user.id` type); added NextAuth type declaration.
- Checkout page shows an error message instead of crashing when the API returns an error.
- Added Vitest tests, GitHub Actions CI and `.env.example`.

**April 2023**
- Original version.
