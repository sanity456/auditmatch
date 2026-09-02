import assert from "node:assert/strict";
import test from "node:test";

import {buildDemoBriefs} from "../src/demo-data";
import {
  activityCopy,
  awaitingSignature,
  canChangeDataMode,
  canConnectWallet,
  evidenceContextCopy,
  policyAcceptsException,
  registryStatusCopy,
  requiresSelectionAcknowledgement,
  selectionContextCopy,
  transactionFailed,
  transactionFinalized,
  transactionSubmitted,
  walletRole,
} from "../src/release-state";
import {buildVerifiedStudioNetSnapshot} from "../src/studionet-snapshot";
import type {Policy, WalletState} from "../src/types";

const brief = buildDemoBriefs(1_800_000_000)[0];
const wallet = (address: string): WalletState => ({address: address as `0x${string}`});
const strictPolicy: Policy = {
  acceptedVerdicts: ["STRONG_MATCH"],
  minimumConfidenceBps: 8500,
  minimumSignals: 2,
  maximumAgeSeconds: 30 * 86_400,
  requireLatest: true,
};

test("wallet roles follow the selected brief", () => {
  assert.equal(walletRole(wallet(brief.projectOwner), brief), "Project owner");
  assert.equal(walletRole(wallet(brief.applications[0].auditorWallet), brief), "Applicant");
  assert.equal(walletRole(wallet("0x1111111111111111111111111111111111111111"), brief), "Connected wallet");
});

test("exception selections require explicit acknowledgement", () => {
  const exceptionPolicy: Policy = {...strictPolicy, acceptedVerdicts: ["STRONG_MATCH", "INDETERMINATE"]};
  assert.equal(policyAcceptsException(strictPolicy), false);
  assert.equal(policyAcceptsException(exceptionPolicy), true);
  assert.equal(requiresSelectionAcknowledgement("STRONG_MATCH", exceptionPolicy), false);
  assert.equal(requiresSelectionAcknowledgement("INDETERMINATE", exceptionPolicy), true);
  assert.equal(requiresSelectionAcknowledgement("INDETERMINATE", strictPolicy), false);
});

test("transaction status keeps the hash through finality and failure", () => {
  const waiting = awaitingSignature("Evidence assessment");
  const hash = `0x${"a".repeat(64)}`;
  const finalizing = transactionSubmitted(waiting, hash);
  const finalized = transactionFinalized(finalizing, hash);
  assert.deepEqual(finalized, {
    action: "Evidence assessment",
    status: "FINALIZED",
    hash,
  });
  assert.equal(transactionFailed(finalized, "late read failure"), finalized);
  assert.deepEqual(transactionFailed(finalizing, "wallet rejected"), {
    action: "Evidence assessment",
    status: "FAILED",
    hash,
    error: "wallet rejected",
  });
});

test("operation copy names the actual background work", () => {
  assert.equal(activityCopy("loading-registry"), "Loading the StudioNet registry…");
  assert.equal(activityCopy("publishing-brief"), "Publishing the brief and frozen criteria…");
  assert.equal(activityCopy("evaluating-policy"), "Running the deterministic policy read…");
});

test("data mode remains switchable while the live registry loads", () => {
  assert.equal(canChangeDataMode("idle"), true);
  assert.equal(canChangeDataMode("loading-registry"), true);
  assert.equal(canChangeDataMode("publishing-brief"), false);
  assert.equal(canChangeDataMode("assessing"), false);
});

test("wallet discovery remains available while the live registry loads", () => {
  assert.equal(canConnectWallet("idle"), true);
  assert.equal(canConnectWallet("loading-registry"), true);
  assert.equal(canConnectWallet("publishing-brief"), false);
  assert.equal(canConnectWallet("assessing"), false);
});

test("Preview and StudioNet evidence labels describe their actual data path", () => {
  assert.equal(evidenceContextCopy("preview"), "Illustrative public references · simulated result");
  assert.equal(evidenceContextCopy("live"), "Fetched by validators at assessment");
  assert.match(registryStatusCopy("verified-snapshot"), /snapshot/i);
  assert.match(registryStatusCopy("live"), /live registry verified/i);
});

test("selection labels distinguish local simulation and the live exception path", () => {
  assert.equal(selectionContextCopy("preview").title, "Selection simulated locally");
  assert.equal(selectionContextCopy("live").title, "Selection recorded on-chain");
  const exception = selectionContextCopy("live", true);
  assert.match(exception.title, /exception-path/i);
  assert.match(exception.detail, /not an auditor endorsement/i);
});

test("the bundled StudioNet snapshot matches the finalized release journey and is cloned", () => {
  const first = buildVerifiedStudioNetSnapshot();
  const second = buildVerifiedStudioNetSnapshot();
  const journey = first.find((item) => item.key === "VAULT-Q4");
  assert.equal(first.length, 2);
  assert.equal(journey?.state, "MATCHED");
  assert.equal(journey?.applications[0]?.state, "SELECTED");
  assert.equal(journey?.applications[0]?.assessment?.verdict, "INDETERMINATE");
  assert.equal(journey?.applications[0]?.assessment?.confidenceBps, 6000);
  assert.equal(journey?.applications[0]?.assessment?.criterionCodes, "UUUU");
  assert.notEqual(first, second);
  assert.notEqual(first[0].applications, second[0].applications);
});
