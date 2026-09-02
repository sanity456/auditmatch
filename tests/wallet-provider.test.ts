import assert from "node:assert/strict";
import test from "node:test";

import type {EIP1193Provider} from "viem";

import {connectWallet} from "../src/genlayer";
import {
  collectWalletProviders,
  numericChainId,
  walletFromAccounts,
  watchWalletProvider,
} from "../src/wallet-provider";

function provider(flags: Record<string, unknown> = {}): EIP1193Provider {
  return {
    request: async () => undefined,
    ...flags,
  } as unknown as EIP1193Provider;
}

test("EIP-6963 discovers MetaMask, OKX, Phantom EVM, and other wallets", () => {
  const metaMask = provider({isMetaMask: true});
  const okx = provider({isOkxWallet: true});
  const phantom = provider({isPhantom: true});
  const rabby = provider();
  const options = collectWalletProviders([
    {info: {uuid: "phantom", name: "Phantom", rdns: "app.phantom"}, provider: phantom},
    {info: {uuid: "rabby", name: "Rabby Wallet", rdns: "io.rabby"}, provider: rabby},
    {info: {uuid: "okx", name: "OKX", rdns: "com.okex.wallet"}, provider: okx},
    {info: {uuid: "metamask", name: "MetaMask", rdns: "io.metamask"}, provider: metaMask},
  ]);

  assert.deepEqual(options.map(({id, name, rdns, badge}) => ({id, name, rdns, badge})), [
    {id: "metamask", name: "MetaMask", rdns: "io.metamask", badge: "M"},
    {id: "okx", name: "OKX Wallet", rdns: "com.okex.wallet", badge: "OKX"},
    {id: "phantom", name: "Phantom (EVM)", rdns: "app.phantom", badge: "P"},
    {id: "rabby", name: "Rabby Wallet", rdns: "io.rabby", badge: "EVM"},
  ]);
});

test("announced and legacy-injected copies of the same provider are deduplicated", () => {
  const metaMask = provider({isMetaMask: true});
  const phantom = provider({isPhantom: true});
  const options = collectWalletProviders(
    [{info: {uuid: "metamask", name: "MetaMask", rdns: "io.metamask"}, provider: metaMask}],
    {
      ethereum: provider({providers: [metaMask, phantom]}) as EIP1193Provider & {providers: unknown[]},
      phantom: {ethereum: phantom},
    },
  );

  assert.deepEqual(options.map(({name}) => name), ["MetaMask", "Phantom (EVM)"]);
});

test("direct OKX and Phantom namespaces work without window.ethereum", () => {
  const okx = provider();
  const phantom = provider({isPhantom: true});
  const options = collectWalletProviders([], {
    okxwallet: okx,
    phantom: {ethereum: phantom},
  });

  assert.deepEqual(options.map(({name}) => name), ["OKX Wallet", "Phantom (EVM)"]);
});

test("a generic EIP-1193 browser wallet remains usable", () => {
  const injected = provider();
  const options = collectWalletProviders([], {ethereum: injected});
  assert.equal(options.length, 1);
  assert.equal(options[0].name, "Browser EVM wallet");
  assert.equal(options[0].provider, injected);
});

test("a selected EIP-1193 wallet connects and switches to StudioNet", async () => {
  const calls: string[] = [];
  const selected = provider({
    request: async ({method}: {method: string}) => {
      calls.push(method);
      if (method === "eth_requestAccounts") {
        return ["0x3333333333333333333333333333333333333333"];
      }
      return undefined;
    },
  });

  assert.deepEqual(await connectWallet(selected), {
    address: "0x3333333333333333333333333333333333333333",
  });
  assert.deepEqual(calls, ["eth_requestAccounts", "wallet_switchEthereumChain"]);
});

test("a selected wallet can add StudioNet when the custom chain is unknown", async () => {
  const calls: string[] = [];
  const selected = provider({
    request: async ({method}: {method: string}) => {
      calls.push(method);
      if (method === "eth_requestAccounts") {
        return ["0x4444444444444444444444444444444444444444"];
      }
      if (method === "wallet_switchEthereumChain") {
        throw Object.assign(new Error("Unknown chain"), {code: 4902});
      }
      return undefined;
    },
  });

  await connectWallet(selected);
  assert.deepEqual(calls, [
    "eth_requestAccounts",
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
  ]);
});

test("account and chain payloads are normalized defensively", () => {
  assert.deepEqual(walletFromAccounts(["0x1111111111111111111111111111111111111111"]), {
    address: "0x1111111111111111111111111111111111111111",
  });
  assert.equal(walletFromAccounts([]), undefined);
  assert.equal(walletFromAccounts(["not-an-address"]), undefined);
  assert.equal(numericChainId("0xf22f"), 61_999);
  assert.equal(numericChainId("61999"), 61_999);
  assert.equal(numericChainId("wrong"), undefined);
});

test("wallet account changes update the app and listeners are removed", () => {
  const listeners = new Map<string, (value: unknown) => void>();
  const evented = provider({
    on: (event: string, listener: (value: unknown) => void) => listeners.set(event, listener),
    removeListener: (event: string) => listeners.delete(event),
  });
  const accounts: Array<string | undefined> = [];
  const chains: Array<number | undefined> = [];
  const unsubscribe = watchWalletProvider(evented, {
    onAccountsChanged: (wallet) => accounts.push(wallet?.address),
    onChainChanged: (chainId) => chains.push(chainId),
  });

  listeners.get("accountsChanged")?.(["0x2222222222222222222222222222222222222222"]);
  listeners.get("chainChanged")?.("0xf22f");
  assert.deepEqual(accounts, ["0x2222222222222222222222222222222222222222"]);
  assert.deepEqual(chains, [61_999]);

  unsubscribe();
  assert.equal(listeners.size, 0);
});
