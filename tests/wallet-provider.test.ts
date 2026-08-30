import assert from "node:assert/strict";
import test from "node:test";

import type {EIP1193Provider} from "viem";

import {
  chooseMetaMaskProvider,
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

test("an exact EIP-6963 MetaMask announcement wins over Phantom", () => {
  const phantom = provider({isPhantom: true});
  const metaMask = provider({isMetaMask: true});
  assert.equal(chooseMetaMaskProvider([
    {info: {name: "Phantom", rdns: "app.phantom"}, provider: phantom},
    {info: {name: "MetaMask", rdns: "io.metamask"}, provider: metaMask},
  ], phantom), metaMask);
});

test("a MetaMask entry in the injected provider list is selected", () => {
  const phantom = provider({isPhantom: true});
  const metaMask = provider({isMetaMask: true});
  const injected = provider({isPhantom: true, providers: [phantom, metaMask]});
  assert.equal(chooseMetaMaskProvider([], injected as EIP1193Provider & {providers: unknown[]}), metaMask);
});

test("Phantom is never accepted as the fallback provider", () => {
  const phantom = provider({isPhantom: true});
  assert.equal(chooseMetaMaskProvider([], phantom), undefined);
});

test("a provider claiming both MetaMask and Phantom is rejected", () => {
  const ambiguous = provider({isMetaMask: true, isPhantom: true});
  assert.equal(chooseMetaMaskProvider([], ambiguous), undefined);
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

test("MetaMask account changes update the app and listeners are removed", () => {
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
