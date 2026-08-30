import type {EIP1193Provider} from "viem";

import type {WalletState} from "./types";

type ProviderMetadata = {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: unknown[];
};

export type AnnouncedWalletProvider = {
  info?: {
    name?: string;
    rdns?: string;
  };
  provider: EIP1193Provider;
};

type WalletWindow = Window & {
  ethereum?: EIP1193Provider & ProviderMetadata;
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

function isMetaMask(provider: EIP1193Provider): boolean {
  const flags = metadata(provider);
  return flags.isMetaMask === true && flags.isPhantom !== true;
}

export function chooseMetaMaskProvider(
  announced: AnnouncedWalletProvider[],
  injected?: EIP1193Provider & ProviderMetadata,
): EIP1193Provider | undefined {
  const exactAnnouncement = announced.find(({info, provider}) =>
    info?.rdns?.toLowerCase() === "io.metamask" && metadata(provider).isPhantom !== true,
  );
  if (exactAnnouncement) return exactAnnouncement.provider;

  const announcedMetaMask = announced.find(({provider}) => isMetaMask(provider));
  if (announcedMetaMask) return announcedMetaMask.provider;

  const injectedProviders = Array.isArray(injected?.providers)
    ? injected.providers.filter(isEip1193Provider)
    : [];
  const injectedMetaMask = injectedProviders.find(isMetaMask);
  if (injectedMetaMask) return injectedMetaMask;

  return injected && isMetaMask(injected) ? injected : undefined;
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

export async function requireMetaMaskProvider(): Promise<EIP1193Provider> {
  const walletWindow = window as WalletWindow;
  const announced: AnnouncedWalletProvider[] = [];
  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== "object") return;
    const candidate = detail as {info?: unknown; provider?: unknown};
    if (!isEip1193Provider(candidate.provider)) return;
    const info = candidate.info && typeof candidate.info === "object"
      ? candidate.info as {name?: string; rdns?: string}
      : undefined;
    announced.push({info, provider: candidate.provider});
  };

  walletWindow.addEventListener("eip6963:announceProvider", onAnnouncement as EventListener);
  walletWindow.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => walletWindow.setTimeout(resolve, 250));
  walletWindow.removeEventListener("eip6963:announceProvider", onAnnouncement as EventListener);

  const provider = chooseMetaMaskProvider(announced, walletWindow.ethereum);
  if (!provider) {
    throw new Error("Install or enable MetaMask to use StudioNet. AuditMatch does not connect through Phantom.");
  }
  return provider;
}
