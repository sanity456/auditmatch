import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

import {createAccount, createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {
  assertSuccessfulStudioExecution,
  createPacedReader,
  describeReadError,
  getStudioLeaderReceipt,
  readStudioContract,
} from "./studio-runtime.mjs";

// This is an opt-in, real-network test. It never uses mocked web/model responses.
// Test keys live only in memory. No existing account, tokens, or user key is used.
const root = new URL("../", import.meta.url);
const deployment = JSON.parse(await readFile(new URL("deployments/studionet.json", root), "utf8"));
const reader = createClient({chain: studionet});
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evidence = [
  "https://raw.githubusercontent.com/crytic/slither/master/README.md",
  "https://docs.soliditylang.org/en/latest/_sources/security-considerations.rst.txt",
];
const counterSource = "https://raw.githubusercontent.com/crytic/slither/master/docs/src/tools/README.md";
const validity = 30 * 86400;
const policy = {
  accepted_verdicts: ["STRONG_MATCH"],
  minimum_confidence_bps: 8500,
  minimum_signals: 2,
  maximum_age_seconds: validity,
  require_latest: true,
};
const strictPolicy = {...policy, minimum_confidence_bps: 10000};
const runId = `E2E-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8).toUpperCase()}`;
const reportUrl = new URL(`test-results/studionet/${runId}.json`, root);
const report = {
  runId,
  startedAt: new Date().toISOString(),
  status: "PREFLIGHT",
  network: "studionet",
  chainId: studionet.id,
  contractAddress: deployment.contractAddress,
  sourceSha256: deployment.sourceSha256,
  mockResponses: false,
  transactionContextOverrides: false,
  privateKeysPersisted: false,
  scope: "TEST ONLY: public-reference submission, not auditor identity or skill certification; no real procurement",
  walletSigning: "Ephemeral EIP-1193-compatible test provider; browser extension signing is not exercised",
  integrationAdapter: "Shared app helpers: src/studio-read.ts and src/transaction.ts",
  readPacingMs: 3000,
  readTimeoutMs: 45000,
  readRetryDelaysMs: [15000, 30000, 45000],
  readRetries: [],
  sources: [],
  steps: [],
  readChecks: [],
  assessments: [],
};

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function checkpoint() {
  // gltest clears .artifacts before local tests, so retain live reports elsewhere.
  await mkdir(new URL("test-results/studionet/", root), {recursive: true});
  await writeFile(reportUrl, json(report) + "\n");
}

const retryRead = createPacedReader({
  onRetry: async (event) => {
    report.readRetries.push({...event, observedAt: new Date().toISOString()});
    log("Retrying read only: " + event.label + " after " + event.delayMs / 1000 + "s; " + event.reason);
    await checkpoint();
  },
});

// Exercise the SDK's address + provider path, also used by src/genlayer.ts.
// The provider refuses non-StudioNet, non-consensus, or value-bearing requests.
function testWallet(account) {
  const provider = {
    async request({method, params = []}) {
      if (method === "eth_chainId") return `0x${studionet.id.toString(16)}`;
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [account.address];
      assert.equal(method, "eth_sendTransaction", "Unexpected test-wallet operation");
      const tx = params[0];
      assert.equal(tx.from.toLowerCase(), account.address.toLowerCase());
      assert.equal(Number(BigInt(tx.chainId)), 61999);
      assert.equal(tx.to.toLowerCase(), studionet.consensusMainContract.address.toLowerCase());
      assert.equal(BigInt(tx.value ?? 0), 0n, "This test must not transfer tokens");
      const serializedTransaction = await account.signTransaction({
        chainId: 61999,
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
  return createClient({chain: studionet, account: account.address, provider});
}

async function read(functionName, args = []) {
  return retryRead(
    () => readStudioContract(reader, deployment.contractAddress, functionName, args),
    functionName,
  );
}

async function check(name, run) {
  await run();
  report.readChecks.push({name, status: "PASS", checkedAt: new Date().toISOString()});
  log(`PASS: ${name}`);
  await checkpoint();
}

async function waitFinal(hash, label) {
  let lastStatus = "";
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const receipt = await retryRead(() => reader.getTransaction({hash}), label + " receipt");
    const status = receipt.statusName ?? receipt.status_name ?? String(receipt.status);
    if (status !== lastStatus || attempt % 6 === 0) {
      log(`${label}: ${status}`);
      lastStatus = status;
    }
    if (status === "FINALIZED") return receipt;
    if (["UNDETERMINED", "CANCELED", "CANCELLED"].includes(status)) {
      throw new Error(`${label} ended in ${status}: ${hash}`);
    }
    await delay(10000);
  }
  throw new Error(`${label} did not finalize within 12 minutes: ${hash}`);
}

async function write(wallet, label, functionName, args, expectedError = "") {
  log(`Submitting ${label}`);
  // Never automatically resubmit a write after an uncertain RPC result.
  const hash = await wallet.writeContract({
    address: deployment.contractAddress,
    functionName,
    args,
    value: 0n,
    leaderOnly: false,
  });
  const step = {label, functionName, hash, expectedError, submittedAt: new Date().toISOString(), status: "SUBMITTED"};
  report.steps.push(step);
  await checkpoint();
  log(`${label}: submitted ${hash}`);
  const receipt = await waitFinal(hash, label);
  const leader = getStudioLeaderReceipt(receipt);
  const diagnostic = {result: leader?.result, error: leader?.error, genvmError: leader?.genvm_result?.error};
  Object.assign(step, {
    status: "FINALIZED",
    executionResult: leader?.execution_result ?? "MISSING",
    executionMode: receipt.execution_mode,
    leaderOnly: receipt.leader_only,
    votes: receipt.consensus_data?.votes ?? {},
    leaderReceiptEntries: Array.isArray(receipt.consensus_data?.leader_receipt) ? receipt.consensus_data.leader_receipt.length : 1,
    diagnostic,
    finalizedAt: new Date().toISOString(),
  });
  await checkpoint();
  assert.equal(receipt.leader_only, false, "The network must run full consensus");
  assert.ok(leader, "Expected an identifiable leader receipt");
  if (expectedError) {
    assert.throws(() => assertSuccessfulStudioExecution(receipt, label), /execution was not successful/);
    assert.notEqual(leader?.execution_result, "SUCCESS", `${label} unexpectedly succeeded`);
    assert.ok(json(diagnostic).includes(expectedError), `${label}: expected ${expectedError}, got ${json(diagnostic)}`);
  } else {
    assertSuccessfulStudioExecution(receipt, label);
    assert.equal(leader?.execution_result, "SUCCESS", `${label}: ${json(diagnostic)}`);
  }
  if (["assess_application", "recheck_application", "resolve_contest"].includes(functionName)) {
    const agreeCount = Object.values(step.votes).filter((vote) => String(vote).toLowerCase() === "agree").length;
    assert.ok(agreeCount >= 2, "Expected multiple agreeing validators, not a leader-only result");
    step.agreeCount = agreeCount;
    step.equivalenceOutputs = leader?.eq_outputs;
  }
  step.testResult = "PASS";
  log(`PASS: ${label}${expectedError ? ` (rejected: ${expectedError})` : ""}`);
  await checkpoint();
  return receipt;
}

async function preflight() {
  assert.equal(studionet.id, 61999);
  assert.equal(await retryRead(() => reader.getChainId(), "chain ID"), 61999);
  const source = await readFile(new URL(deployment.sourceFile, root));
  assert.equal(sha256(source), deployment.sourceSha256);
  assert.equal(sha256(await retryRead(() => reader.getContractCode(deployment.contractAddress), "contract source")), deployment.sourceSha256);
  assert.deepEqual(
    await retryRead(() => reader.getContractSchema(deployment.contractAddress), "contract schema"),
    JSON.parse(await readFile(new URL("abi.json", root), "utf8")),
  );
  const probeId = "0x" + "0".repeat(40) + ":E2E-PREFLIGHT:APP:0x" + "0".repeat(40);
  const probe = await read("evaluate_policy_view", [probeId, JSON.stringify(policy), probeId + ":ASSESS:1"]);
  assert.equal(probe.satisfied, false);
  assert.deepEqual(probe.failure_reasons, ["APPLICATION_NOT_FOUND"]);
  report.integrationSourceSha256 = Object.fromEntries(await Promise.all(
    ["src/studio-read.ts", "src/transaction.ts", "src/genlayer.ts"].map(async (file) =>
      [file, sha256(await readFile(new URL(file, root)))],
    ),
  ));
  for (const url of [...evidence, counterSource]) {
    const response = await fetch(url, {signal: AbortSignal.timeout(25000)});
    assert.equal(response.status, 200, `Preflight source unavailable: ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 0 && bytes.length <= 100000, `Source outside contract size limits: ${url}`);
    const prefix = bytes.toString("utf8").slice(0, 12000);
    if (url === evidence[0]) assert.ok(prefix.includes("Solidity") && prefix.includes("vulnerability detectors"));
    if (url === evidence[1]) assert.ok(prefix.includes("Reentrancy") && prefix.includes("Checks-Effects-Interactions"));
    report.sources.push({url, bytes: bytes.length, fullBodySha256: sha256(bytes), assessedPrefixSha256: sha256(prefix)});
  }
  log("PASS: live deployment and public-source preflight (no mocks)");
}

async function main() {
  await preflight();
  if (!process.argv.includes("--execute")) {
    log("Read-only preflight passed. Use npm run test:live -- --execute to create permanent TEST ONLY records on StudioNet.");
    return;
  }
  const ownerAccount = createAccount();
  const auditorAccount = createAccount();
  const owner = testWallet(ownerAccount);
  const auditor = testWallet(auditorAccount);
  const ownerAddress = ownerAccount.address.toLowerCase();
  const auditorAddress = auditorAccount.address.toLowerCase();
  const briefId = `${ownerAddress}:${runId}`;
  const applicationId = `${briefId}:APP:${auditorAddress}`;
  const assessmentId = (version) => `${applicationId}:ASSESS:${version}`;
  report.status = "RUNNING";
  Object.assign(report, {ownerAddress, auditorAddress, briefId, applicationId});
  await checkpoint();
  log(`Starting ${runId}; report: ${fileURLToPath(reportUrl)}`);

  const applicationArgs = [
    briefId,
    "E2E TEST ONLY - Reference Candidate",
    "An isolated automated test candidate submits third-party public documentation for a reference-review exercise. It does not claim authorship, auditor expertise, completed audits, or affiliation with the source authors.",
    "TEST ONLY: both role wallets are controlled by this test harness. No independent real-world auditor identity, business relationship, or actual audit engagement is asserted.",
    JSON.stringify(evidence),
  ];
  await write(owner, "Create test brief", "create_brief", [
    runId,
    `E2E TEST ONLY - AuditMatch ${runId.slice(-8)}`,
    "E2E TEST ONLY - public security reference review",
    "Non-production integration exercise: evaluate whether an applicant supplies the requested public security reference material. This brief tests source retrieval and policy plumbing; it is not a real audit, auditor qualification, or identity certification.",
    "No payment, token transfer, procurement, or real engagement. The frozen criteria assess the contents of submitted public references only. Candidate authorship, expertise, independence, availability, and past audit outcomes are not claimed or required by this test brief.",
    BigInt(validity),
  ]);
  await write(owner, "Add static-analysis reference criterion", "add_criterion", [
    briefId, "STATIC_REFERENCE",
    "The submitted reference set includes public documentation explicitly describing Slither as a Solidity static-analysis framework with vulnerability detectors. This criterion concerns the submitted material, not candidate authorship or experience.", true,
  ]);
  await write(owner, "Add reentrancy reference criterion", "add_criterion", [
    briefId, "REENTRANCY_REFERENCE",
    "The submitted reference set includes official Solidity security documentation that explains reentrancy risk and the Checks-Effects-Interactions pattern. This criterion concerns the submitted material, not candidate authorship or experience.", true,
  ]);
  await write(auditor, "Reject non-owner criterion change", "add_criterion", [briefId, "UNAUTHORIZED", "This criterion must not be added by a non-owner wallet.", true], "only_project_owner");
  await write(owner, "Open test brief", "open_brief", [briefId]);
  await write(owner, "Reject changes to frozen criteria", "add_criterion", [briefId, "LOCKED", "This criterion must not be added after the brief is open.", true], "criteria_locked");
  await write(owner, "Reject project self-application", "submit_application", applicationArgs, "project_cannot_self_apply");
  await write(auditor, "Submit test candidate with live evidence", "submit_application", applicationArgs);
  await write(auditor, "Reject duplicate application", "submit_application", applicationArgs, "auditor_already_applied");
  await check("Only the authorized criteria and one application were stored", async () => {
    const brief = await read("get_brief", [briefId]);
    assert.equal(Number(brief.criterion_count), 2);
    assert.equal(Number(brief.application_count), 1);
    assert.equal(brief.state, "OPEN");
    const application = await read("get_application", [applicationId]);
    assert.equal(application.auditor_wallet, auditorAddress);
    assert.deepEqual(application.evidence_sources, evidence);
  });

  await write(owner, "Assess actual public evidence", "assess_application", [applicationId]);
  await check("Live assessment and deterministic policy pass", async () => {
    const assessment = await read("get_assessment", [assessmentId(1)]);
    report.assessments.push(assessment);
    await checkpoint();
    assert.equal(assessment.criterion_codes, "MM");
    assert.equal(assessment.verdict, "STRONG_MATCH");
    assert.equal(Number(assessment.confidence_bps), 9000);
    assert.equal(Number(assessment.independent_signal_count), 2);
    assert.equal(Number(assessment.expires_at_unix) - Number(assessment.issued_at_unix), validity);
    assert.deepEqual(assessment.evidence_urls, evidence);
    assert.equal((await read("evaluate_policy_view", [applicationId, JSON.stringify(policy), assessmentId(1)])).satisfied, true);
    const rejected = await read("evaluate_policy_view", [applicationId, JSON.stringify(strictPolicy), assessmentId(1)]);
    assert.equal(rejected.satisfied, false);
    assert.deepEqual(rejected.failure_reasons, ["CONFIDENCE_BELOW_POLICY"]);
  });
  await write(auditor, "Reject auditor self-selection", "select_auditor", [applicationId, JSON.stringify(policy), assessmentId(1)], "only_project_owner");
  await write(owner, "Reject selection failing the policy", "select_auditor", [applicationId, JSON.stringify(strictPolicy), assessmentId(1)], "selection_policy_not_satisfied");
  await write(owner, "Recheck actual public evidence", "recheck_application", [applicationId]);
  await check("Recheck supersedes old evidence without deleting history", async () => {
    const previous = await read("get_assessment", [assessmentId(1)]);
    assert.equal(previous.status, "SUPERSEDED");
    assert.equal(previous.criterion_codes, report.assessments[0].criterion_codes);
    const latest = await read("get_assessment", [assessmentId(2)]);
    report.assessments.push(latest);
    await checkpoint();
    assert.equal(latest.status, "ACTIVE");
    assert.equal(latest.appeal_of, assessmentId(1));
    assert.equal(latest.criterion_codes, "MM");
    const stale = await read("evaluate_policy_view", [applicationId, JSON.stringify(policy), assessmentId(1)]);
    assert.ok(stale.failure_reasons.includes("ASSESSMENT_NOT_ACTIVE"));
    assert.ok(stale.failure_reasons.includes("ASSESSMENT_NOT_LATEST"));
  });

  await write(auditor, "Open test-only evidence contest", "contest_assessment", [
    assessmentId(2),
    "TEST ONLY: re-evaluate whether the Slither tools overview changes support for the frozen reference-material requirements. This is a test of the contest workflow, not an allegation about any real auditor or source author.",
    JSON.stringify([counterSource]),
  ]);
  const contestId = `${assessmentId(2)}:CONTEST`;
  await check("Contested assessment fails closed", async () => {
    assert.equal((await read("get_contest", [contestId])).state, "OPEN");
    const result = await read("evaluate_policy_view", [applicationId, JSON.stringify(policy), assessmentId(2)]);
    assert.equal(result.satisfied, false);
    assert.ok(result.failure_reasons.includes("ASSESSMENT_NOT_ACTIVE"));
  });
  await write(owner, "Reject selection while contested", "select_auditor", [applicationId, JSON.stringify(policy), assessmentId(2)], "selection_policy_not_satisfied");
  await write(owner, "Resolve contest with live counter-evidence", "resolve_contest", [contestId]);
  await check("Resolved contest preserves history and cites added evidence", async () => {
    const contest = await read("get_contest", [contestId]);
    assert.equal(contest.state, "RESOLVED");
    assert.equal(contest.replacement_assessment_id, assessmentId(3));
    assert.equal((await read("get_assessment", [assessmentId(2)])).status, "SUPERSEDED");
    const latest = await read("get_assessment", [assessmentId(3)]);
    report.assessments.push(latest);
    await checkpoint();
    assert.equal(latest.status, "ACTIVE");
    assert.equal(latest.appeal_of, assessmentId(2));
    assert.equal(latest.criterion_codes, "MM");
    assert.deepEqual(latest.evidence_urls, [...evidence, counterSource]);
    assert.equal(Number(latest.independent_signal_count), 2, "Count domains, not URL quantity");
    assert.equal((await read("evaluate_policy_view", [applicationId, JSON.stringify(policy), assessmentId(3)])).satisfied, true);
  });
  await write(owner, "Project selects policy-approved candidate", "select_auditor", [applicationId, JSON.stringify(policy), assessmentId(3)]);
  await check("Selection is confirmed and bound to the latest assessment", async () => {
    const brief = await read("get_brief", [briefId]);
    const application = await read("get_application", [applicationId]);
    const selection = await read("get_selection", [brief.selection_id]);
    assert.equal(brief.state, "MATCHED");
    assert.equal(brief.selected_auditor_wallet, auditorAddress);
    assert.equal(brief.selected_assessment_id, assessmentId(3));
    assert.equal(application.state, "SELECTED");
    assert.equal(selection.state, "CONFIRMED");
    assert.equal(selection.assessment_id, assessmentId(3));
    assert.equal(selection.project_owner, ownerAddress);
    report.finalState = {brief, application, selection};
  });
  await write(owner, "Reject second selection on a matched brief", "select_auditor", [applicationId, JSON.stringify(policy), assessmentId(3)], "brief_not_open");
  report.status = "PASS";
  report.completedAt = new Date().toISOString();
  report.transactionChecksPassed = report.steps.filter((step) => step.testResult === "PASS").length;
  report.readChecksPassed = report.readChecks.length;
  await checkpoint();
  log(`PASS: ${report.transactionChecksPassed} transaction checks, ${report.readChecksPassed} read/state checks. Report: ${fileURLToPath(reportUrl)}`);
}

try {
  await main();
} catch (error) {
  report.status = "FAIL";
  report.failedAt = new Date().toISOString();
  report.error = {name: error?.name, message: describeReadError(error)};
  await checkpoint();
  log(`FAIL: ${report.error.message}`);
  log(`Report: ${fileURLToPath(reportUrl)}`);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1000);
}
