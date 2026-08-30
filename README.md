# AuditMatch

Evidence-backed security auditor matching, native to GenLayer.

AuditMatch lets a project publish an immutable audit brief and 2–8 fit criteria. Auditors bind an application to their wallet, disclose conflicts, and cite 2–4 public HTTPS sources from at least two domains. GenLayer validators fetch those sources live, independently assess every criterion, and agree on a compact criterion vector before an expiring assessment is stored.

Projects can select an auditor only when a deterministic policy read passes. The contract is non-custodial and does not claim to certify audit quality.

## What is built

- Multi-project brief and application registry.
- Frozen, ordered, purpose-specific fit criteria.
- Independent validator replay of live public evidence.
- `STRONG_MATCH`, `POTENTIAL_MATCH`, `NO_MATCH`, and `INDETERMINATE` assessments.
- Deterministic evidence-decisiveness BPS, source-domain count, reason codes, citations, digests, issue time, and expiry.
- Rechecks, counter-evidence contests, and immutable history.
- One deterministic integration read: `evaluate_policy_view(application_id, policy_json, assessment_id)`.
- Policy-gated, project-only auditor selection.
- Responsive React app with an interactive no-write preview and lazy-loaded StudioNet support.

## Run the app

```powershell
cd C:\Users\user\Documents\Codex\auditmatch
npm install
npm run dev
```

Preview mode requires no wallet and writes no chain state.

## StudioNet deployment

Deployed and verified on August 28, 2026, with constructor argument `1`:

- Network: GenLayer StudioNet (chain ID `61999`).
- Contract: `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`.
- Deployment transaction: `0x188197e1cf04c4d35590f0c983d9c3b54509a0c982dd5c3109c11953f526ed5f`.
- Finality: `FINALIZED`; contract execution: `SUCCESS`.
- On-chain source hash, all 24 method signatures, protocol reads, and deterministic policy rejection verified.

The local `.env` is configured. On a fresh copy, copy `.env.example` to `.env`, then start or restart `npm run dev`. Choose **StudioNet** in the app to load the deployed registry; connect a wallet only when you want to submit a transaction. Preview data is simulated and is not published on-chain. The live registry contains clearly labeled test-only records from verification runs.

This deploys the contract, not the frontend website: the frontend still runs locally. On August 29, 2026, a full native StudioNet workflow passed 18 transaction checks and 6 read/state groups with real source fetching, model consensus, recheck, contest resolution, and policy-gated selection. The receipt and large-policy-read defects are fixed, and the completed run needed no read retries. On August 30, the refreshed StudioNet UI rendered the final matched selection and returned the expected deterministic policy pass with no browser warnings or errors. Actual wallet-extension prompts remain separate manual QA. See `E2E-REPORT.md` and `TESTING.md`.

See `deployments/studionet.json` for the release record. Recheck it without a wallet or any chain writes:

```powershell
npm run verify:deployment
```

## Verify

```powershell
genvm-lint check contracts\audit_match.py --json
pytest tests\direct -q
npm run test:ui
npm run build
```

For five-validator consensus with mocked web and model responses, start GLSim on the configured port and run:

```powershell
python tests\run_glsim.py --port 4012 --validators 5
gltest tests\integration\test_audit_match_consensus.py -v -s
```

See `ARCHITECTURE.md`, `SOURCE_POLICY.md`, `SECURITY.md`, `EXPANSION.md`, and `SUBMISSION.md` for the trust boundary and expansion plan.
