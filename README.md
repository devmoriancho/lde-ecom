# CommerceHub — Full-Stack E-commerce Platform

CommerceHub is a full-stack e-commerce application built with **Next.js, TypeScript, React, and PostgreSQL**. It provides a foundation for managing an online store, allowing customers to browse products, manage shopping carts, place orders, and make payments.

The platform features role-based authentication, product and inventory management, order processing, Stripe payment integration, and automated email notifications.

Built with a focus on **type safety, secure data handling, database integrity, and reliable transaction workflows**, CommerceHub demonstrates the development of a modern full-stack web application.

## Project Overview

CommerceHub brings together the core functionality of an online shopping platform through two main user roles:

- **Customers:** Can create accounts, browse available products, manage their shopping carts, place orders, and view their order history.
- **Administrators:** Can manage products, monitor orders, and update order statuses through an administrative dashboard.

The application supports Stripe Checkout for online payments and cash on delivery. M-PESA is included as a payment option in the checkout interface, with gateway integration planned for future development. Resend handles transactional email notifications.

## Key Features

- User registration and authentication.
- Role-based access control for customers and administrators.
- Product browsing and individual product details.
- Administrative product management.
- Shopping cart with quantity management.
- Checkout and delivery information collection.
- Order creation and order history.
- Administrative order management and status updates.
- Inventory management with stock reservation and restoration.
- Stripe Checkout integration and webhook-based payment verification.
- Transactional email notifications using Resend.
- Automated payment reminders and unpaid-order expiration endpoints.
- Input validation using Zod.
- Database constraints to maintain data integrity.

## Technology Stack

| Category          | Technologies                                       |
| ----------------- | -------------------------------------------------- |
| Frontend          | React, Next.js, TypeScript                         |
| Styling           | Tailwind CSS                                       |
| Backend           | Next.js App Router, Server Actions, Route Handlers |
| Database          | Neon PostgreSQL                                    |
| ORM               | Drizzle ORM                                        |
| Authentication    | Auth.js (NextAuth.js), bcryptjs                    |
| Validation        | Zod                                                |
| Payments          | Stripe                                             |
| Email             | Resend                                             |
| Development tools | TypeScript, ESLint, Drizzle Kit, npm               |

## Database Architecture

CommerceHub uses **Neon PostgreSQL** as its relational database, with **Drizzle ORM** for schema management, queries, and migrations.

The database is organized into five main tables:

| Table         | Description                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `users`       | Stores customer and administrator account information, including roles and password hashes.       |
| `products`    | Stores product details, prices, descriptions, image references, and available stock.              |
| `cart_items`  | Stores products added to individual customers' shopping carts.                                    |
| `orders`      | Stores customer orders, payment information, delivery details, and stock reservation information. |
| `order_items` | Stores the individual products and quantities associated with each order.                         |

### Data Relationships

- A user can have multiple cart items.
- A user can place multiple orders.
- A product can appear in multiple cart items and order items.
- An order can contain multiple order items.
- Each order item belongs to one order.

### Data Integrity

The database uses:

- UUID primary keys.
- Foreign key constraints.
- Unique constraints to prevent duplicate cart entries for the same customer and product.
- Check constraints to enforce valid prices, stock quantities, and order item quantities.
- Cascading and restricted deletion rules to protect related records.

## Project Structure

```text
CommerceHub/
├── app/
│   ├── actions/             # Authentication and product actions
│   ├── admin/               # Admin dashboard and management
│   ├── api/
│   │   ├── auth/            # Authentication API routes
│   │   ├── cron/            # Payment reminders and order expiry
│   │   └── stripe/          # Stripe webhook endpoint
│   ├── cart/                # Shopping cart
│   ├── checkout/            # Checkout and payment workflows
│   ├── login/               # Customer login
│   ├── orders/              # Order history and details
│   ├── products/            # Product listing and details
│   ├── profile/             # Customer profile
│   └── register/            # Customer registration
├── drizzle/
│   ├── meta/                # Migration metadata
│   └── *.sql                # Database migrations
├── lib/
│   ├── db/                  # Database connection and schema
│   ├── validations/         # Zod validation schemas
│   ├── email.ts             # Email service
│   ├── email-templates.ts   # Transactional email templates
│   └── stripe.ts            # Stripe configuration
├── public/                  # Static assets
├── types/                   # TypeScript type definitions
├── auth.ts                  # Authentication configuration
├── drizzle.config.ts        # Drizzle Kit configuration
├── next.config.ts           # Next.js configuration
└── package.json             # Dependencies and scripts
```

The project follows the Next.js App Router architecture, organizing customer-facing pages, administrative functionality, API endpoints, database logic, and shared utilities into separate directories.

## Getting Started

Follow these instructions to set up CommerceHub on your local machine.

### Prerequisites

Before getting started, make sure you have:

