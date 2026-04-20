# IsThisFishy - Full Stack Application

AI-powered scam detection with FastAPI backend, Next.js frontend, Chrome extension, and Stripe billing.

## 🏗️ Architecture

- **Backend**: FastAPI + SQLite with SQLAlchemy ORM
- **Frontend**: Next.js 14 + React + Tailwind CSS
- **Auth**: Clerk authentication
- **Payments**: Stripe subscriptions
- **Extension**: Chrome/Edge browser extension
- **AI**: OpenAI integration for scam analysis

## 📁 Repository Structure

```
isthisfishy/
├── app/                    # Next.js frontend
├── extension/              # Chrome extension
├── scripts/                # Backend utilities
├── reqs.txt               # Python dependencies
└── README.md              # This file
```

---

# 🌐 Frontend (Next.js)

Modern Next.js website for IsThisFishy with Clerk authentication, Stripe billing, and user dashboard.

## Features

- **Landing Page**: Hero section with features and CTA
- **Pricing Page**: All 5 subscription plans with Stripe Checkout
- **User Dashboard**: View current plan, usage, and billing info
- **Authentication**: Clerk sign-in/sign-up with managed profiles
- **Billing Integration**: Stripe checkout, subscriptions, and webhooks
- **Responsive Design**: Mobile-first, Tailwind CSS

## Prerequisites

- Node.js 18+
- npm or yarn
- Clerk account (https://clerk.com)
- Stripe account (https://stripe.com)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env.local`**:
   ```bash
   cp .env.local.example .env.local
   ```

3. **Add environment variables**:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - from Clerk dashboard
   - `CLERK_SECRET_KEY` - from Clerk dashboard
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - from Stripe dashboard
   - `STRIPE_SECRET_KEY` - from Stripe dashboard
   - `NEXT_PUBLIC_API_URL` - your FastAPI backend URL (e.g., http://localhost:8000)
   - `NEXT_PUBLIC_DOMAIN` - your production domain (e.g., https://isthisfishy.com)

4. **Run development server**:
   ```bash
   npm run dev
   ```

   Visit http://localhost:3000

## Deployment to Vercel

### Step 1: Create Vercel Account
- Go to https://vercel.com
- Sign up / sign in with GitHub

### Step 2: Connect GitHub Repository
- Click "Import Project"
- Paste this repo URL
- Connect your GitHub account

### Step 3: Add Environment Variables
In Vercel dashboard:
- Go to Settings → Environment Variables
- Add all variables from `.env.local.example`

### Step 4: Deploy
- Click "Deploy"
- Wait for build to complete

### Step 5: Point Domain to Vercel
In GoDaddy dashboard:
1. Go to DNS settings
2. Find the DNS records
3. Change the A record to point to Vercel's IP address (Vercel will provide this)
4. Or use Vercel's nameservers for full DNS management

**Quick Steps for GoDaddy:**
- Go to **Manage DNS** on GoDaddy
- Find **CNAME** or **A** records
- Update to point to Vercel (instructions at https://vercel.com/docs/concepts/projects/domains)

## Stripe Setup

### Create Products
1. Go to Stripe Dashboard → Products
2. Create 5 products:
   - Free (no payment)
   - Plus ($4.99/mo)
   - Pro ($9.99/mo)
   - Family ($7.99/mo)
   - Business ($12.99/mo)

3. For each paid product, create a Price
4. Copy the **Price IDs** and add to `.env.local`:
   ```
   NEXT_PUBLIC_STRIPE_PRICE_PLUS=price_xxx
   NEXT_PUBLIC_STRIPE_PRICE_PRO=price_xxx
   NEXT_PUBLIC_STRIPE_PRICE_FAMILY=price_xxx
   NEXT_PUBLIC_STRIPE_PRICE_BUSINESS=price_xxx
   ```

### Webhooks
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain/api/webhooks/stripe`
3. Select events:
   - `charge.succeeded`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy Signing Secret to backend `.env` as `STRIPE_WEBHOOK_SECRET`

## API Integration

This site connects to your FastAPI backend:
- **GET `/api/v1/billing/info`** - User's current plan
- **GET `/api/v1/billing/usage`** - Current month usage
- **POST `/api/v1/billing/upgrade`** - Start subscription
- **POST `/api/v1/billing/donate`** - One-time donation
- **GET `/api/v1/billing/plans`** - Available plans

Make sure your backend is running and accessible at `NEXT_PUBLIC_API_URL`.

## Project Structure

```
website/
├── app/
│   ├── api/
│   │   └── checkout.ts          # Stripe checkout endpoint
│   ├── dashboard/
│   │   └── page.tsx             # User dashboard
│   ├── pricing/
│   │   └── page.tsx             # Pricing page
│   ├── sign-in/
│   │   └── [[...sign-in]]/page.tsx
│   ├── sign-up/
│   │   └── [[...sign-up]]/page.tsx
│   ├── user-profile/
│   │   └── [[...user-profile]]/page.tsx
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
├── components/
│   ├── Header.tsx               # Navigation
│   └── Footer.tsx               # Footer
├── lib/
│   └── (utilities)
├── public/
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Development

- **Prettier**: `npm run format`
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Start Production**: `npm start`

## Support

For issues or questions, contact support@isthisfishy.com

---

# 🚀 Backend (FastAPI)

## API Endpoints (v1)

- `POST /api/v1/analyze` - Analyze text for scams
- `POST /api/v1/redeem` - Redeem license keys
- `POST /api/v1/share` - Create shareable links
- `GET /api/v1/s/{token}` - Access shared analysis
- `POST /api/v1/family/create` - Create family group
- `POST /api/v1/family/invite` - Invite family members
- `POST /api/v1/family/accept` - Accept family invites
- `GET /api/v1/family/events` - Get family activity

## Local Development

```bash
# Setup virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r reqs.txt

# Initialize database
python scripts/init_db.py

# Run server
uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/` for the web UI.

## Generate License Keys

```bash
# Generate 10 family keys (30 days)
python scripts/generate_license_keys.py --count 10 --plan family --days 30
```

## API Error Format

```json
{
  "request_id": "...",
  "error": {
    "code": "BAD_REQUEST|UNAUTHORIZED|PAYWALL|RATE_LIMIT|NOT_FOUND|INTERNAL",
    "message": "..."
  }
}
```

## Testing

```bash
# Generate test keys
python scripts/generate_license_keys.py --count 1 --plan family --days 30

# Run smoke tests
python scripts/smoke_test_license.ps1

# Test shared links
python scripts/verify_mode_storage.py
```

---

# 🔧 Chrome Extension

## Features

- Gmail overlay for scam detection
- Register/subscribe workflows
- Family mode support
- Spam analysis and scoring

## Development

See `extension/README.md` for setup instructions.

---

# 🚢 Deployment

## Backend
- Use Docker or deploy to cloud (AWS/Azure)
- Set `ENV=prod` in production
- Configure Stripe webhooks

## Frontend
- Deploy to Vercel from GitHub
- Set environment variables in Vercel dashboard
- Domain: `isthisfishy.com`

## Extension
- Publish to Chrome Web Store
- Update manifest.json with production URLs

---

# 📋 Development Workflow

1. **Backend**: Work in main branch
2. **Frontend**: Work in feature branches, merge to main
3. **Extension**: Update in extension/ folder
4. **Deploy**: Push to main → Vercel auto-deploys frontend

---

# 🤝 Contributing

1. Create feature branch from `main`
2. Make changes
3. Test locally
4. Push branch and create PR
5. Merge to `main` after review
