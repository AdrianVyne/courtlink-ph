# Organization Staff Management Verification - 2026-06-22

## Scope

Organization staff invitations, membership suspension/reinstatement/removal, and a
tenant-visible audit log of those actions.

## Automated gates

- `pnpm check`: 18 of 18 tasks successful (API 152 unit tests including 11 new
  organization-staff service tests; all typechecks, lint, and builds passed).
- `pnpm test:integration`: 8 of 8 task groups successful; API 37 integration scenarios
  including 4 new organization-staff scenarios (invite/accept/audit, suspend then
  tenant-authorization denial then reinstate, last-owner protection, remove with audit).
  The suite runs with turbo `--concurrency=1` so DB-backed suites do not race.

## Live HTTP checks against the running API and PostgreSQL

- Owner `POST /businesses/:id/staff/invitations` (MANAGER) returned 201 and the invitation
  appeared in `GET .../staff/invitations` as PENDING.
- Inviting an existing active member returned 409 `ALREADY_MEMBER`.
- `POST /businesses/staff/invitations/accept` with an invalid token returned 400.
- Active manager `GET .../staff/members` returned 200.
- Owner `POST .../staff/members/:userId/suspend` returned 200; the suspended manager then
  received 403 from `GET .../staff/members`, proving suspended members lose tenant access.
- Owner reinstate returned 200 and the manager regained 200 access.
- Owner remove returned 200.
- Owner `GET /businesses/:id/audit` listed `ORG_MEMBER_SUSPENDED`, `ORG_MEMBER_REINSTATED`,
  and `ORG_MEMBER_REMOVED`.

## Authorization model

Only OWNER or MANAGER may manage staff; only an OWNER may invite or manage a MANAGER. The
last active owner cannot be suspended or removed. Suspended memberships fail tenant
authorization because `TenancyService.assertRole` requires an ACTIVE membership, which is
the same check used by the HTTP route guard.

## Privacy

Invitation tokens are random, hashed with SHA-256 at rest, and delivered only by the
replaceable email adapter, which logs delivery metadata without the acceptance link.
