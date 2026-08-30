import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {assertSuccessfulStudioExecution, getStudioLeaderReceipt, readStudioContract} from "./studio-runtime.mjs";

// Read-only: this script never signs or submits a transaction.
const root = new URL("../", import.meta.url);
const deployment = JSON.parse(await readFile(new URL("deployments/studionet.json", root), "utf8"));
const localSource = await readFile(new URL(deployment.sourceFile, root));
const localSchema = JSON.parse(await readFile(new URL("abi.json", root), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(sha256(localSource), deployment.sourceSha256, "Local source differs from the deployed release");
assert.equal(studionet.id, deployment.chainId, "Unexpected SDK chain configuration");
const client = createClient({chain: studionet});
assert.equal(await client.getChainId(), deployment.chainId, "RPC returned an unexpected chain ID");

const receipt = await client.getTransaction({hash: deployment.deploymentTransaction});
assert.equal(receipt.statusName ?? receipt.status_name, "FINALIZED", "Deployment is not finalized");
assertSuccessfulStudioExecution(receipt, "deployment");
const leader = getStudioLeaderReceipt(receipt);
assert.equal(leader?.execution_result, "SUCCESS", "Finalized deployment did not execute successfully");
const recipients = [receipt.to_address, receipt.recipient, receipt.data?.contract_address];
assert.ok(
  recipients.some((address) => typeof address === "string" && address.toLowerCase() === deployment.contractAddress.toLowerCase()),
  "Deployment receipt does not identify the expected contract",
);
assert.equal(
  (receipt.from_address ?? receipt.sender)?.toLowerCase(),
  deployment.deployer.toLowerCase(),
  "Unexpected deployer",
);
console.log("Deployment receipt: FINALIZED, execution SUCCESS");

const remoteSource = await client.getContractCode(deployment.contractAddress);
assert.equal(sha256(remoteSource), deployment.sourceSha256, "On-chain source does not match the local contract");
const schema = await client.getContractSchema(deployment.contractAddress);
assert.deepEqual(schema, localSchema, "On-chain schema differs from abi.json");
console.log(`On-chain source hash and all ${Object.keys(schema.methods).length} method signatures match the release`);

const read = (functionName, args = []) =>
  readStudioContract(client, deployment.contractAddress, functionName, args);
const protocol = await read("get_protocol");
assert.equal(protocol.schema, "auditmatch/protocol/v1");
assert.equal(Number(protocol.policy_version), deployment.constructorArgs[0]);
assert.equal(protocol.deterministic_policy_reads, true);
assert.equal(protocol.custodies_funds, false);

const counts = {};
for (const name of ["brief", "application", "assessment"]) {
  const count = Number(await read(`get_${name}_count`));
  assert.ok(Number.isSafeInteger(count) && count >= 0, `Invalid ${name} count`);
  counts[name] = count;
}
const policyResult = await read("evaluate_policy_view", [
  "deployment-read-check",
  JSON.stringify({
    accepted_verdicts: ["STRONG_MATCH"],
    minimum_confidence_bps: 8500,
    minimum_signals: 2,
    maximum_age_seconds: 2592000,
    require_latest: true,
  }),
  "",
]);
assert.equal(policyResult.satisfied, false);
assert.deepEqual(policyResult.failure_reasons, ["APPLICATION_NOT_FOUND"]);

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  network: deployment.network,
  chainId: deployment.chainId,
  contractAddress: deployment.contractAddress,
  transactionHash: deployment.deploymentTransaction,
  status: "FINALIZED",
  executionResult: leader.execution_result,
  sourceSha256: sha256(remoteSource),
  methodCount: Object.keys(schema.methods).length,
  protocolSchema: protocol.schema,
  counts,
  missingApplicationPolicy: policyResult,
  readOnly: true,
}, (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
