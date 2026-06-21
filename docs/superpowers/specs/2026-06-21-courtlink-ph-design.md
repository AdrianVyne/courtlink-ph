# CourtLink PH Design

## Purpose

CourtLink PH is a nationwide public marketplace dedicated to pickleball courts and coaches in the Philippines. It supports players, independent coaches, multi-venue businesses, venue staff, and platform super administrators through one role-based account system.

The launch target has no fixed hosting or software subscription cost. Production runs in Docker on Oracle Cloud Always Free. Free infrastructure has no SLA, so backups, monitoring, and migration runbooks are mandatory.

## Architecture

The system is a TypeScript monorepo containing a Next.js web client, a NestJS REST API, and a NestJS BullMQ worker. PostgreSQL is the source of truth; Redis supports queues and rate limiting; Caddy provides HTTPS and same-origin routing. Payment proofs and encrypted database backups use private OCI Object Storage.

The API is versioned under `/api/v1` and publishes OpenAPI contracts suitable for the web client and future native clients. Scheduling rules are enforced transactionally in PostgreSQL. All persisted timestamps use UTC and product presentation uses `Asia/Manila`.

## Identity and tenancy

A person has one account and may hold player, coach, and organization roles simultaneously. Organization roles are owner, manager, and staff. Super admin is platform-scoped. Businesses own multiple venues and invite members. Every privileged operation performs server-side tenant authorization and writes an audit event.

Authentication supports verified email/password and Google OAuth. Sessions use secure, same-site, HTTP-only cookies. Passwords use Argon2id. Venue publication requires super-admin approval. Coaches may publish without approval but are visibly unverified until reviewed.

## Court marketplace

Venues manage courts, amenities, operating hours, closures, configurable booking increments, minimum and maximum duration, and time-based prices. Players search nationwide by structured Philippine location, time, availability, price, and amenities.

Creating a booking atomically places a five-minute hold. Checkout shows the venue's direct GCash, Maya, QR Ph, or bank instructions. The player supplies a transaction reference and private proof image before expiry. A successful submission reserves the slot until staff approves or rejects it. Reviews overdue by two hours create reminders and super-admin escalation; a submitted proof is never automatically released.

Player cancellation is refund-eligible only when requested at least seven days before play and still requires venue approval. Venue-caused cancellation is always refund-eligible. Refunds are manual and record amount, channel, reference, actor, and completion time.

## Coach marketplace

Coaches publish profiles, rates, experience, availability, and service locations. A direct request targets a coach and requires coach approval before payment. An open request contains date/time, location, group size, skill level, goals, and notes. Coaches submit priced offers with a selected expiration deadline before the session. The player accepts one active offer, atomically closing competitors, then pays the coach directly and submits proof for coach review.

Coach and court reservations are independent. Coaching requires a location but may use a CourtLink venue, external venue, or private court.

## Experience and trust

The responsive web application includes public discovery and separate player, coach, venue, and super-admin workspaces. The visual direction is minimal club booking: light-first neutral surfaces, restrained pickleball-green accents, clear schedules, and subtle motion. The interface targets WCAG 2.2 AA and supports installation as a PWA.

Only participants in completed bookings may review the relevant venue or coach. The platform supports favorites, venue promotions, moderation cases, suspensions, reporting, in-app notifications, and transactional email. No SMS or native application is part of the initial implementation.

## Payments, privacy, and operations

Initial payments are direct and manually verified. The product must never describe screenshot verification as fraud-proof. Duplicate references and suspicious metadata can be flagged but do not replace human review. Court and coach financial records remain separate. The data model remains commission-ready without implementing platform collection or payouts.

Proof files remain private and use short-lived authorized URLs. Uploads are size/type checked and safely re-encoded. No automatic deletion policy is enabled initially. Capacity alerts, encrypted daily backups, monthly restore drills, structured redacted logs, correlation IDs, health checks, retry/dead-letter queues, and admin operational status are required.

