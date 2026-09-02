import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {
  TransactionStatus,
  type CalldataEncodable,
  type Hash,
} from "genlayer-js/types";
import type {EIP1193Provider} from "viem";

import {AUDITMATCH_CONTRACT_ADDRESS, HAS_LIVE_DEPLOYMENT} from "./config";
import {policyToContractJson} from "./model";
import {createPacedReader} from "./read-queue";
import {readStudioContract} from "./studio-read";
import {assertSuccessfulStudioExecution} from "./transaction";
import {
  walletFromAccounts,
  watchWalletProvider,
} from "./wallet-provider";
import type {
  Application,
  Assessment,
  Brief,
  Criterion,
  Policy,
  PolicyResult,
  WalletState,
} from "./types";

export const STUDIONET_CHAIN_ID = 61_999;
const STUDIONET_CHAIN_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}` as `0x${string}`;
const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
const STUDIONET_EXPLORER_URL = "https://explorer-studio.genlayer.com";

type UnknownRecord = Record<string, unknown>;

const pacedRead = createPacedReader({intervalMs: 2250});
let activeWalletProvider: EIP1193Provider | undefined;

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} did not return an object`);
  }
  return value as UnknownRecord;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

async function read(functionName: string, args: CalldataEncodable[] = []): Promise<unknown> {
  if (!HAS_LIVE_DEPLOYMENT) throw new Error("AuditMatch has not been deployed to StudioNet");
  const client = createClient({chain: studionet});
  return pacedRead(
    () => readStudioContract(client, AUDITMATCH_CONTRACT_ADDRESS, functionName, args),
    functionName,
  );
}

function errorCode(cause: unknown): number | undefined {
  if (!cause || typeof cause !== "object") return undefined;
  const candidate = cause as {code?: unknown; cause?: unknown};
  if (typeof candidate.code === "number") return candidate.code;
  return errorCode(candidate.cause);
}

export async function connectWallet(provider: EIP1193Provider): Promise<WalletState> {
  const accounts = await provider.request({method: "eth_requestAccounts"});
  const wallet = walletFromAccounts(accounts);
  if (!wallet) {
    throw new Error("The wallet did not return a valid account");
  }
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{chainId: STUDIONET_CHAIN_HEX}],
    });
  } catch (cause) {
    if (errorCode(cause) !== 4902 && !/unknown chain|unrecognized chain/i.test(String(cause))) {
      throw cause;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: STUDIONET_CHAIN_HEX,
          chainName: "GenLayer StudioNet",
          nativeCurrency: {name: "GEN", symbol: "GEN", decimals: 18},
          rpcUrls: [STUDIONET_RPC_URL],
          blockExplorerUrls: [STUDIONET_EXPLORER_URL],
        },
      ],
    });
  }
  activeWalletProvider = provider;
  return wallet;
}

export function subscribeActiveWallet(handlers: {
  onAccountsChanged: (wallet: WalletState | undefined) => void;
  onChainChanged: (chainId: number | undefined) => void;
}): () => void {
  return activeWalletProvider
    ? watchWalletProvider(activeWalletProvider, handlers)
    : () => undefined;
}

async function write(
  wallet: WalletState,
  functionName: string,
  args: CalldataEncodable[],
  onSubmitted?: (hash: Hash, action: string) => void,
): Promise<Hash> {
  if (!HAS_LIVE_DEPLOYMENT) throw new Error("AuditMatch has not been deployed to StudioNet");
  const provider = activeWalletProvider;
  if (!provider) throw new Error("Reconnect your EVM wallet before submitting a StudioNet transaction");
  const client = createClient({
    chain: studionet,
    account: wallet.address,
    provider,
  });
  const hash = await client.writeContract({
    address: AUDITMATCH_CONTRACT_ADDRESS,
    functionName,
    args,
    value: 0n,
  });
  onSubmitted?.(hash, functionName);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 4_000,
    retries: 90,
  });
  assertSuccessfulStudioExecution(receipt, `${functionName} (${hash})`);
  return hash;
}

function parseAssessment(value: unknown): Assessment {
  const item = record(value, "assessment");
  return {
    id: text(item.assessment_id),
    verdict: enumValue(
      item.verdict,
      ["STRONG_MATCH", "POTENTIAL_MATCH", "NO_MATCH", "INDETERMINATE"] as const,
      "INDETERMINATE",
    ),
    status: enumValue(
      item.status,
      ["ACTIVE", "CONTESTED", "SUPERSEDED", "UNKNOWN"] as const,
      "UNKNOWN",
    ),
    confidenceBps: numberValue(item.confidence_bps),
    signalCount: numberValue(item.independent_signal_count),
    criterionCodes: text(item.criterion_codes),
    reasonCodes: stringArray(item.reason_codes),
    evidenceUrls: stringArray(item.evidence_urls),
    issuedAtUnix: numberValue(item.issued_at_unix),
    expiresAtUnix: numberValue(item.expires_at_unix),
  };
}

async function loadApplication(applicationId: string): Promise<Application> {
  const item = record(await read("get_application", [applicationId]), "application");
  const assessmentId = text(item.latest_assessment_id);
  return {
    id: applicationId,
    briefId: text(item.brief_id),
    auditorWallet: text(item.auditor_wallet),
    auditorName: text(item.auditor_name),
    profileSummary: text(item.profile_summary),
    conflictDisclosure: text(item.conflict_disclosure),
    evidenceUrls: stringArray(item.evidence_sources),
    state: enumValue(
      item.state,
      ["EVIDENCE_SUBMITTED", "ASSESSED", "CONTESTED", "SELECTED"] as const,
      "EVIDENCE_SUBMITTED",
    ),
    assessment: assessmentId
      ? parseAssessment(await read("get_assessment", [assessmentId]))
      : undefined,
  };
}

