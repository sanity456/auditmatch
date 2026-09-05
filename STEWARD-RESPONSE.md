# AuditMatch expiry review response

## Finding

This was a cross-platform direct-test harness defect, not a contract defect. The submitted contract correctly rejects an assessment only when the effective chain time is later than the assessment's stored `expires_at_unix` value.

The repository pins `genlayer-test==0.29.2`. After a contract is loaded, that version's `VMContext._refresh_gl_message` refreshes sender and origin but does not synchronize its updated `_datetime` into the SDK's cached `gl.message_raw["datetime"]`. The repository already compensated for that behavior on Windows, but the compatibility code returned early on Linux. Consequently, the steward's Linux run changed the test VM clock with `direct_vm.warp(...)` while contract code continued to observe the deployment timestamp. This explains both observed results: the original expiry check returned `satisfied: true`, and the first correction failed its hard-coded issued-at assertion.

## Correction

The direct-mode compatibility helper now synchronizes contract-visible datetime after every `direct_vm.warp(...)` on every operating system; only the file-descriptor workaround remains Windows-specific. The regression no longer asserts a runner-specific issue timestamp. It reads the issue timestamp actually persisted by the contract, proves `expires_at_unix == issued_at_unix + 2592000`, advances chain time to the derived `expires_at_unix + 1`, asserts the complete policy payload, and confirms that the read does not mutate historical status.

The reference run produced:

| Value | ISO-8601 | Unix seconds |
| --- | --- | ---: |
| Assessment issued | `2026-08-27T12:00:00Z` | `1787832000` |
| Expected expiry | `2026-09-26T12:00:00Z` | `1790424000` |
| Effective chain time | `2026-09-26T12:00:01Z` | `1790424001` |

Policy input:

```json
{
  "accepted_verdicts": ["STRONG_MATCH"],
  "minimum_confidence_bps": 8500,
  "minimum_signals": 2,
  "maximum_age_seconds": 2592000,
  "require_latest": true
}
```

Resulting assessment-policy payload:

```json
{
  "satisfied": false,
  "failure_reasons": ["ASSESSMENT_EXPIRED", "ASSESSMENT_TOO_OLD"],
  "assessment_id": "0x2bd806c97f0e00af1a1fc3328fa763a9269723c8:BRIDGE-V2:APP:0x81b637d8fcd2c6da6359e6963113a1170de795e4:ASSESS:1",
  "verdict": "STRONG_MATCH"
}
```

The assessment status after the view remains `ACTIVE`; expiry affects policy eligibility without deleting or rewriting history.

## Verification

The corrected regression passes on Windows and in a public Ubuntu Linux run. One immutable GitHub Actions run ties every required proof to repository commit `478c19a7b00eb67d593238424177865376eeba07`:

- Combined successful run: https://github.com/sanity456/auditmatch/actions/runs/33976304625
- Linux expiry regression and clean 12-test direct suite: https://github.com/sanity456/auditmatch/actions/runs/33976304625/job/101333492260
- Submitted StudioNet deployment, schema, and source proof: https://github.com/sanity456/auditmatch/actions/runs/33976304625/job/101333492311
- All frontend/release tests, type checking, and production build: https://github.com/sanity456/auditmatch/actions/runs/33976304625/job/101333492352

The Linux job printed the exact payload above and then reported `12 passed`. GenVM lint passed before the focused regression. All three jobs completed successfully.

The contract source was not changed, so no replacement deployment was necessary. A fresh read-only deployment verification confirmed that the submitted StudioNet deployment is finalized, executed successfully, exposes the same 25-method schema, and has the same source as this repository:

- Contract: `0xD0f429d3Ca60Db86C6bf6d82E4Da286a0E498ac2`
- Deployment transaction: `0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b`
- Source SHA-256: `b3d94efe1128b1c8840d210350ee0cc05b302195a9da40f73e6bf559f70dec18`
- Public CI verification time: `2026-09-05T15:56:37.901Z`

Reproduce locally:

```powershell
pytest tests/direct/test_audit_match.py::test_expired_assessment_fails_without_mutating_history -q -s
pytest tests/direct -q
npm run verify:deployment
```
