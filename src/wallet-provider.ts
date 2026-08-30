import type {EIP1193Provider} from "viem";

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
