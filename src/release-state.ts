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
export type DataMode = "preview" | "live";
export type RegistrySource = "preview" | "verified-snapshot" | "live";

export type TransactionActivity = {
  action: string;
  status: "AWAITING_SIGNATURE" | "FINALIZING" | "FINALIZED" | "FAILED";
  hash?: string;
  error?: string;
};

export const STUDIONET_EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const STUDIONET_DEPLOYMENT_TRANSACTION =
  "0x9d2b0a398f37a96d859fb93e69907dab8111d82b26e6227231d6103c8ba8516b";

const ACTIVITY_COPY: Record<Exclude<AppActivity, "idle">, string> = {
  "loading-registry": "Loading the StudioNet registry…",
  "connecting-wallet": "Connecting your wallet to GenLayer StudioNet…",
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

export function canConnectWallet(activity: AppActivity): boolean {
  return activity === "idle" || activity === "loading-registry";
}

export function evidenceContextCopy(mode: DataMode): string {
  return mode === "live"
    ? "Fetched by validators at assessment"
    : "Illustrative public references · simulated result";
}

export function selectionContextCopy(
  mode: DataMode,
  exceptionPath = false,
): {title: string; detail: string} {
  if (mode === "preview") {
    return {
      title: "Selection simulated locally",
      detail: "This sample selection has no blockchain state.",
    };
  }
  if (exceptionPath) {
    return {
      title: "Exception-path release test recorded on-chain",
      detail: "An explicit test policy accepted an inconclusive assessment; this is plumbing evidence, not an auditor endorsement.",
    };
  }
  return {
    title: "Selection recorded on-chain",
    detail: "The selected wallet is bound to the cited assessment in finalized StudioNet state.",
  };
}

export function registryStatusCopy(source: RegistrySource): string {
  if (source === "live") return "Live registry verified in this session";
  if (source === "verified-snapshot") {
    return "Verified snapshot shown while finalized StudioNet state refreshes";
  }
  return "Simulated Preview data";
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
