# AuditMatch end-to-end test report

Date: August 30, 2026 (UTC); passing native run completed August 29

Result: **PASS.** Atomic v2 passes contract validation, frontend one-write regression, five-validator integration, exact StudioNet deployment verification, a live one-transaction publish smoke, the final MetaMask one-approval flow, and a finalized application → assessment → policy → selection journey. The original v1 release retains the complete real-source workflow, browser policy verification, MetaMask connection, and six-write wallet baseline as historical evidence. Atomic v2 replaces that six-write publication path with one zero-value transaction and cannot leave a partial draft through the primary app flow.

## Changes verified locally

- Receipt handling selects the most recent actual leader, ignoring trailing idle-validator entries; missing or failed leader execution still fails closed.
- StudioNet finalized reads use raw GenVM calldata, avoiding the hosted parser's long-RLP-header defect. Failed status envelopes are rejected and large integers retain their precision.
- The app, live test runner, and deployment verifier share the same read and receipt helpers.
- Draft briefs now display Draft instead of Open, without changing contract rules.
- App and test reads share pacing, a 45-second attempt timeout, and bounded retries only for recognized transient read errors. Writes never enter that queue and are never automatically resubmitted.
- `create_brief_with_criteria` validates the entire criteria payload before storage, preserves order, commits the brief directly as `OPEN`, and retains the legacy draft methods for compatibility.

## Local verification

| Check | Result |
| --- | --- |
| GenVM lint | Passed; concrete runner unchanged |
| Direct contract tests | 12 passed |
| Frontend model and brief-state labels | 18 passed |
| Receipt regressions | 10 passed |
| StudioNet read regressions | 15 passed |
| Read pacing/retry/timeout tests | 8 passed |
| Wallet-provider and account-change tests | 6 passed |
| Release truthfulness and verified-snapshot tests | 8 passed |
| Atomic frontend submission test | 1 passed; exactly one write |
| Five-validator GLSim integration | 1 passed |
| Typecheck and production build | Passed |

Total: 78 local automated checks passed, plus one five-validator integration, GenVM lint, and the production build (79 automated tests including integration).

## Atomic v2 verification

- Contract: `0xD0f429d3Ca60Db86C6bf6d82E4Da286a0E498ac2`.
- Deployment transaction: `0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b`.
- Source SHA-256: `b3d94efe1128b1c8840d210350ee0cc05b302195a9da40f73e6bf559f70dec18`.
- Deployment: `FINALIZED`; leader execution `SUCCESS`; source and all 25 method signatures match locally.
- Atomic smoke: `ATOMIC-20260830100549-16C7F4BF`.
- Atomic transaction: `0xf5dbed97f253a023593317eb9c8280227828f6951b7323866241b46855c1f45a`.
- Result: one zero-value, full-consensus transaction; leader execution `SUCCESS`; three validators agreed.
- Final state: brief `OPEN`, four required criteria in submitted order: `ATOMIC_COUNT`, `ORDER_PRESERVED`, `NO_PAYMENT`, `TEST_ONLY`.
- Test key was generated in memory and not persisted. The permanent record is labeled `E2E TEST ONLY`.
- MetaMask transaction: `0xc1c964c88b3f93b443b027ce8c0a0aba72581ba1d93010a04ecfbf3f9a6e3cca`.
- MetaMask result: `FINALIZED`; leader execution `SUCCESS`; `MAJORITY_AGREE`; three validators agreed; zero transfer value.
- Wallet-created state: `0x5aab9538b717de9f3380f86f00b698c79041bea7:VAULT-Q4` is `OPEN` with required criteria `SOLIDITY`, `ACCESS`, `REPORT`, and `CONFLICT` frozen at positions 0–3.
- The wallet-created record uses the app's bundled Meridian Treasury demonstration copy. It is release QA evidence, not proof of a real project, auditor, engagement, or procurement relationship.

## Atomic v2 finalized journey

- Read-only verification completed August 30, 2026 at `2026-08-30T13:52:18.811Z`; no signature or transaction was used for the gate.
- Current registry counts: 2 briefs, 1 application, and 1 assessment.
- `VAULT-Q4` is `MATCHED`; its release-test application is `SELECTED`; the selection is `CONFIRMED`.
- Assessment 1 is `ACTIVE`, `INDETERMINATE`, 6000 BPS, two independent source domains, and criterion vector `UUUU`.
- The default strict policy rejects it with `VERDICT_NOT_ACCEPTED` and `CONFIDENCE_BELOW_POLICY`.
- A separately configured, explicitly acknowledged test policy accepts `INDETERMINATE` at 6000 BPS and passes. This is exception-path plumbing evidence, not a successful auditor match or endorsement.
- The frontend bundles the exact state read at `2026-08-30T13:37:38.164Z`, displays it immediately with a dated snapshot label, and refreshes finalized state in the background using the paced public-RPC reader.

