import assert from "node:assert/strict";
import test from "node:test";

import {buildDemoBriefs} from "../src/demo-data";
import {
  activityCopy,
  awaitingSignature,
  canChangeDataMode,
  policyAcceptsException,
  requiresSelectionAcknowledgement,
  transactionFailed,
  transactionFinalized,
  transactionSubmitted,
  walletRole,
} from "../src/release-state";
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
