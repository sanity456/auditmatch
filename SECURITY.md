# Security notes

AuditMatch is a non-custodial matching and evidence-adjudication prototype. It is not an independent auditor certification, warranty, sanctions screen, identity proof, or guarantee that an engagement will be successful.

## Implemented controls

- Concrete pinned GenVM runner dependency.
- GenLayer storage types only.
- Frozen criteria before applications.
- Wallet-bound project and auditor roles.
- Multi-domain HTTPS evidence requirement.
- Bounded URL, text, source-count, and response sizes.
- Prompt-injection boundary that marks application and source content as untrusted data.
- Independent validator replay of the full assessment task.
- Strict output schema and exact criterion-vector comparison.
- Canonical expected, external, transient, and model error handling.
- Expiry, recheck, counter-evidence contest, supersession, and preserved history.
- Deterministic selection policy with explicit failure reasons.
- Project-only, one-time selection record.

## Residual risks

Public pages can change between validator fetches, disappear, contain misleading statements, or be controlled by the applicant. Model judgments can disagree and rotate. Distinct hostnames do not prove independent ownership. The URL guard cannot replace validator-level DNS and egress controls. A selected assessment can later be contested; integrations should re-evaluate current policy before every consequential action.

Before moving funds, obtain an independent contract audit, add an explicit economic and appeal model, define operational response procedures, and isolate escrow in a separate contract.

Report security issues privately to the repository owner. Do not place vulnerability details in an AuditMatch brief or evidence URL.
