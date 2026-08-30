import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";

import {readStudioContract} from "./studio-runtime.mjs";

// Read-only release gate: verifies the exact browser-tested journey without
// signing, submitting, or mutating StudioNet state.
const root = new URL("../", import.meta.url);
const deployment = JSON.parse(await readFile(new URL("deployments/studionet.json", root), "utf8"));
const briefId = process.env.AUDITMATCH_RELEASE_BRIEF_ID
  ?? "0x5aab9538b717de9f3380f86f00b698c79041bea7:VAULT-Q4";
const applicationId = process.env.AUDITMATCH_RELEASE_APPLICATION_ID
  ?? `${briefId}:APP:0x7271c1592429f9152a2142b0b225fce033d511d3`;
const client = createClient({chain: studionet});
const read = (method, args = []) => readStudioContract(client, deployment.contractAddress, method, args);

assert.equal(await client.getChainId(), 61_999, "Unexpected StudioNet chain ID");

const brief = await read("get_brief", [briefId]);
const application = await read("get_application", [applicationId]);
const assessmentId = application.latest_assessment_id;
const assessment = await read("get_assessment", [assessmentId]);

const defaultPolicy = JSON.stringify({
  accepted_verdicts: ["STRONG_MATCH"],
  minimum_confidence_bps: 8500,
  minimum_signals: 2,
  maximum_age_seconds: 30 * 86_400,
  require_latest: true,
});
const explicitTestPolicy = JSON.stringify({
  accepted_verdicts: ["STRONG_MATCH", "INDETERMINATE"],
  minimum_confidence_bps: 6000,
  minimum_signals: 2,
  maximum_age_seconds: 30 * 86_400,
  require_latest: true,
});
const defaultResult = await read("evaluate_policy_view", [applicationId, defaultPolicy, assessmentId]);
const testResult = await read("evaluate_policy_view", [applicationId, explicitTestPolicy, assessmentId]);
const selection = await read("get_selection", [brief.selection_id]);

assert.equal(brief.state, "MATCHED");
assert.equal(brief.selected_application_id, applicationId);
assert.equal(brief.selected_assessment_id, assessmentId);
assert.equal(application.state, "SELECTED");
assert.equal(assessment.status, "ACTIVE");
assert.equal(assessment.verdict, "INDETERMINATE");
assert.equal(Number(assessment.confidence_bps), 6000);
assert.equal(Number(assessment.independent_signal_count), 2);
assert.equal(assessment.criterion_codes, "UUUU");
assert.equal(defaultResult.satisfied, false);
assert.deepEqual(defaultResult.failure_reasons, ["VERDICT_NOT_ACCEPTED", "CONFIDENCE_BELOW_POLICY"]);
assert.equal(testResult.satisfied, true);
assert.deepEqual(testResult.failure_reasons, []);
assert.equal(selection.state, "CONFIRMED");
assert.equal(selection.application_id, applicationId);
assert.equal(selection.assessment_id, assessmentId);
assert.equal(selection.project_owner, brief.project_owner);

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  readOnly: true,
  contractAddress: deployment.contractAddress,
  brief: {id: briefId, state: brief.state},
  application: {id: applicationId, state: application.state},
  assessment: {
    id: assessmentId,
    verdict: assessment.verdict,
    confidenceBps: Number(assessment.confidence_bps),
    signalCount: Number(assessment.independent_signal_count),
    criterionCodes: assessment.criterion_codes,
  },
  defaultPolicy: defaultResult,
  explicitTestPolicy: testResult,
  selection: {id: selection.selection_id, state: selection.state},
}, null, 2));
