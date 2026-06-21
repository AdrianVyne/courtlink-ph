# ADR 0001: Separate web, API, and worker services

## Status

Accepted

## Context

CourtLink PH needs a responsive web client, stable API contracts for future native clients, and reliable asynchronous expiry/notification jobs. The owner selected separate services despite the additional resource cost on one Oracle Always Free VM.

## Decision

Use one TypeScript monorepo containing independently deployable Next.js web, NestJS API, and Node worker applications. PostgreSQL is the system of record and Redis/BullMQ coordinates background work. Caddy will expose the web app and route `/api` to the API on one origin.

## Consequences

Service contracts and deployment boundaries are explicit, and workers cannot block API requests. The Oracle VM must run more processes than a modular monolith, so production Compose needs memory limits, health checks, and capacity alerts.

