# AuditMatch 90-second judge demo

Live app: https://auditmatch.blazekingsley2.chatgpt.site/

This walkthrough needs no wallet and sends no transaction.

## 0:00–0:12 — Establish the trust boundary

Open the app in **Preview** and point to the yellow banner.

Say: “AuditMatch matches a frozen security brief with wallet-bound public evidence. Preview is deliberately simulated: no source fetch, wallet prompt, or blockchain write.”

## 0:12–0:36 — Run the product loop

In the SeaGlass brief, choose **Hexloom Research** and click **Run sample match**. Let the four short simulation steps finish.

Say: “In the live path, GenLayer validators fetch every source and independently return the same ordered criterion vector. The contract stores the verdict, confidence BPS, independent-domain count, reason codes, citations, and expiry.”

Point out the `MMMM` vector, 90% sample score, public-reference disclosure, and the explicit simulated-result label.

## 0:36–0:58 — Show deterministic consumption

Click **Test selection policy**, then **Evaluate policy**. Click **Simulate auditor selection**.

Say: “The evidence judgment is subjective and consensus-based, but integration is deterministic. Any app calls `evaluate_policy_view` and receives a pass plus explicit failure reasons—no LLM at query time.”

## 0:58–1:18 — Prove the deployed release

Click **StudioNet**. The verified registry appears immediately; the app continues a paced finalized-state refresh in the background.

Point to the release strip: chain `61999`, 25 verified methods, atomic v2 contract, deployment proof, and dated snapshot. No wallet is needed to inspect state.

## 1:18–1:30 — End with the honest live result

Open `VAULT-Q4` if it is not already selected.

Say: “This permanent record is an exception-path release test, not a marketing result. Validators returned `INDETERMINATE`, 60%, two sources, `UUUU`. The strict policy rejects it; only an explicit test policy passes. That proves the app fails visibly and keeps policy exceptions auditable.”

Finish: “AuditMatch makes evidence judgment replayable and selection policy reusable, without claiming to certify auditors or custody payments.”

## Judge fallback

If the public StudioNet RPC is slow or rate-limited, the app retains the exact read-only snapshot verified on August 30, 2026 and labels it as a snapshot. Run these wallet-free gates from the repository for fresh finalized reads:

```bash
npm run verify:deployment
npm run verify:journey:live
```

The machine-readable expected state is in `deployments/studionet.json`.
