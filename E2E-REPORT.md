# AuditMatch end-to-end test report

Date: August 30, 2026 (UTC); passing native run completed August 29

Result: **PASS.** The native StudioNet workflow and the final read-only browser flow both passed. The original receipt and policy-read defects are fixed, the full contract workflow passed with real sources and normal consensus, and the app rendered the resulting matched selection and deterministic policy decision without browser errors. Actual wallet-extension prompts remain separate manual release QA.

## Changes verified locally

- Receipt handling selects the most recent actual leader, ignoring trailing idle-validator entries; missing or failed leader execution still fails closed.
- StudioNet finalized reads use raw GenVM calldata, avoiding the hosted parser's long-RLP-header defect. Failed status envelopes are rejected and large integers retain their precision.
- The app, live test runner, and deployment verifier share the same read and receipt helpers.
- Draft briefs now display Draft instead of Open, without changing contract rules.
- App and test reads share pacing, a 45-second attempt timeout, and bounded retries only for recognized transient read errors. Writes never enter that queue and are never automatically resubmitted.

## Local verification

| Check | Result |
| --- | --- |
| GenVM lint | Passed; concrete runner unchanged |
| Direct contract tests | 9 passed |
| Frontend model and brief-state labels | 18 passed |
| Receipt regressions | 10 passed |
| StudioNet read regressions | 15 passed |
| Read pacing/retry/timeout tests | 8 passed |
| Typecheck and production build | Passed |

Total: 60 local checks passed, plus lint and build.

## Live verification

- Network: GenLayer StudioNet, chain ID `61999`.
- Contract: `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`.
- Source SHA-256: `6514b063bceaf944ab891149b075273f18bcbdde2b2267ce235d6aced46be434`.
- Source hash and all 24 method signatures match the deployed release. No contract changes or redeployment.
- Passing run: `E2E-20260829202905-A3B71370`.
- Run artifact: `test-results/studionet/E2E-20260829202905-A3B71370.json`.
- Native workflow result: **PASS — 18 transaction checks and 6 read/state groups**.
- Intelligent writes: initial assessment, recheck, and contest resolution each finalized with leader execution `SUCCESS` and three agreeing validators.
- Assessment result: `STRONG_MATCH`, `MM`, 9000 BPS, two source domains; assessment 3 is bound to the confirmed selection.
- Final state: brief `MATCHED`, application `SELECTED`, selection `CONFIRMED`.
- Read retries in the passing run: zero.
- Final browser verification: **PASS** after the user refreshed the existing localhost tab. StudioNet rendered the `A3B71370` brief as `Matched`, showed the selected test candidate at 90% with two independent domains and `MM`, and displayed the selection bound to assessment 3.
- Deterministic browser policy read: **PASS**. The UI returned `Policy satisfied`, `This assessment clears the gate.`, and `Selection already recorded`; the refreshed tab reported no warnings or errors.

The passing workflow used real web/model calls, normal consensus, no mocked responses, and no validator overrides. It checked brief creation, access controls, actual assessment, policy pass/rejection, rechecks and preserved history, contests and resolution, policy-gated selection, and repeat-selection rejection.

## Earlier runs and resolved failures

The initial two failed runs and their diagnosis are preserved in `test-results/studionet/initial-failure-report-20260828.md`, with the original JSON reports and RPC diagnostics in the same directory.

Run `E2E-20260828194600-683F1407` passed 13 finalized transaction checks, including the live recheck, then stopped at a read with **Rate limit exceeded: 30 requests per minute** while browser refreshes ran concurrently. Run `E2E-20260828200039-0F921FEE` later stopped after the host lost DNS connectivity. Their reports remain failures, not retroactive passes. The app and harness now share paced, bounded read handling, and the successful run completed with zero retries.

The browser confirmed that the previously failing policy query now passes and that requiring three domains rejects the two-domain assessment. Because the browser's localhost navigation policy prevented an agent-driven reload, the user refreshed the existing tab; final matched-state rendering and the default policy pass were then verified without warnings or errors. These observations and the earlier transport failures are recorded in `test-results/studionet/browser-verification-20260828.json`; no navigation workaround was attempted.

## Safety boundary and remaining coverage

- Every persistent test brief and candidate is clearly labeled `E2E TEST ONLY`. The criteria concern submitted public reference material, not a real auditor's identity, authorship, expertise, independence, or availability.
- Test keys exist only in memory. No existing wallet keys or user funds were used. No token transfers or real procurement occurred.
- Permanent test records are not deleted; earlier failed-run keys were not retained.
- Actual browser wallet-extension connection, network switching, approval/rejection screens, and signing are not exercised by the ephemeral EIP-1193 test signer.
- The frontend is publicly hosted at `https://auditmatch.blazekingsley2.chatgpt.site` and remains available locally at `http://127.0.0.1:5175/` for development.
- The public RPC is rate-limited; avoid simultaneous or rapid registry refreshes. Production-scale indexing and wallet-extension QA remain separate release work.

See `TESTING.md` for repeatable commands and source links. The original Studio parser diagnosis is cited in the archived failure report.
