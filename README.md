# AuditMatch

Evidence-backed security auditor matching, native to GenLayer.

[Live app](https://auditmatch.blazekingsley2.chatgpt.site/) · [Submission pack](SUBMISSION.md) · [90-second demo](DEMO.md) · [Architecture](ARCHITECTURE.md) · [Security boundary](SECURITY.md)

AuditMatch lets a project atomically publish an immutable audit brief with 2–8 ordered fit criteria. Auditors bind public evidence and a conflict disclosure to their wallet. GenLayer validators independently fetch the cited sources, assess every criterion, and agree on an expiring result. Projects then use one deterministic contract read to decide whether a candidate clears their policy.

The contract is non-custodial. An assessment is evidence for a purpose-specific selection policy—not an audit certification, universal reputation score, or payment instruction.

## What is complete

- Atomic brief publication: create the brief, freeze every criterion, and open applications in one wallet approval.
- Wallet-bound applications with 2–4 public HTTPS sources from at least two domains.
- Independent validator replay and ordered `M`, `P`, `N`, or `U` criterion vectors.
- `STRONG_MATCH`, `POTENTIAL_MATCH`, `NO_MATCH`, and `INDETERMINATE` assessments with confidence BPS, source count, reason codes, citations, issue time, and expiry.
- Rechecks, counter-evidence contests, immutable history, and project-owner-only selection.
- Deterministic integration read: `evaluate_policy_view(application_id, policy_json, assessment_id)`.
- Explicit acknowledgement before an exception policy can select an `INDETERMINATE` or `NO_MATCH` result.
- MetaMask-only wallet discovery, StudioNet chain switching, transaction lifecycle cards, and account/chain-change handling.
- Responsive React interface with two deliberately distinct modes:
  - **Preview** uses fictional sample identities and simulated local outcomes. It never fetches, signs, or writes.
  - **StudioNet** immediately shows a dated, read-only snapshot of finalized release-QA records while a paced live refresh runs against the public RPC.

## Quick start

Requirements: Node.js 22 or newer. A wallet is not required for Preview or read-only StudioNet inspection.

```bash
git clone https://github.com/sanity456/auditmatch.git
cd auditmatch
npm ci
cp .env.example .env
npm run dev
```

On PowerShell, replace the copy command with:

```powershell
Copy-Item .env.example .env
```

Open the local URL printed by Vite. The checked-in example configuration points to the verified StudioNet contract and contains no secret.

## Verified StudioNet release

- Network: GenLayer StudioNet, chain ID `61999`.
- Atomic v2 contract: `0xD0f429d3Ca60Db86C6bf6d82E4Da286a0E498ac2`.
- [Deployment transaction](https://explorer-studio.genlayer.com/tx/0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b): `FINALIZED`, leader execution `SUCCESS`.
- Source SHA-256: `b3d94efe1128b1c8840d210350ee0cc05b302195a9da40f73e6bf559f70dec18`.
- On-chain source and all 25 method signatures match the repository release.
- MetaMask atomic publication transaction: [`0xc1c964…e3cca`](https://explorer-studio.genlayer.com/tx/0xc1c964c88b3f93b443b027ce8c0a0aba72581ba1d93010a04ecfbf3f9a6e3cca), zero value, majority agreement, four frozen criteria.
- Finalized v2 release journey: 2 briefs, 1 application, 1 assessment, and 1 confirmed selection.
- The live `VAULT-Q4` journey is intentionally an **exception-path release test**: `INDETERMINATE`, 6000 BPS, 2 sources, `UUUU`. The strict policy rejects it; an explicit test policy passes. It demonstrates plumbing and policy enforcement, not auditor quality.

The original v1 contract remains immutable at `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`, with its complete 18-transaction workflow retained as historical test evidence.

## Verify

Fast frontend and release checks:

```bash
npm run verify
```

Contract checks require Python, `pytest`, and the GenVM linter:

```bash
genvm-lint check contracts/audit_match.py --json
pytest tests/direct -q
```

Read-only StudioNet gates—no wallet, signature, or transaction:

```bash
npm run verify:deployment
npm run verify:journey:live
```

The five-validator GLSim integration command and live-write safety rules are documented in [TESTING.md](TESTING.md). Full results are in [E2E-REPORT.md](E2E-REPORT.md), with machine-readable release metadata in [deployments/studionet.json](deployments/studionet.json).

## Repository map

- `contracts/audit_match.py` — production intelligent contract with a pinned GenVM runner hash.
- `src/` — React app, StudioNet adapter, verified snapshot, and deterministic Preview model.
- `tests/direct/` — 12 fast contract tests, including atomic rollback safety.
- `tests/integration/` — five-validator consensus workflow.
- `scripts/` — read-only release gates and explicitly authorized live test harnesses.
- `deployments/` — v2 and archived v1 release evidence.

MIT licensed. See [EXPANSION.md](EXPANSION.md) for the recommended route from evidence connectors to operator analytics and, only later, separately audited escrow adapters.
