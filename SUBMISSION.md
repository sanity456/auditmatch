# Submission: AuditMatch

Project name: AuditMatch

One-line description: Evidence-backed security auditor matching with independent live-source consensus and deterministic selection policies.

Problem: audit procurement relies on self-authored profiles, private introductions, and one-off diligence. Projects repeatedly verify the same public work, conflict claims are difficult to contest, and downstream tooling cannot consume a reusable decision.

Solution: projects freeze a purpose-specific brief and fit criteria; auditors bind public evidence and disclosures to a wallet; GenLayer validators independently fetch and assess the same sources; the contract issues an expiring assessment and exposes one deterministic policy read.

Why GenLayer-native: the important state transition depends on subjective external evidence. Validators independently replay the complete web-plus-model assessment and must agree on the ordered criterion vector before state changes. Deterministic contracts alone cannot make that evidence judgment, while a private AI API would not provide shared settlement or appeals.

Preview demo (simulated, no chain writes): open the SeaGlass brief, select Hexloom Research, run the match, open Policy lab, evaluate the default policy, and record the auditor selection.

Contract: `contracts/audit_match.py`

Constructor: `[1]`

StudioNet atomic v2 contract: `0xD0f429d3Ca60Db86C6bf6d82E4Da286a0E498ac2`

Deployment transaction: `0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b`

Verified through August 30, 2026: atomic v2 finalized with execution `SUCCESS`, matching source and all 25 methods. `create_brief_with_criteria` creates the brief, freezes all ordered criteria, and opens applications in one wallet approval. Twelve direct tests cover success, validation, no-partial-state rollback, and legacy compatibility; a five-validator GLSim workflow passed; and one live zero-value StudioNet smoke created an `OPEN` brief with four ordered required criteria and three agreeing validators. The final MetaMask path also passed: transaction `0xc1c964c88b3f93b443b027ce8c0a0aba72581ba1d93010a04ecfbf3f9a6e3cca` finalized with leader execution `SUCCESS`, majority agreement, zero transfer value, and an `OPEN` four-criterion brief. The original v1 release remains at `0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95` with its complete 18-transaction native workflow preserved as historical evidence. Verification records are demo or test data, not real auditor endorsements or procurement relationships. See `E2E-REPORT.md`, `deployments/studionet.json`, and `deployments/studionet-v1.json`.

Frontend: [publicly hosted](https://auditmatch.blazekingsley2.chatgpt.site), configured for the verified StudioNet contract, and also available locally with `npm run dev`.

Core read: `evaluate_policy_view(application_id, policy_json, assessment_id)`

Safety boundary: public evidence only, non-custodial, and not an audit certification. StudioNet is a development network, not a production deployment.
