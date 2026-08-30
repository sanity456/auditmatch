import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";

import {createAccount, createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {TransactionStatus} from "genlayer-js/types";

import {
  assertSuccessfulStudioExecution,
  getStudioLeaderReceipt,
  readStudioContract,
} from "./studio-runtime.mjs";

// Opt-in real-network smoke test. It submits exactly one zero-value transaction.
// The generated private key stays in memory and is never written to the report.
const root = new URL("../", import.meta.url);
const deployment = JSON.parse(await readFile(new URL("deployments/studionet.json", root), "utf8"));
const reader = createClient({chain: studionet});
const account = createAccount();
const runId = `ATOMIC-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8).toUpperCase()}`;
const briefId = `${account.address.toLowerCase()}:${runId}`;
const criteria = [
  {
    key: "ATOMIC_COUNT",
    text: "The brief and all required criteria are committed through exactly one contract transaction.",
    required: true,
  },
  {
    key: "ORDER_PRESERVED",
    text: "The frozen criterion order returned by the contract matches the submitted JSON order.",
    required: true,
  },
  {
    key: "NO_PAYMENT",
    text: "The test transaction carries zero value and creates no payment or procurement relationship.",
    required: true,
  },
  {
    key: "TEST_ONLY",
    text: "The permanent record is explicitly limited to AuditMatch release verification on StudioNet.",
    required: true,
  },
];

const provider = {
  async request({method, params = []}) {
    if (method === "eth_chainId") return `0x${studionet.id.toString(16)}`;
    if (method === "eth_accounts" || method === "eth_requestAccounts") return [account.address];
    assert.equal(method, "eth_sendTransaction", "Unexpected wallet operation");
    const tx = params[0];
    assert.equal(tx.from.toLowerCase(), account.address.toLowerCase());
    assert.equal(Number(BigInt(tx.chainId)), studionet.id);
    assert.equal(tx.to.toLowerCase(), studionet.consensusMainContract.address.toLowerCase());
    assert.equal(BigInt(tx.value ?? 0), 0n, "Atomic smoke test must not transfer value");
    const serializedTransaction = await account.signTransaction({
      chainId: studionet.id,
      to: tx.to,
      data: tx.data,
      nonce: Number(BigInt(tx.nonce)),
      gas: BigInt(tx.gas),
      gasPrice: BigInt(tx.gasPrice ?? 0),
      value: 0n,
      type: "legacy",
    });
    return reader.sendRawTransaction({serializedTransaction});
  },
};

const wallet = createClient({chain: studionet, account: account.address, provider});
const hash = await wallet.writeContract({
  address: deployment.contractAddress,
  functionName: "create_brief_with_criteria",
  args: [
    runId,
    `E2E TEST ONLY - AuditMatch ${runId.slice(-8)}`,
    "E2E TEST ONLY - atomic publication verification",
    "This non-production exercise verifies that one StudioNet transaction creates an open brief and freezes every submitted criterion.",
    "No payment, token transfer, procurement, identity claim, auditor qualification, or real engagement is created by this test record.",
    14n * 86_400n,
    JSON.stringify(criteria),
  ],
  value: 0n,
  leaderOnly: false,
});

const receipt = await wallet.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.FINALIZED,
  interval: 4_000,
  retries: 90,
});
assertSuccessfulStudioExecution(receipt, `atomic publish (${hash})`);
const leader = getStudioLeaderReceipt(receipt);
assert.equal(leader?.execution_result, "SUCCESS");
assert.equal(receipt.leader_only, false);
const agreeCount = Object.values(receipt.consensus_data?.votes ?? {})
  .filter((vote) => String(vote).toLowerCase() === "agree").length;
assert.ok(agreeCount >= 2, "Expected independent validator agreement");

const brief = await readStudioContract(reader, deployment.contractAddress, "get_brief", [briefId]);
assert.equal(brief.state, "OPEN");
assert.equal(Number(brief.criterion_count), criteria.length);
const storedCriteria = [];
for (let index = 0; index < criteria.length; index += 1) {
  storedCriteria.push(await readStudioContract(
    reader,
    deployment.contractAddress,
    "get_criterion",
    [briefId, BigInt(index)],
  ));
}
assert.deepEqual(storedCriteria.map((criterion) => criterion.criterion_key), criteria.map((criterion) => criterion.key));
assert.ok(storedCriteria.every((criterion) => criterion.required === true));

const report = {
  runId,
  verifiedAt: new Date().toISOString(),
  network: "studionet",
  chainId: studionet.id,
  contractAddress: deployment.contractAddress,
  transactionHash: hash,
  status: "FINALIZED",
  executionResult: leader.execution_result,
  leaderOnly: receipt.leader_only,
  agreeCount,
  transferValue: "0",
  privateKeyPersisted: false,
  briefId,
  briefState: brief.state,
  criterionCount: Number(brief.criterion_count),
  criterionKeys: storedCriteria.map((criterion) => criterion.criterion_key),
};
await mkdir(new URL("test-results/studionet/", root), {recursive: true});
await writeFile(
  new URL(`test-results/studionet/${runId}.json`, root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
