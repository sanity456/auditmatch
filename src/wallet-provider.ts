import type {EIP1193Provider} from "viem";

import type {WalletState} from "./types";

type ProviderMetadata = {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  providers?: unknown[];
  ethereum?: unknown;
};

export type AnnouncedWalletProvider = {
  info?: {
    uuid?: string;
    name?: string;
    rdns?: string;
  };
  provider: EIP1193Provider;
};

export type WalletProviderOption = {
  id: string;
  name: string;
  rdns: string;
  badge: string;
  provider: EIP1193Provider;
};

export type InjectedWalletSources = {
  ethereum?: EIP1193Provider & ProviderMetadata;
  phantom?: {ethereum?: EIP1193Provider & ProviderMetadata};
  okxwallet?: (EIP1193Provider & ProviderMetadata) | {ethereum?: EIP1193Provider & ProviderMetadata};
};

type ProviderListener = (value: unknown) => void;

type EventedProvider = EIP1193Provider & {
  on?: (event: "accountsChanged" | "chainChanged", listener: ProviderListener) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: ProviderListener) => void;
};

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function isEip1193Provider(value: unknown): value is EIP1193Provider {
  return Boolean(value && typeof value === "object" && typeof (value as {request?: unknown}).request === "function");
}

function metadata(provider: EIP1193Provider): ProviderMetadata {
  return provider as EIP1193Provider & ProviderMetadata;
}

function inferredWallet(provider: EIP1193Provider): {name: string; rdns: string; badge: string; rank: number} {
  const flags = metadata(provider);
  if (flags.isPhantom === true) {
    return {name: "Phantom (EVM)", rdns: "app.phantom", badge: "P", rank: 2};
  }
  if (flags.isOkxWallet === true || flags.isOKExWallet === true) {
    return {name: "OKX Wallet", rdns: "com.okex.wallet", badge: "OKX", rank: 1};
  }
  if (flags.isMetaMask === true) {
    return {name: "MetaMask", rdns: "io.metamask", badge: "M", rank: 0};
  }
  return {name: "Browser EVM wallet", rdns: "injected.evm", badge: "EVM", rank: 3};
}

function walletIdentity(
  provider: EIP1193Provider,
  info?: AnnouncedWalletProvider["info"],
  fallback?: Partial<Pick<WalletProviderOption, "name" | "rdns" | "badge">>,
): Omit<WalletProviderOption, "id" | "provider"> & {rank: number} {
  const inferred = inferredWallet(provider);
  const rdns = info?.rdns?.trim() || fallback?.rdns || inferred.rdns;
  const rdnsLower = rdns.toLowerCase();
  const known = rdnsLower === "io.metamask"
    ? {name: "MetaMask", badge: "M", rank: 0}
    : /okx|okex/.test(rdnsLower)
      ? {name: "OKX Wallet", badge: "OKX", rank: 1}
      : /phantom/.test(rdnsLower)
        ? {name: "Phantom (EVM)", badge: "P", rank: 2}
        : {name: fallback?.name || info?.name?.trim() || inferred.name, badge: fallback?.badge || inferred.badge, rank: inferred.rank};
  return {name: known.name, rdns, badge: known.badge, rank: known.rank};
}

export function collectWalletProviders(
  announced: AnnouncedWalletProvider[],
  injected: InjectedWalletSources = {},
): WalletProviderOption[] {
  const seen = new Set<EIP1193Provider>();
  const ids = new Set<string>();
  const options: Array<WalletProviderOption & {rank: number}> = [];

  const add = (
    candidate: unknown,
    info?: AnnouncedWalletProvider["info"],
    fallback?: Partial<Pick<WalletProviderOption, "name" | "rdns" | "badge">>,
  ) => {
    if (!isEip1193Provider(candidate) || seen.has(candidate)) return;
    seen.add(candidate);
    const identity = walletIdentity(candidate, info, fallback);
    const baseId = info?.uuid?.trim() || identity.rdns || `wallet-${options.length + 1}`;
    let id = baseId;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    ids.add(id);
    options.push({...identity, id, provider: candidate});
  };

  for (const item of announced) add(item.provider, item.info);

  const injectedProviders = Array.isArray(injected.ethereum?.providers)
    ? injected.ethereum.providers
    : [];
  if (injectedProviders.length > 0) {
    for (const provider of injectedProviders) add(provider);
  } else {
    add(injected.ethereum);
  }

  const okx = isEip1193Provider(injected.okxwallet)
    ? injected.okxwallet
    : injected.okxwallet?.ethereum;
  add(okx, undefined, {name: "OKX Wallet", rdns: "com.okex.wallet", badge: "OKX"});
  add(injected.phantom?.ethereum, undefined, {name: "Phantom (EVM)", rdns: "app.phantom", badge: "P"});

  return options
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name))
    .map(({rank: _rank, ...option}) => option);
}

export async function discoverWalletProviders(waitMs = 400): Promise<WalletProviderOption[]> {
  const walletWindow = window as Window & InjectedWalletSources;
  const announced: AnnouncedWalletProvider[] = [];
  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== "object") return;
    const candidate = detail as {info?: unknown; provider?: unknown};
    if (!isEip1193Provider(candidate.provider)) return;
    const info = candidate.info && typeof candidate.info === "object"
      ? candidate.info as AnnouncedWalletProvider["info"]
      : undefined;
    announced.push({info, provider: candidate.provider});
  };

  walletWindow.addEventListener("eip6963:announceProvider", onAnnouncement as EventListener);
  walletWindow.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => walletWindow.setTimeout(resolve, waitMs));
  walletWindow.removeEventListener("eip6963:announceProvider", onAnnouncement as EventListener);

  return collectWalletProviders(announced, {
    ethereum: walletWindow.ethereum,
    phantom: walletWindow.phantom,
    okxwallet: walletWindow.okxwallet,
  });
}

export function walletFromAccounts(value: unknown): WalletState | undefined {
  const account = Array.isArray(value) ? value[0] : undefined;
  return typeof account === "string" && ADDRESS_PATTERN.test(account)
    ? {address: account as `0x${string}`}
    : undefined;
}

export function numericChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !/^(0x[0-9a-f]+|\d+)$/i.test(value)) return undefined;
  const parsed = Number.parseInt(value, value.toLowerCase().startsWith("0x") ? 16 : 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function watchWalletProvider(
  provider: EIP1193Provider,
  handlers: {
    onAccountsChanged: (wallet: WalletState | undefined) => void;
    onChainChanged: (chainId: number | undefined) => void;
  },
): () => void {
  const evented = provider as EventedProvider;
  if (typeof evented.on !== "function") return () => undefined;

  const accountsChanged: ProviderListener = (accounts) => {
    handlers.onAccountsChanged(walletFromAccounts(accounts));
  };
  const chainChanged: ProviderListener = (chainId) => {
    handlers.onChainChanged(numericChainId(chainId));
  };
  evented.on("accountsChanged", accountsChanged);
  evented.on("chainChanged", chainChanged);

  return () => {
    evented.removeListener?.("accountsChanged", accountsChanged);
    evented.removeListener?.("chainChanged", chainChanged);
  };
}
