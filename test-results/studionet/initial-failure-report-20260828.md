# AuditMatch live end-to-end test report

Date: August 28, 2026 (UTC)

Result: **NOT PASSED end to end.** Real source fetching, validator assessment, and several access controls passed. Two integration defects were reproduced; selection, rechecks, and contest resolution were not reached by the automated run. No contract changes or redeployment were made.

## Environment and scope

- GenLayer StudioNet, chain ID `61999`.
- Contract: `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`.
- Source SHA-256: `6514b063bceaf944ab891149b075273f18bcbdde2b2267ce235d6aced46be434`.
- SDK: `genlayer-js` 1.1.8; local browser app at `http://127.0.0.1:5175/`.
- Real web/model calls, normal consensus, no mocked responses or validator overrides.
- Isolated ephemeral test wallets, zero token transfers, no existing user wallet keys used.
- Clearly labeled `E2E TEST ONLY` reference-review briefs. These test source-content requirements, not a real auditor's identity, authorship, expertise, independence, or availability.

## Passed live checks

The second run finalized ten transactions with the expected execution outcome: six successful operations and four intentional rejections.

| Check | Result |
| --- | --- |
| Live source/hash and complete method schema | Match the deployed release |
| Create brief, add two criteria, open brief | Passed |
| Non-owner changes criteria | Rejected: `only_project_owner` |
| Edit frozen criteria | Rejected: `criteria_locked` |
| Project applies to itself | Rejected: `project_cannot_self_apply` |
| Submit candidate and read stored application | Passed |
| Submit duplicate application | Rejected: `auditor_already_applied` |
| Actual public-evidence assessment | Finalized with leader execution `SUCCESS` and three agreeing validator votes |
| App displays real assessment and evidence | Passed |

Assessment transaction: `0x795561d2624f1486f52b2ca88f8525700cd316eb2c5636bbba5d9851949e555b`.

Assessment ID: `0x5f257ab9cd0d6e733569f362573fb6080c78010f:E2E-20260828191118-ABF16227:APP:0xf874514cd9b1a29bad6c28dee719c856e69a91c1:ASSESS:1`.

Observed result: `STRONG_MATCH`, `MM`, `9000` BPS, two distinct source domains, active status, and a 30-day validity interval. The receipt's equivalence output contains `{"criterion_codes":"MM"}`. The browser displayed the same result, both frozen criteria, and both evidence links. This is a passing result for the test's reference-material criteria only, not a real auditor certification.

## Blocker 1: the app can misread an idle validator receipt

`src/transaction.ts` selects the last entry of `consensus_data.leader_receipt`. StudioNet can append an entry with `mode: "validator"`, `vote: "idle"`, and `execution_result: "ERROR"` after the actual leader's successful result.

This was reproduced by `open_brief` transaction `0xc01d8ce64c1a11ede607fda02b815e53e08a2155a30d3abf73cc6e500bc4285f`. The actual leader succeeded and a finalized read showed the brief was `OPEN`; the original test harness incorrectly reported failure. The same assumption exists in the app guard added during deployment.

The harness and deployment-verification script now select an actual `mode: "leader"` entry. The app itself has not been changed. Seven dedicated regression checks were added: three currently pass and four currently fail, including the exact live receipt shape. The default `npm run verify` now includes these checks, so it correctly fails until the app issue is fixed.

## Blocker 2: large policy reads fail in StudioNet's RPC decoder

The normal SDK call to `evaluate_policy_view` fails for the real application and assessment IDs. The same error was reproduced by clicking **Evaluate policy** in the app.

| Request | Encoded size | Outcome |
| --- | --- | --- |
| Explicit real assessment ID | 432 RLP bytes, prefix `0xf9` | `RLP string ends with 383 superfluous bytes` |
| Use latest assessment with an empty assessment ID | 305 RLP bytes, prefix `0xf9` | `RLP string ends with 301 superfluous bytes` |
| Short nonexistent application control | 207 RLP bytes, prefix `0xf8` | Normal `APPLICATION_NOT_FOUND` policy result |

All three payloads round-trip correctly through the local RLP decoder. The observed boundary matches the upstream Studio parser: its long-list branch skips a fixed two-byte header, although these larger lists use a three-byte header. This is the identified cause based on the reproduced boundary and [GenLayer's parser implementation](https://github.com/genlayerlabs/genlayer-studio/blob/main/backend/protocol_rpc/transactions_parser.py#L604-L620).

A read-only compatibility probe sent raw GenVM calldata through the same `gen_call` endpoint. It returned the correct deterministic results without changing contract state:

- Normal strong-only policy: `satisfied: true`.
- Minimum confidence of 10000 BPS: `CONFIDENCE_BELOW_POLICY`.
- Maximum age of one second: `ASSESSMENT_TOO_OLD`.

This demonstrates that the deployed policy logic works, while the app's current SDK read encoding is incompatible with this StudioNet parser path. The compatibility approach has been verified diagnostically but has not been applied to the app or used to claim a completed end-to-end pass.

## Local checks and remaining coverage

- GenVM lint: passed; pinned runner unchanged.
- Existing direct contract tests: 9 passed.
- Existing UI model/transaction checks: 12 passed.
- New receipt regression checks: 3 passed, 4 failed.
- Production build: passed, including typechecks for the added regression tests; the app source remains unchanged.
- Live rechecks, contested-assessment resolution, policy-gated selection, and repeat-selection rejection: not reached because the run stopped at the policy-read defect.
- Actual browser wallet connection, network switching, and signing prompts: not exercised. Test transactions used a restricted ephemeral EIP-1193-compatible signer.

Two permanent, clearly labeled test briefs remain on StudioNet: the first receipt-diagnosis run has no applications; the second has one application and one assessment. Test keys were not persisted, and no deletion was attempted. Subsequent complete reruns will create new labeled records.

## Reproduction artifacts

- `scripts/e2e-studionet.mjs`: opt-in live workflow (`npm run test:live -- --execute`).
- `tests/receipt-regression.test.ts`: receipt regression reproduction (`npm run test:receipts`).
- `test-results/studionet/E2E-20260828190505-DD69629A.json`: first run, preserved with false-negative diagnosis.
- `test-results/studionet/E2E-20260828191118-ABF16227.json`: second run and real consensus assessment.
- `test-results/studionet/diagnostics-20260828.json`: RPC boundary, compatibility reads, and browser results.
- `TESTING.md`: test method, source links, and safety boundaries.

Next action requires fixing the app's receipt selection and StudioNet read compatibility, adding the corresponding regression coverage, and rerunning the full live workflow. A completed test run must not be claimed until that rerun reaches selection and the remaining state transitions.
