import assert from "node:assert/strict";

import {buildDemoBriefs} from "../src/demo-data";
import {briefStateLabel, evaluateLocalPolicy, formatConfidence, policyToContractJson} from "../src/model";
import {assertSuccessfulStudioExecution} from "../src/transaction";
import type {Policy} from "../src/types";

const now = 1_800_000_000;
const briefs = buildDemoBriefs(now);
const strong = briefs[0].applications[0];
const potential = briefs[0].applications[1];
const pending = briefs[0].applications[2];
const policy: Policy = {
  acceptedVerdicts: ["STRONG_MATCH"],
  minimumConfidenceBps: 8500,
  minimumSignals: 2,
  maximumAgeSeconds: 30 * 86_400,
  requireLatest: true,
};

assert.deepEqual(evaluateLocalPolicy(strong, policy, now), {
  satisfied: true,
  failureReasons: [],
  assessmentId: strong.assessment?.id,
  verdict: "STRONG_MATCH",
});

assert.deepEqual(
  evaluateLocalPolicy(potential, policy, now).failureReasons,
  ["VERDICT_NOT_ACCEPTED"],
);

assert.deepEqual(evaluateLocalPolicy(pending, policy, now).failureReasons, ["ASSESSMENT_NOT_FOUND"]);

const expired = {
  ...strong,
  assessment: strong.assessment && {
    ...strong.assessment,
    issuedAtUnix: now - 40 * 86_400,
    expiresAtUnix: now - 10 * 86_400,
  },
};
assert.deepEqual(evaluateLocalPolicy(expired, policy, now).failureReasons, [
  "ASSESSMENT_EXPIRED",
  "ASSESSMENT_TOO_OLD",
]);

assert.equal(formatConfidence(8625), "86.3%");
assert.equal(
  policyToContractJson(policy),
  '{"accepted_verdicts":["STRONG_MATCH"],"minimum_confidence_bps":8500,"minimum_signals":2,"maximum_age_seconds":2592000,"require_latest":true}',
);

const success = {mode: "leader", execution_result: "SUCCESS"};
const failure = {mode: "leader", execution_result: "ERROR"};
assert.doesNotThrow(() => assertSuccessfulStudioExecution({
  consensus_data: {leader_receipt: [success]},
}, "assess_application"));
assert.doesNotThrow(() => assertSuccessfulStudioExecution({
  consensus_data: {leader_receipt: success},
}, "assess_application"));
assert.throws(() => assertSuccessfulStudioExecution({
  status: "FINALIZED", consensus_data: {leader_receipt: [failure]},
}, "assess_application"), /execution was not successful \(ERROR\)/);
assert.throws(() => assertSuccessfulStudioExecution({status: "FINALIZED"}, "assess_application"), /UNKNOWN/);
assert.throws(() => assertSuccessfulStudioExecution({
  consensus_data: {leader_receipt: [success, failure]},
}, "assess_application"), /ERROR/);
assert.doesNotThrow(() => assertSuccessfulStudioExecution({
  consensus_data: {leader_receipt: [failure, success]},
}, "assess_application"));

for (const [state, list, detail] of [
  ["DRAFT", "Draft", "Draft — not accepting applications"],
  ["OPEN", "Open", "Accepting applications"],
  ["MATCHED", "Matched", "Auditor selected"],
] as const) {
  assert.equal(briefStateLabel(state), list);
  assert.equal(briefStateLabel(state, "detail"), detail);
}

console.log("AuditMatch UI model and transaction safety: 18 checks passed");
