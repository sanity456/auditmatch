# AuditMatch architecture

## Boundary

Frontend responsibilities: discovery, wallet connection, preview data, form validation, indexing, and convenience analytics. Preview results are explicitly non-authoritative.

GenLayer contract responsibilities: freeze briefs and criteria, bind applications to wallets, fetch cited evidence during intelligent writes, reach consensus on the criterion vector, derive the verdict and decisiveness deterministically, preserve assessment history, resolve contests, evaluate selection policies, and record a policy-compliant selection.

Brief publication is atomic. The frontend submits the brief plus an ordered JSON array of 2–8 criteria to `create_brief_with_criteria`. The contract validates the complete payload, rejects duplicate or malformed criteria before storage, and records the brief directly as `OPEN` in one transaction. The legacy draft/add/open methods remain available for older integrations, but the app no longer uses them.

External source responsibilities: publish raw reports, profiles, disclosures, and other public evidence. A URL is a citation, not a trusted oracle; each validator refetches it.

## Intelligent transaction

```text
auditor application
  → 2–4 public HTTPS sources from ≥2 domains
  → every validator fetches each source live
  → every validator independently returns ordered M/P/N/U codes
  → exact criterion-vector comparison
  → deterministic verdict + decisiveness BPS
  → expiring on-chain assessment
```

`M` means materially supported match, `P` means related but incomplete support, `N` means a material mismatch, contradiction, or disqualifying conflict, and `U` means unclear or unsupported.

The validator does not merely validate JSON shape. It repeats the complete web-and-model task and compares the substantive vector exactly. Tagged error handling distinguishes deterministic source failures, transient failures, and model failures.

## Deterministic settlement

`evaluate_policy_view` performs no web request and no model call. It checks binding, status, latest-version requirements, accepted verdicts, minimum decisiveness, independent-domain count, expiry, and maximum age. `select_auditor` invokes the same logic and records a selection only when it passes.

AuditMatch does not move grant or audit funds. A value-bearing escrow should be a separate reviewed contract that consumes the deterministic read.

## StudioNet integration

The app and live test runner share the same read queue, calldata adapter, and receipt helpers. Reads use `gen_call` with `type: read`, `latest-final`, and raw GenVM calldata. This StudioNet-only compatibility path avoids the hosted Studio parser's incorrect handling of longer RLP headers; transaction writes continue to use the normal SDK encoding. Reads are paced below the observed hosted-service limit and receive bounded retries only for transient network failures. Failed RPC status envelopes are rejected, decoded integers retain their precision, and writes never enter the retry queue.

After finality, the app verifies the most recent actual leader's execution result. Trailing idle-validator entries do not overwrite a successful leader result, and missing or failed leader results fail closed. Finality alone is never treated as execution success.

## Confidence semantics

`confidence_bps` is evidence decisiveness, not a probability that the auditor is trustworthy or that a future audit will find every issue. It is derived from the criterion-code mix and number of independent source domains, capped at 9500 BPS.
