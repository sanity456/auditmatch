# AuditMatch

Evidence-backed security auditor matching, native to GenLayer.

AuditMatch lets a project publish an immutable audit brief and 2–8 fit criteria. Auditors bind an application to their wallet, disclose conflicts, and cite 2–4 public HTTPS sources from at least two domains. GenLayer validators fetch those sources live, independently assess every criterion, and agree on a compact criterion vector before an expiring assessment is stored.

Projects can select an auditor only when a deterministic policy read passes. The contract is non-custodial and does not claim to certify audit quality.

## What is built

- Multi-project brief and application registry.
- Atomic brief publication: create, freeze 2–8 criteria, and open in one wallet approval.
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

Atomic v2 was deployed and verified on August 30, 2026, with constructor argument `1`:

- Network: GenLayer StudioNet (chain ID `61999`).
- Contract: `0xD0f429d3Ca60Db86C6bf6d82E4Da286a0E498ac2`.
- Deployment transaction: `0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b`.
- Finality: `FINALIZED`; contract execution: `SUCCESS`.
- On-chain source hash, all 25 method signatures, protocol reads, and deterministic policy rejection verified.
- Atomic StudioNet smoke: one zero-value transaction created an `OPEN` brief with four ordered, required criteria and three agreeing validators.
- MetaMask atomic QA: one zero-value `create_brief_with_criteria` transaction finalized successfully with majority agreement and created the `OPEN` `VAULT-Q4` brief with four frozen criteria.

The original v1 contract and its records remain immutable at `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`; its release record is retained in `deployments/studionet-v1.json`.

The local `.env` is configured. On a fresh copy, copy `.env.example` to `.env`, then start or restart `npm run dev`. Choose **StudioNet** in the app to load the deployed registry; connect a wallet only when you want to submit a transaction. Preview data is simulated and is not published on-chain. The live registry contains clearly labeled test-only records from verification runs.

The frontend is publicly hosted at [auditmatch.blazekingsley2.chatgpt.site](https://auditmatch.blazekingsley2.chatgpt.site) and can also run locally. The original v1 release completed a full native StudioNet workflow with real source fetching, model consensus, recheck, contest resolution, policy-gated selection, and MetaMask wallet QA. Atomic v2 preserves that contract logic and adds a single-call publication path; it passed 12 direct tests, five-validator GLSim consensus, exact deployment verification, a live one-transaction StudioNet smoke test, and the final one-approval MetaMask path. See `E2E-REPORT.md` and `TESTING.md`.

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
