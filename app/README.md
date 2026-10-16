# MUSE — Talent Marketplace

MUSE is a working marketplace for brands, influencers and models. It is a real, server-backed V1 rather than a static design.

## Included in MUSE

- Brand and Talent sign-up, sign-in and guided profile setup
- Influencer, Model and Content Creator profiles with portfolio, gallery, services, social audience, nationality, residence and availability
- Public / Private profile visibility (private accounts never appear in discovery or For You)
- Global discovery with filters for talent type, country, city, nationality, category, platform, followers, rate, language and availability
- Suggested **For You** cards with Connect, skip and an on-platform chat once the recipient accepts
- Favorites and shortlists
- Brand campaigns with public and invite-only visibility
- Talent applications, brand review of applicants and direct offers
- Offer acceptance, decline and counter offers
- Protected MUSE chat and deal messages that block phone numbers, email, external links and off-platform contact requests
- Deal rooms with agreement record, delivery submissions, revisions, support cases, cancellation and allowed file attachments
- Payment tracking and downloadable payment record (no card collection or fund handling yet)
- 1–5 star reviews for both parties after a completed or cancelled Deal
- Admin review, account verification and suspension
- Responsive premium fashion-tech interface

## MUSE marketplace expansion

- Campaign Marketplace with **Campaign**, **Open/Private Casting** and **MUSE Jobs** opportunity types
- Transparent **MUSE Match** for brands: category, location, travel, availability, price, verification and review fit — it is not hidden AI matching
- Campaign **Talent Teams** with individual invitations and accept/decline controls
- Creator **Media Kit** and **MUSE Passport** share pages with portfolio, audience, rates, services, ratings, verification and reliability record
- Creator availability calendar, Travel Mode and countries-worked passport details
- Brand and creator analytics: profile views, discovery appearances, saves, connections, campaign views, applications and team size
- Public Opportunity Map by country and city
- Explicit usage rights, duration, territory and exclusivity on campaigns, offers and Deal Rooms
- Rate Calculator for creators
- Verification requests for Identity, Audience, Agency and Company, with an admin review queue
- Agency accounts with invitation-only talent rosters
- Company Team workspaces with individual user invitations and permissions labels
- Private saved-talent collections for brand workspaces

Payments and escrow are still intentionally not enabled. MUSE only records external payment tracking until the business has the required legal and payment-provider setup.

Real card processing, escrow and automated payouts still require a payment provider such as Stripe before they can be enabled safely.

## Run locally on Mac

Double-click <code>start.command</code>.

Or run:

~~~bash
cd muse-real
python3 server.py
~~~

Then open <code>http://localhost:8000</code>.

Create an account in the app. MUSE never creates public sample profiles or demo accounts.

## Run locally on Windows

Double-click <code>start.bat</code>, or run:

~~~bat
python server.py
~~~

Python 3 is the only requirement. No package installation or external database is required for local use.

## Production launch

The launch archive intentionally contains no database or test accounts. On its first production start, MUSE creates an empty database and the first admin account from these environment variables:

~~~bash
MUSE_DB=/path/to/persistent/muse.db \
MUSE_BOOTSTRAP_ADMIN_EMAIL=admin@yourdomain.com \
MUSE_BOOTSTRAP_ADMIN_PASSWORD=use-a-long-unique-password \
MUSE_SECURE_COOKIES=1 \
python3 server.py
~~~

- **Do not run production accounts on Render Free with SQLite.** Free web services use an ephemeral filesystem, so the database and uploads can disappear when the service sleeps, restarts or redeploys.
- Use a persistent disk for SQLite. On Render this requires a paid web service. For higher traffic, move to PostgreSQL.
- Set <code>MUSE_SECURE_COOKIES=1</code> only when the public site is served over HTTPS.
- Keep the bootstrap password private and use at least eight characters for every account.
- Uploaded files are limited to 6 MB and to supported images, PDFs, Office documents and ZIP files.

### Deploy-ready files

The project includes a <code>Dockerfile</code> and <code>render.yaml</code> for a public deployment. The Render configuration starts one Docker web service, keeps both the SQLite database and uploads on a persistent disk at <code>/var/data</code>, and asks for the first admin email and password privately during setup.

1. Put this folder in a Git repository.
2. Create a new Render Blueprint from that repository.
3. Keep the persistent disk enabled and provide a unique admin email and password when prompted.
4. Once it is live, add the chosen custom domain in the service settings.

The app uses the host's <code>PORT</code> automatically. Do not enable demo mode on the public service. For higher traffic, move from SQLite to PostgreSQL before adding multiple server instances.

### Password recovery email

The Forgot password flow is secure and ready to send one-time links, but it needs an email sender configured in the host's environment variables:

~~~bash
RESEND_API_KEY=re_...
MUSE_EMAIL_FROM="MUSE <hello@yourdomain.com>"
MUSE_PUBLIC_URL=https://your-muse-domain.com
~~~

Use a verified sender/domain in Resend. Reset links expire after one hour, can only be used once, and signing in elsewhere is invalidated after the password changes.
