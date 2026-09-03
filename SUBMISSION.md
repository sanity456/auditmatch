# AuditMatch submission pack

## Submission fields

| Field | Submission-ready value |
| --- | --- |
| Project | AuditMatch |
| One-line description | Evidence-backed security auditor matching with independent live-source consensus and deterministic selection policies. |
| Suggested category | Future of Work / Developer Tooling / Security |
| Live app | https://auditmatch.blazekingsley2.chatgpt.site/ |
| Public source | https://github.com/sanity456/auditmatch |
| Demo walkthrough | `DEMO.md` |
| Network | GenLayer StudioNet, chain ID 61999 |
| Contract | `0xD0f429d3Ca60Db86C6bf6d82E4Da286a0E498ac2` |
| Deployment proof | https://explorer-studio.genlayer.com/tx/0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b |
| License | MIT |
| Repository owner/contact | `sanity456` on GitHub |

Use the exact category names offered by the target submission portal; the recommended positioning is security procurement infrastructure for developer teams.

## Short description

AuditMatch turns public work and conflict disclosures into expiring, wallet-bound auditor-fit assessments. Projects freeze a brief first; GenLayer validators independently fetch and assess cited sources; integrators consume the result through one deterministic policy read.

## Problem

Security audit procurement still depends on self-authored profiles, private introductions, and diligence repeated by every project. Evidence changes, conflicts can be disputed, and downstream tools cannot safely consume a reusable selection decision.

## Solution

A project atomically publishes a brief and 2–8 immutable fit criteria. An auditor submits a wallet-bound application with public evidence and a conflict disclosure. GenLayer validators independently fetch the same sources, assess the ordered criteria, and reach consensus on an expiring result containing a verdict, confidence BPS, independent-source count, criterion vector, reason codes, and citations. Rechecks and contests preserve history. Selection is allowed only when `evaluate_policy_view(...)` returns a deterministic pass.

## Why this must be GenLayer-native

The important state transition depends on subjective, changing external evidence. A deterministic smart contract cannot judge whether a public report supports a purpose-specific criterion. A private AI API can make that judgment, but cannot provide shared replay, validator consensus, immutable history, or on-chain policy enforcement. AuditMatch puts the web-plus-model judgment inside an intelligent transaction, then keeps downstream reads deterministic and model-free.

## What judges should test

1. Open the live app in **Preview**. Confirm the banner says every action is simulated locally.
2. In the SeaGlass sample, choose Hexloom Research and run the sample match.
3. Open **Policy lab**, evaluate the default policy, and simulate selection.
4. Switch to **StudioNet**. Finalized release-QA records appear immediately from the clearly dated verified snapshot while the public RPC refreshes.
5. Inspect `VAULT-Q4`: it is honestly labeled as an exception-path release test, not a successful auditor endorsement.
6. Read the release-proof strip: chain 61999, verified 25-method contract, contract address, deployment proof, and test-data disclosure.

No wallet is needed for this judge path. A wallet is required only for a new transaction.

## Verified evidence

- Contract deployment finalized successfully; repository source hash and all 25 on-chain method signatures match.
- `create_brief_with_criteria` creates the brief, freezes ordered criteria, and opens applications in one wallet approval with validation before storage.
- 12 direct contract tests cover successful atomic publication, malformed input, no-partial-state rollback, roles, policy gating, history, expiry, model/source failures, and legacy compatibility.
- Five-validator GLSim integration completes publication → application → assessment → policy → selection.
- A zero-value StudioNet smoke and a separate MetaMask approval both finalized atomic four-criterion publications with three agreeing validators.
- The current v2 registry was read back as 2 briefs, 1 application, and 1 assessment.
- The finalized `VAULT-Q4` journey is `MATCHED` / `SELECTED` / `CONFIRMED`. Its assessment is intentionally inconclusive: `INDETERMINATE`, 6000 BPS, 2 independent domains, `UUUU`. The default strict policy fails with `VERDICT_NOT_ACCEPTED` and `CONFIDENCE_BELOW_POLICY`; a separately configured test policy passes.
- 81 local automated checks plus one five-validator integration pass, along with GenVM lint and a production build.

Full evidence: `E2E-REPORT.md`, `TESTING.md`, `STEWARD-RESPONSE.md`, `deployments/studionet.json`, and `test-results/studionet/`.

## Safety and disclosure

- Preview identities and outcomes are fictional and simulated. Its links are illustrative public security references, not attributed work.
- StudioNet records are permanent release-QA data and are labeled `E2E TEST ONLY` where identities appear.
- No record proves a real auditor's identity, authorship, expertise, independence, availability, or endorsement.
- No tested transaction transferred value or created a procurement relationship.
- The contract is non-custodial; payments and escrow are intentionally out of scope.
- StudioNet is a development network, not a production deployment.

## 100-word pitch

AuditMatch is a GenLayer-native procurement rail for security work. A project freezes its audit scope and fit criteria before applications arrive. Auditors submit wallet-bound public evidence and conflict disclosures. Validators independently fetch those sources and agree on an expiring, purpose-specific assessment with confidence, source count, reason codes, and citations. Projects and external apps then call one deterministic policy read—no model at query time—to decide whether selection is allowed. Rechecks, contests, and history make changing or disputed evidence visible. The result is reusable diligence without pretending to create a universal auditor score, custodial marketplace, or audit certification.
