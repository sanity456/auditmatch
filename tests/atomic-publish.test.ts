import assert from "node:assert/strict";
import test from "node:test";

import type {CalldataEncodable, Hash} from "genlayer-js/types";

import {createBriefLive} from "../src/genlayer";
import type {WalletState} from "../src/types";

test("live brief publication submits one atomic contract write", async () => {
  const wallet: WalletState = {
    address: "0x1111111111111111111111111111111111111111",
  };
  const calls: Array<{
    wallet: WalletState;
    functionName: string;
    args: CalldataEncodable[];
  }> = [];
  const progress: string[] = [];
  const input = {
    key: " atomic-qa ",
    projectName: "E2E TEST ONLY - Atomic QA",
    title: "Atomic publication regression test",
    auditScope: "Verify that the complete brief is published through exactly one GenLayer contract write.",
    engagementTerms: "No payment or engagement exists; this payload is exclusively for a deterministic regression test.",
    validityDays: 14,
    criteria: [
      {key: "ONE", text: "The first required criterion is preserved in its original order.", required: true},
      {key: "TWO", text: "The second required criterion is preserved in its original order.", required: true},
    ],
  };

  const briefId = await createBriefLive(
    wallet,
    input,
    (message) => progress.push(message),
    async (submittedWallet, functionName, args) => {
      calls.push({wallet: submittedWallet, functionName, args});
      return `0x${"1".repeat(64)}` as Hash;
    },
  );

  assert.equal(briefId, `${wallet.address}:ATOMIC-QA`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].wallet, wallet);
  assert.equal(calls[0].functionName, "create_brief_with_criteria");
  assert.equal(calls[0].args[0], "ATOMIC-QA");
  assert.equal(calls[0].args[5], 14n * 86_400n);
  assert.deepEqual(JSON.parse(String(calls[0].args[6])), input.criteria);
  assert.deepEqual(progress, [
    "Publishing the brief and freezing every criterion in one transaction…",
  ]);
});