- [Node.js](https://nodejs.org/) 20.9 or later.
- npm (included with Node.js).
- A Neon PostgreSQL database.
- A Stripe account for payment integration.
- A Resend account for email notifications.

### Installation

**1. Clone the repository**

```bash
git clone <your-repository-url>
```

**2. Navigate into the project directory**

```bash
cd <repository-directory>
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create a `.env.local` file in the project root and configure the required environment variables.

See the [Environment Variables](#environment-variables) section below.

**5. Start the development server**

```bash
npm run dev
```

**6. Open the application**

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

| Command         | Description                    |
| --------------- | ------------------------------ |
| `npm run dev`   | Starts the development server. |
| `npm run build` | Creates a production build.    |
| `npm run start` | Starts the production server.  |
| `npm run lint`  | Runs ESLint checks.            |

## Environment Variables

CommerceHub uses environment variables to configure database connectivity, authentication, payment processing, email delivery, and scheduled tasks.

Create a `.env.local` file in the project root and add the following variables:

```env
# Database
DATABASE_URL=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email - Resend
RESEND_API_KEY=
EMAIL_FROM=

# Scheduled Tasks
CRON_SECRET=

# Authentication
AUTH_SECRET=
```

### Variable Descriptions

| Variable                | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon PostgreSQL connection string.                                   |
| `NEXT_PUBLIC_APP_URL`   | Base URL of the application.                                         |
| `STRIPE_SECRET_KEY`     | Stripe secret API key used for server-side payment operations.       |
| `STRIPE_WEBHOOK_SECRET` | Secret used to verify Stripe webhook signatures.                     |
| `RESEND_API_KEY`        | API key used to send transactional emails.                           |
| `EMAIL_FROM`            | Sender name and email address for outgoing emails.                   |
| `CRON_SECRET`           | Protects scheduled task endpoints from unauthorized requests.        |
| `AUTH_SECRET`           | Secret used by Auth.js to secure authentication sessions and tokens. |

**Security Notes**

- Never commit `.env.local` to version control.
- Never expose secret API keys in client-side code.
- Use test credentials during development.
- Configure production credentials securely when deploying.
- Ensure your email sending domain is verified before production use.

## Database Setup

CommerceHub uses **Neon PostgreSQL** for persistent data storage and **Drizzle ORM** for database schema management and queries.

### Database Configuration

1. Create a PostgreSQL database using [Neon](https://neon.tech/).
2. Copy your database connection string.
3. Add it to the `DATABASE_URL` variable in `.env.local`.

### Database Schema

The database schema is defined in:

```text
lib/db/schema.ts
```

Drizzle Kit configuration is maintained in:

```text
drizzle.config.ts
```

### Database Migrations

Database migration files are stored in the `drizzle/` directory.

The project uses the following Drizzle Kit commands:

```bash
# Generate a migration from schema changes
npx drizzle-kit generate

# Apply pending migrations
npx drizzle-kit migrate
```

**Important:** Review generated SQL migrations and verify database migration history before applying them, particularly when working with an existing database.

## Payment Integration

CommerceHub integrates **Stripe Checkout** to process online card payments.

### Stripe Checkout Workflow

1. A customer selects Stripe as the payment method during checkout.
2. The application creates an order and reserves the required product stock.
3. A Stripe Checkout Session is created for the order.
4. The customer is redirected to Stripe's hosted checkout page.
5. Stripe processes the payment and sends a webhook event to the application.
6. The application verifies the webhook signature and validates the payment details.
7. The order payment status is updated after successful verification.
8. A payment confirmation email is sent to the customer through Resend.

### Webhook Endpoint

The application handles Stripe webhook events through:

```text
app/api/stripe/webhook/route.ts
```

The endpoint processes the `checkout.session.completed` event and verifies the payment before marking an order as paid.

### Local Webhook Testing

For local development, the Stripe CLI can forward webhook events to the application:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the webhook signing secret provided by Stripe CLI as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

Stripe test mode should be used during development. Configure production credentials and webhook endpoints before deploying.

## Scheduled Tasks

CommerceHub includes API endpoints for background order-management tasks.

### Payment Reminders

The payment reminder endpoint identifies eligible unpaid orders and sends reminder emails to customers.

```text
app/api/cron/payment-reminders/route.ts
```

### Order Expiration

The order expiration endpoint handles unpaid orders whose payment reservation period has expired. It processes expiration and restores reserved product stock where appropriate.

```text
app/api/cron/expire-orders/route.ts
```

### Securing Scheduled Endpoints

Scheduled endpoints use the `CRON_SECRET` environment variable to protect access.

A deployment scheduler must be configured to call these endpoints at the desired intervals. Creating the endpoints alone does not activate automatic scheduling.

## Screenshots

The following screenshots showcase the main interfaces and workflows in CommerceHub.

### Homepage

![CommerceHub Homepage](public/screenshots/homepage.png)

### Product Details

![Product Details](public/screenshots/product-details.png)

### Shopping Cart

![Shopping Cart](public/screenshots/shopping-cart.png)

### Checkout

![Checkout](public/screenshots/checkout.png)

### Admin Dashboard

![Admin Dashboard](public/screenshots/admin-dashboard.png)

### Order History

![Order History](public/screenshots/orders.png)

## Future Improvements

Potential areas for future development include:

- Complete M-PESA payment gateway integration.
- Product search, filtering, and sorting.
- Product reviews and customer ratings.
- Wishlist functionality.
- Improved analytics and sales reporting for administrators.
- Enhanced mobile shopping experience.
- Automated deployment and production monitoring.
- Comprehensive automated testing.

## Contributing

Contributions, suggestions, and bug reports are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test your changes.
5. Submit a pull request describing your contribution.

## License

No license has been specified for this project yet.
