# ADR 0002: Direct payments with manual proof review

## Status

Accepted

## Context

The launch must avoid Stripe and PayPal, charge no platform commission, and let each venue or coach receive funds directly. Reliable automatic validation of uploaded screenshots is not technically possible without provider transaction APIs.

## Decision

Show recipient-controlled GCash, Maya, QR Ph, or bank instructions in checkout. Require a transaction reference and private proof image. The recipient manually approves or rejects the proof. Hold unpaid court inventory for five minutes; after proof submission, reserve it until human review. Escalate reviews after two hours without automatically releasing possibly paid inventory.

## Consequences

The platform does not hold or disburse money and has no processor fees at launch. Confirmation is operationally slower and fraud detection remains advisory. The UI and documentation must never describe proof review as automatic or fraud-proof.

