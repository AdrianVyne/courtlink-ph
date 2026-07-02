## Summary

Describe what changed and why.

## Verification

- [ ] `pnpm check`
- [ ] `pnpm test:integration` when API, database, worker, or booking behavior changed
- [ ] `pnpm --filter @courtlink/web test:e2e` when user-facing web behavior changed
- [ ] Docker image or Compose validation when deployment files changed

## Security and Privacy

- [ ] No secrets, tokens, real payment instructions, proof URLs, personal data, production identifiers, uploads, backups, or `.env` files are included
- [ ] API/service changes enforce tenant authorization server-side
- [ ] Public issue/PR text does not disclose vulnerability details
