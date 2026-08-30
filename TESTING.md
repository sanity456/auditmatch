# AuditMatch testing

## Fast checks

Run GenVM lint before tests. `npm run verify` runs 18 frontend model/status checks, 10 receipt-safety checks, 15 StudioNet read regressions, 8 test-harness pacing/retry/timeout checks, 4 wallet-provider selection checks, the atomic one-write frontend regression, and the production build. The 12-test Python direct suite covers atomic validation and rollback safety, legacy compatibility, roles, policy gating, history, expiry, and malformed model/source responses.

```powershell
genvm-lint check contracts/audit_match.py --json
pytest tests/direct -q
npm run verify
```

The GLSim integration test uses five mocked validators and mocked web/model responses. It exercises atomic publication through the complete assessment and selection workflow as a deterministic consensus regression; it is not proof of real external fetching.

## Real StudioNet workflow

First run a read-only preflight:

```powershell
npm run test:live
```

To explicitly authorize permanent, clearly labeled test records on the deployed StudioNet contract:

```powershell
npm run test:live -- --execute
```

For the bounded atomic-release smoke, which submits exactly one permanent zero-value transaction and verifies the resulting `OPEN` brief and ordered criteria:

```powershell
npm run verify:atomic:live
```

This test uses the address recorded in `deployments/studionet.json`. It checks the network ID, local/on-chain source hash, complete method schema, and public-source availability before sending transactions. It never deploys a replacement contract, uses real assets, changes the CLI's active account/network, or sets mock responses or validator overrides.

Two new ephemeral wallets represent the project and applicant. Their keys are generated in memory, never logged or saved, and never funded. A restricted EIP-1193-compatible provider signs only zero-value StudioNet consensus transactions. This exercises the same GenLayer SDK address/provider path as the app; it does not automate a real browser wallet extension's approval screen.

The live and deployment-verification scripts compile and import the app's actual `src/studio-read.ts` and `src/transaction.ts` helpers. Receipt checks select the most recent actual leader, not a trailing idle validator. Finalized-state reads use raw GenVM calldata on StudioNet to avoid its legacy long-RLP-header decoder defect. This compatibility path is restricted to StudioNet and never changes write encoding, signs a transaction, or silently falls back after an RPC failure. Local regression tests reproduce both previously failing payload sizes and verify failed response statuses and integer precision.

The brief and candidate are labeled `E2E TEST ONLY`. Both wallets belong to the test harness. The frozen criteria concern submitted public reference material, not the applicant's identity, authorship, audit history, expertise, independence, or availability. A passing test must not be presented as certification of a real auditor.

The planned workflow checks the following; it stops at the first unexpected failure. See `E2E-REPORT.md` for actually completed coverage and current blockers:

1. Atomically create the brief, freeze all criteria, and open applications in one transaction.
2. Reject unauthorized edits, edits after criteria freeze, self-applications, and duplicate applications.
3. Submit an application and run actual validator web/model assessment with full consensus.
4. Evaluate a passing policy and a deliberately failing policy; reject unauthorized and policy-failing selection.
5. Re-fetch evidence for a recheck, preserve history, and reject the superseded assessment.
6. Open a test-only contest, block selection while contested, and resolve using live counter-evidence.
7. Select the candidate using the final passing policy; verify the immutable selection record and reject repeat selection.

Each transaction must finalize, and its execution result is checked separately. Expected reverts are verified by their reason codes, not merely by a failed status. Writes run sequentially, with paced receipt polling, to respect the public service's rate limits. An uncertain write is never automatically resubmitted.

The hosted endpoint returned a stricter **30 requests/minute** read limit during testing. The live harness now spaces read-only operations at least three seconds apart, bounds each read attempt to 45 seconds, and retries only recognized transient read errors, at most three times, with 15/30/45-second delays. Contract reverts and encoding errors are not retried. Do not refresh the browser registry or run other RPC-heavy verification jobs alongside the live run; browser verification follows it. The app adapter itself continues to surface transport errors rather than masking them or silently retrying writes.

Public evidence comes from the [Slither README](https://raw.githubusercontent.com/crytic/slither/master/README.md), the [Solidity security documentation source](https://docs.soliditylang.org/en/latest/_sources/security-considerations.rst.txt), and the [Slither tools overview](https://raw.githubusercontent.com/crytic/slither/master/docs/src/tools/README.md). The text sources avoid oversized HTML and navigation-only truncation under the contract's 100 KB body / 12,000-character assessment limits. Reported source hashes are the test runner's preflight observations, not validator-signed content hashes.

Generated reports are retained under `test-results/studionet/`, outside the `.artifacts` directory that gltest clears. Reports include public wallet addresses, transaction hashes, outcomes, consensus votes, state checks, and assessment snapshots, but no private keys. A failed test records its last submitted transaction for diagnosis. Since test keys are not persisted, restarting creates a new labeled run rather than taking control of an earlier test record.

## Browser verification

Use the deployed app's StudioNet mode to load a test brief, inspect its real evidence/assessment, and evaluate policy through the UI. The v1 `A3B71370` run rendered as matched, bound selection to assessment 3, and satisfied the deterministic policy without browser warnings. Wallet discovery selects MetaMask explicitly through EIP-6963 or the injected provider list and refuses Phantom or ambiguous providers. The v1 MetaMask connection and six-write publication path passed with separate action-time approvals. Atomic v2 reduces that publication to one wallet prompt; both the restricted-provider smoke and the final MetaMask path passed. Transaction `0xc1c964c88b3f93b443b027ce8c0a0aba72581ba1d93010a04ecfbf3f9a6e3cca` finalized successfully and direct reads confirmed `VAULT-Q4` is `OPEN` with four required criteria frozen in order. Rejection screens and account changes remain manual QA.
