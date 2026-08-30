import assert from "node:assert/strict";
import test from "node:test";

import type {EIP1193Provider} from "viem";

import {chooseMetaMaskProvider} from "../src/wallet-provider";

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
