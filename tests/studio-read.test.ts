import assert from "node:assert/strict";
import {test} from "node:test";
import {abi} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import type {CalldataEncodable} from "genlayer-js/types";
import {fromRlp, hexToBytes, toHex, zeroAddress, type Hex} from "viem";

import {readStudioContract, type StudioReadRequest} from "../src/studio-read";

const address = "0x6C651233ef4c6fC5476cC18Aa80cEEAD33b84D95";
const applicationId = "0x5f257ab9cd0d6e733569f362573fb6080c78010f:E2E-20260828191118-ABF16227:APP:0xf874514cd9b1a29bad6c28dee719c856e69a91c1";
const policyJson = JSON.stringify({
  accepted_verdicts: ["STRONG_MATCH"], minimum_confidence_bps: 8500,
  minimum_signals: 2, maximum_age_seconds: 2592000, require_latest: true,
});
const encoded = (value: CalldataEncodable) => toHex(abi.calldata.encode(value));

function stub(response: unknown) {
  const requests: StudioReadRequest[] = [];
  return {
    requests,
    client: {
      chain: studionet,
      async request(request: StudioReadRequest): Promise<unknown> {
        requests.push(request);
        return response;
      },
    },
  };
}

// Reproduce Studio's fixed-two-byte RLP header removal, not a mocked contract.
// The old SDK encoding must fail for the exact two payloads observed live.
function studioParser(data: Hex): CalldataEncodable {
  let bytes = hexToBytes(data);
  if (bytes.at(-1) === 0) {
    bytes = bytes.slice(0, -1);
    if (bytes[0] >= 0xf8) bytes = bytes.slice(2);
    else if (bytes[0] >= 0xc0) bytes = bytes.slice(1);
    const decoded = fromRlp(bytes, "bytes");
    assert.ok(decoded instanceof Uint8Array);
    bytes = decoded;
  }
  return abi.calldata.decode(bytes);
}

for (const assessmentId of [applicationId + ":ASSESS:1", ""]) {
  test("large policy call survives Studio parser: " + (assessmentId ? "explicit" : "latest"), async () => {
    const args = [applicationId, policyJson, assessmentId];
    const calldata = abi.calldata.encode(abi.calldata.makeCalldataObject("evaluate_policy_view", args, undefined));
    const oldPayload = abi.transactions.serialize([calldata, false]);
    assert.ok(hexToBytes(oldPayload).length > 255);
    assert.equal(oldPayload.slice(0, 4), "0xf9");
    assert.throws(() => studioParser(oldPayload));

    let calls = 0;
    const result = await readStudioContract({
      chain: studionet,
      async request(request) {
        calls += 1;
        assert.equal(request.method, "gen_call");
        const params = request.params[0];
        assert.equal(params.type, "read");
        assert.equal(params.to, address);
        assert.equal(params.from, zeroAddress);
        assert.equal(params.transaction_hash_variant, "latest-final");
        assert.equal(params.data, toHex(calldata));
        assert.deepEqual(studioParser(params.data), new Map([
          ["args", args], ["method", "evaluate_policy_view"],
        ] as [string, CalldataEncodable][]));
        return encoded({satisfied: true, failure_reasons: [], assessment_id: assessmentId});
      },
    }, address, "evaluate_policy_view", args);
    assert.equal(calls, 1);
    assert.deepEqual(result, {satisfied: true, failure_reasons: [], assessment_id: assessmentId});
  });
}

test("short no-argument reads also use finalized, read-only raw calldata", async () => {
  const {client, requests} = stub(encoded(2n));
  assert.equal(await readStudioContract(client, address, "get_brief_count"), 2n);
  assert.equal(requests.length, 1);
  assert.deepEqual(studioParser(requests[0].params[0].data), new Map([["method", "get_brief_count"]]));
  assert.equal(requests[0].params[0].transaction_hash_variant, "latest-final");
});

for (const prefixed of [true, false]) {
  test("decodes string responses, hex prefix: " + prefixed, async () => {
    const data = encoded({satisfied: false, failure_reasons: ["APPLICATION_NOT_FOUND"]});
    const {client} = stub(prefixed ? data : data.slice(2));
    assert.deepEqual(await readStudioContract(client, address, "get_protocol"), {
      satisfied: false, failure_reasons: ["APPLICATION_NOT_FOUND"],
    });
  });

  test("decodes successful response envelopes, hex prefix: " + prefixed, async () => {
    const data = encoded("ok");
    const {client} = stub({status: {code: 0, message: "SUCCESS"}, data: prefixed ? data : data.slice(2)});
    assert.equal(await readStudioContract(client, address, "get_protocol"), "ok");
  });
}

test("accepts a data envelope without an optional status field", async () => {
  const {client} = stub({data: encoded(false)});
  assert.equal(await readStudioContract(client, address, "get_protocol"), false);
});

test("rejects failed or malformed statuses even when data looks successful", async () => {
  for (const status of [{code: 1, message: "contract reverted"}, {code: "0"}, {}, null, "SUCCESS"]) {
    const {client} = stub({status, data: encoded({satisfied: true})});
    await assert.rejects(readStudioContract(client, address, "get_protocol"), /gen_call failed/);
  }
});

test("rejects an RPC error envelope even when data looks successful", async () => {
  const {client} = stub({error: {code: -32000}, data: encoded(true)});
  await assert.rejects(readStudioContract(client, address, "get_protocol"), /RPC error/);
});

test("malformed encoded responses fail closed", async () => {
  for (const response of [null, undefined, [], {}, "", "0x", "0x0", "0xzz", "123", {data: 42}]) {
    const {client} = stub(response);
    await assert.rejects(readStudioContract(client, address, "get_protocol"), /invalid encoded data/);
  }
  const {client} = stub(encoded(true) + "ff");
  await assert.rejects(readStudioContract(client, address, "get_protocol"));
});

test("nested maps normalize without rounding large positive or negative integers", async () => {
  const huge = 2n ** 100n;
  const value = {small: 2n, huge, negative: -huge, items: [{value: huge}], empty: null};
  const {client} = stub(encoded(value));
  assert.deepEqual(await readStudioContract(client, address, "get_protocol"), value);
});

test("transport errors propagate without a fallback or resubmission", async () => {
  const error = new Error("rate limited");
  let calls = 0;
  const client = {chain: studionet, async request() {calls += 1; throw error;}};
  await assert.rejects(readStudioContract(client, address, "get_protocol"), (cause) => cause === error);
  assert.equal(calls, 1);
});

test("does not apply StudioNet compatibility to another chain", async () => {
  for (const chain of [undefined, {id: 1, isStudio: false}, {id: 61999, isStudio: false}]) {
    const {client, requests} = stub(encoded(true));
    await assert.rejects(readStudioContract({...client, chain}, address, "get_protocol"), /StudioNet chain/);
    assert.equal(requests.length, 0);
  }
});

test("rejects invalid destinations or methods before contacting the RPC", async () => {
  const {client, requests} = stub(encoded(true));
  await assert.rejects(readStudioContract(client, "0x123", "get_protocol"), /Invalid contract address/);
  for (const method of ["", "get_protocol\u0000", "bad method"]) {
    await assert.rejects(readStudioContract(client, address, method), /Invalid contract method/);
  }
  assert.equal(requests.length, 0);
});
