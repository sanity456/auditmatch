import assert from "node:assert/strict";
import {test} from "node:test";

import {assertSuccessfulStudioExecution} from "../src/transaction";

const leaderSuccess = {mode: "leader", execution_result: "SUCCESS"};
const leaderFailure = {mode: "leader", execution_result: "ERROR"};
const idleValidator = {mode: "validator", vote: "idle", execution_result: "ERROR"};
const validatorSuccess = {mode: "validator", vote: "agree", execution_result: "SUCCESS"};

function receipt(entries: unknown[]) {
  return {status: "FINALIZED", consensus_data: {leader_receipt: entries}};
}

test("real StudioNet shape: successful leader followed by an idle validator is successful", () => {
  // Reproduced by live tx 0xc01d8ce64c1a11ede607fda02b815e53e08a2155a30d3abf73cc6e500bc4285f.
  // get_brief confirmed OPEN although the final collection entry reported idle.
  assert.doesNotThrow(() => assertSuccessfulStudioExecution(
    receipt([leaderSuccess, idleValidator]), "open_brief",
  ));
});

test("a validator error must not override the successful leader proposal", () => {
  assert.doesNotThrow(() => assertSuccessfulStudioExecution(receipt([
    leaderSuccess, {...idleValidator, vote: "disagree"},
  ]), "open_brief"));
});

test("a successful validator must not conceal a failed leader proposal", () => {
  assert.throws(() => assertSuccessfulStudioExecution(
    receipt([leaderFailure, validatorSuccess]), "open_brief",
  ), /ERROR/);
});

test("the most recent actual leader proposal controls the outcome", () => {
  assert.throws(() => assertSuccessfulStudioExecution(
    receipt([leaderSuccess, leaderFailure, idleValidator]), "open_brief",
  ), /ERROR/);
});

test("a collection containing no actual leader fails closed", () => {
  assert.throws(() => assertSuccessfulStudioExecution(
    receipt([idleValidator]), "open_brief",
  ), /UNKNOWN/);
});

test("a single successful leader receipt is accepted", () => {
  assert.doesNotThrow(() => assertSuccessfulStudioExecution(
    {consensus_data: {leader_receipt: leaderSuccess}}, "open_brief",
  ));
});

test("finality without an execution result is not success", () => {
  assert.throws(() => assertSuccessfulStudioExecution({status: "FINALIZED"}, "open_brief"), /UNKNOWN/);
});

test("malformed collection entries cannot mask the real leader", () => {
  assert.doesNotThrow(() => assertSuccessfulStudioExecution(
    receipt([null, 42, "SUCCESS", [], leaderSuccess, idleValidator]), "open_brief",
  ));
});

test("success without an identifiable leader fails closed", () => {
  assert.throws(() => assertSuccessfulStudioExecution(
    receipt([{execution_result: "SUCCESS"}]), "open_brief",
  ), /UNKNOWN/);
});

test("a single successful validator is not a successful leader", () => {
  assert.throws(() => assertSuccessfulStudioExecution(
    {consensus_data: {leader_receipt: validatorSuccess}}, "open_brief",
  ), /UNKNOWN/);
});