export async function loadRegistry(limit = 20): Promise<Brief[]> {
  if (!HAS_LIVE_DEPLOYMENT) return [];
  const count = Math.min(numberValue(await read("get_brief_count")), limit);
  const briefs: Brief[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const id = text(await read("get_brief_id", [BigInt(index)]));
    const item = record(await read("get_brief", [id]), "brief");
    const criterionCount = numberValue(item.criterion_count);
    const criteria: Criterion[] = [];
    for (let criterionIndex = 0; criterionIndex < criterionCount; criterionIndex += 1) {
      const criterion = record(
        await read("get_criterion", [id, BigInt(criterionIndex)]),
        "criterion",
      );
      criteria.push({
        key: text(criterion.criterion_key),
        text: text(criterion.text),
        required: criterion.required === true,
      });
    }

    const applicationCount = numberValue(item.application_count);
    const applications: Application[] = [];
    for (let appIndex = 0; appIndex < applicationCount; appIndex += 1) {
      const applicationId = text(
        await read("get_brief_application_id", [id, BigInt(appIndex)]),
      );
      applications.push(await loadApplication(applicationId));
    }

    briefs.push({
      id,
      key: text(item.brief_key),
      projectOwner: text(item.project_owner),
      projectName: text(item.project_name),
      title: text(item.scope_title),
      auditScope: text(item.audit_scope),
      engagementTerms: text(item.engagement_terms),
      state: enumValue(item.state, ["DRAFT", "OPEN", "MATCHED"] as const, "DRAFT"),
      validityDays: Math.max(1, Math.round(numberValue(item.validity_seconds) / 86_400)),
      criteria,
      applications,
      selectedApplicationId: text(item.selected_application_id),
      selectedAssessmentId: text(item.selected_assessment_id),
      selectedAuditorWallet: text(item.selected_auditor_wallet),
    });
  }
  return briefs;
}

export type NewBriefInput = {
  key: string;
  projectName: string;
  title: string;
  auditScope: string;
  engagementTerms: string;
  validityDays: number;
  criteria: Criterion[];
};

type BriefWriter = (
  wallet: WalletState,
  functionName: string,
  args: CalldataEncodable[],
  onSubmitted?: (hash: Hash, action: string) => void,
) => Promise<Hash>;

export async function createBriefLive(
  wallet: WalletState,
  input: NewBriefInput,
  onProgress: (message: string) => void,
  onSubmitted?: (hash: Hash, action: string) => void,
  submit: BriefWriter = write,
): Promise<{briefId: string; hash: Hash}> {
  const key = input.key.trim().toUpperCase();
  const criteriaJson = JSON.stringify(input.criteria.map((criterion) => ({
    key: criterion.key,
    text: criterion.text,
    required: criterion.required,
  })));
  onProgress("Publishing the brief and freezing every criterion in one transaction…");
  const hash = await submit(wallet, "create_brief_with_criteria", [
    key,
    input.projectName,
    input.title,
    input.auditScope,
    input.engagementTerms,
    BigInt(input.validityDays * 86_400),
    criteriaJson,
  ], onSubmitted);
  return {briefId: `${wallet.address.toLowerCase()}:${key}`, hash};
}

export async function submitApplicationLive(
  wallet: WalletState,
  briefId: string,
  input: {
    auditorName: string;
    profileSummary: string;
    conflictDisclosure: string;
    evidenceUrls: string[];
  },
  onSubmitted?: (hash: Hash, action: string) => void,
): Promise<Hash> {
  return write(
    wallet,
    "submit_application",
    [
      briefId,
      input.auditorName,
      input.profileSummary,
      input.conflictDisclosure,
      JSON.stringify(input.evidenceUrls),
    ],
    onSubmitted,
  );
}

export async function assessApplicationLive(
  wallet: WalletState,
  applicationId: string,
  onSubmitted?: (hash: Hash, action: string) => void,
): Promise<Hash> {
  return write(wallet, "assess_application", [applicationId], onSubmitted);
}

export async function recheckApplicationLive(
  wallet: WalletState,
  applicationId: string,
  onSubmitted?: (hash: Hash, action: string) => void,
): Promise<Hash> {
  return write(wallet, "recheck_application", [applicationId], onSubmitted);
}

export async function evaluatePolicyLive(
  applicationId: string,
  policy: Policy,
  assessmentId: string,
): Promise<PolicyResult> {
  const value = record(
    await read("evaluate_policy_view", [
      applicationId,
      policyToContractJson(policy),
      assessmentId,
    ]),
    "policy result",
  );
  return {
    satisfied: value.satisfied === true,
    failureReasons: stringArray(value.failure_reasons),
    assessmentId: text(value.assessment_id),
    verdict: enumValue(
      value.verdict,
      ["STRONG_MATCH", "POTENTIAL_MATCH", "NO_MATCH", "INDETERMINATE", ""] as const,
      "",
    ),
  };
}

export async function selectAuditorLive(
  wallet: WalletState,
  applicationId: string,
  policy: Policy,
  assessmentId: string,
  onSubmitted?: (hash: Hash, action: string) => void,
): Promise<Hash> {
  return write(
    wallet,
    "select_auditor",
    [applicationId, policyToContractJson(policy), assessmentId],
    onSubmitted,
  );
}
