import type {Brief, Policy, Verdict, WalletState} from "./types";

export type AppActivity =
  | "idle"
  | "loading-registry"
  | "connecting-wallet"
  | "publishing-brief"
  | "submitting-application"
  | "assessing"
  | "rechecking"
  | "evaluating-policy"
  | "recording-selection";

export type WalletRole = "Project owner" | "Applicant" | "Connected wallet";

export type TransactionActivity = {
  action: string;
  status: "AWAITING_SIGNATURE" | "FINALIZING" | "FINALIZED" | "FAILED";
  hash?: string;
  error?: string;
};

export const STUDIONET_EXPLORER_URL = "https://explorer-studio.genlayer.com";

const ACTIVITY_COPY: Record<Exclude<AppActivity, "idle">, string> = {
  "loading-registry": "Loading the StudioNet registry…",
  "connecting-wallet": "Connecting MetaMask to GenLayer StudioNet…",
  "publishing-brief": "Publishing the brief and frozen criteria…",
  "submitting-application": "Submitting the wallet-bound evidence application…",
  assessing: "Waiting for validator consensus and finality…",
  rechecking: "Refetching evidence and issuing a fresh assessment…",
  "evaluating-policy": "Running the deterministic policy read…",
  "recording-selection": "Recording the project owner’s selection…",
};

export function activityCopy(activity: AppActivity): string {
  return activity === "idle" ? "" : ACTIVITY_COPY[activity];
}

export function canChangeDataMode(activity: AppActivity): boolean {
  return activity === "idle" || activity === "loading-registry";
}

export function walletRole(wallet: WalletState | undefined, brief: Brief | undefined): WalletRole {
  if (!wallet || !brief) return "Connected wallet";
  const address = wallet.address.toLowerCase();
  if (brief.projectOwner.toLowerCase() === address) return "Project owner";
  if (brief.applications.some((application) => application.auditorWallet.toLowerCase() === address)) {
    return "Applicant";
  }
  return "Connected wallet";
}

export function policyAcceptsException(policy: Policy): boolean {
  return policy.acceptedVerdicts.includes("INDETERMINATE")
    || policy.acceptedVerdicts.includes("NO_MATCH");
}

export function requiresSelectionAcknowledgement(
  verdict: Verdict | undefined,
  policy: Policy,
): boolean {
  return Boolean(
    verdict
    && (verdict === "INDETERMINATE" || verdict === "NO_MATCH")
    && policy.acceptedVerdicts.includes(verdict),
  );
}

export function awaitingSignature(action: string): TransactionActivity {
  return {action, status: "AWAITING_SIGNATURE"};
}

export function transactionSubmitted(
  current: TransactionActivity | undefined,
  hash: string,
): TransactionActivity {
  return {
    action: current?.action ?? "StudioNet transaction",
    status: "FINALIZING",
    hash,
  };
}

export function transactionFinalized(
  current: TransactionActivity | undefined,
  hash: string,
): TransactionActivity {
  return {
    action: current?.action ?? "StudioNet transaction",
    status: "FINALIZED",
    hash,
  };
}

export function transactionFailed(
  current: TransactionActivity | undefined,
  error: string,
): TransactionActivity {
  if (current?.status === "FINALIZED") return current;
  return {
    action: current?.action ?? "StudioNet transaction",
    status: "FAILED",
    hash: current?.hash,
    error,
  };
}