## Legacy v1 full workflow and browser verification

- Network: GenLayer StudioNet, chain ID `61999`.
- Contract: `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`.
- Source SHA-256: `6514b063bceaf944ab891149b075273f18bcbdde2b2267ce235d6aced46be434`.
- Source hash and all 24 method signatures match the archived v1 release.
- Passing run: `E2E-20260829202905-A3B71370`.
- Run artifact: `test-results/studionet/E2E-20260829202905-A3B71370.json`.
- Native workflow result: **PASS — 18 transaction checks and 6 read/state groups**.
- Intelligent writes: initial assessment, recheck, and contest resolution each finalized with leader execution `SUCCESS` and three agreeing validators.
- Assessment result: `STRONG_MATCH`, `MM`, 9000 BPS, two source domains; assessment 3 is bound to the confirmed selection.
- Final state: brief `MATCHED`, application `SELECTED`, selection `CONFIRMED`.
- Read retries in the passing run: zero.
- Final browser verification: **PASS** after the user refreshed the existing localhost tab. StudioNet rendered the `A3B71370` brief as `Matched`, showed the selected test candidate at 90% with two independent domains and `MM`, and displayed the selection bound to assessment 3.
- Deterministic browser policy read: **PASS**. The UI returned `Policy satisfied`, `This assessment clears the gate.`, and `Selection already recorded`; the refreshed tab reported no warnings or errors.
- Production wallet connection: **PASS** with user approval. Version 4 selected MetaMask, retained StudioNet, replaced `Connect` with the shortened connected address, and opened no Phantom tab or prompt. No on-chain transaction was initiated.
- Production wallet write path: **PASS** with separate action-time approval for six sequential writes (`create_brief`, four `add_criterion` calls, and `open_brief`). A direct finalized-state read returned brief key `MM-QA-20260830-A1`, state `OPEN`, 14-day validity, and four required frozen criteria: `TEST_SCOPE`, `PUBLIC_REFERENCE`, `NO_CREDENTIAL_CLAIM`, and `NO_CONFLICT_ASSERTION`. Every write had zero transfer value; no additional transaction was submitted.

The passing workflow used real web/model calls, normal consensus, no mocked responses, and no validator overrides. It checked brief creation, access controls, actual assessment, policy pass/rejection, rechecks and preserved history, contests and resolution, policy-gated selection, and repeat-selection rejection.

## Earlier runs and resolved failures

The initial two failed runs and their diagnosis are preserved in `test-results/studionet/initial-failure-report-20260828.md`, with the original JSON reports and RPC diagnostics in the same directory.

Run `E2E-20260828194600-683F1407` passed 13 finalized transaction checks, including the live recheck, then stopped at a read with **Rate limit exceeded: 30 requests per minute** while browser refreshes ran concurrently. Run `E2E-20260828200039-0F921FEE` later stopped after the host lost DNS connectivity. Their reports remain failures, not retroactive passes. The app and harness now share paced, bounded read handling, and the successful run completed with zero retries.

The browser confirmed that the previously failing policy query now passes and that requiring three domains rejects the two-domain assessment. Because the browser's localhost navigation policy prevented an agent-driven reload, the user refreshed the existing tab; final matched-state rendering and the default policy pass were then verified without warnings or errors. These observations and the earlier transport failures are recorded in `test-results/studionet/browser-verification-20260828.json`; no navigation workaround was attempted.

## Safety boundary and remaining coverage

- Every persistent test brief and candidate is clearly labeled `E2E TEST ONLY`. The criteria concern submitted public reference material, not a real auditor's identity, authorship, expertise, independence, or availability.
- Automated test keys exist only in memory. The production QA wallet remained inside MetaMask; no seed phrase or private key was exposed. The legacy six-write baseline, atomic v2 smoke, and MetaMask atomic publish all had zero transfer value; no token transfer or real procurement occurred.
- Permanent test records are not deleted; earlier failed-run keys were not retained.
- Actual browser wallet-extension connection, StudioNet readiness, project/applicant account switching, transaction approval, assessment, policy, selection, and the atomic one-write brief publication path were exercised with MetaMask. The resulting v2 brief and all four frozen criteria were verified by direct finalized-state reads. Six automated provider/account-change checks pass; the wallet-extension rejection screen remains untested.
- The frontend is publicly hosted at `https://auditmatch.blazekingsley2.chatgpt.site` and remains available locally at `http://127.0.0.1:5175/` for development.
- The public RPC is rate-limited. The UI now renders a dated verified snapshot immediately and performs one paced background refresh; production-scale indexing and wallet-rejection QA remain separate expansion work.

See `TESTING.md` for repeatable commands and source links. The original Studio parser diagnosis is cited in the archived failure report.
