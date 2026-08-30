# Submission: AuditMatch

Project name: AuditMatch

One-line description: Evidence-backed security auditor matching with independent live-source consensus and deterministic selection policies.

Problem: audit procurement relies on self-authored profiles, private introductions, and one-off diligence. Projects repeatedly verify the same public work, conflict claims are difficult to contest, and downstream tooling cannot consume a reusable decision.

Solution: projects freeze a purpose-specific brief and fit criteria; auditors bind public evidence and disclosures to a wallet; GenLayer validators independently fetch and assess the same sources; the contract issues an expiring assessment and exposes one deterministic policy read.

Why GenLayer-native: the important state transition depends on subjective external evidence. Validators independently replay the complete web-plus-model assessment and must agree on the ordered criterion vector before state changes. Deterministic contracts alone cannot make that evidence judgment, while a private AI API would not provide shared settlement or appeals.

Preview demo (simulated, no chain writes): open the SeaGlass brief, select Hexloom Research, run the match, open Policy lab, evaluate the default policy, and record the auditor selection.

Contract: `contracts/audit_match.py`

Constructor: `[1]`

StudioNet contract: `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95`

Deployment transaction: `0x188197e1cf04c4d35590f0c983d9c3b54509a0c982dd5c3109c11953f526ed5f`

Verified through August 30, 2026: finalized deployment with execution `SUCCESS`, matching source and 24-method schema, a complete native StudioNet workflow, and final read-only browser verification. The successful run passed 18 transaction checks and 6 read/state groups: real public-evidence assessment (`MM`, 9000 BPS, two domains, three agreeing validators), deterministic policy pass/rejection, recheck and supersession, contest resolution with live counter-evidence, final selection, and repeat-selection rejection. After a user-assisted localhost refresh, the UI rendered the matched selection and returned `Policy satisfied` with no browser warnings or errors. The registry contains clearly labeled test-only records, not real auditor endorsements. Wallet-extension signing was not exercised. See `E2E-REPORT.md` and `deployments/studionet.json`.

Frontend: [publicly hosted](https://auditmatch.blazekingsley2.chatgpt.site), configured for the verified StudioNet contract, and also available locally with `npm run dev`.

Core read: `evaluate_policy_view(application_id, policy_json, assessment_id)`

Safety boundary: public evidence only, non-custodial, and not an audit certification. StudioNet is a development network, not a production deployment.
