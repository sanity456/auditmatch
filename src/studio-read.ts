import {abi} from "genlayer-js";
import type {CalldataEncodable} from "genlayer-js/types";
import {hexToBytes, toHex, zeroAddress, type Address, type Hex} from "viem";

export type StudioReadRequest = {
  method: "gen_call";
  params: [{
    type: "read";
    to: Address;
    from: Address;
    data: Hex;
    transaction_hash_variant: "latest-final";
  }];
};

type StudioReadClient = {
  chain?: {id: number; isStudio?: boolean};
  request: (request: StudioReadRequest) => Promise<unknown>;
};

function resultBytes(result: unknown): Uint8Array {
  let data: unknown = result;
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    if ("error" in envelope && envelope.error != null) {
      throw new Error("StudioNet gen_call returned an RPC error");
    }
    if ("status" in envelope) {
      const status = envelope.status as {code?: unknown; message?: unknown} | null;
      if (!status || typeof status !== "object" || status.code !== 0) {
        const message = typeof status?.message === "string" ? status.message : "invalid response status";
        throw new Error(`StudioNet gen_call failed: ${message}`);
      }
    }
    data = envelope.data;
  }
  if (typeof data !== "string" || !/^(?:0x)?(?:[0-9a-fA-F]{2})+$/.test(data)) {
    throw new Error("StudioNet gen_call returned invalid encoded data");
  }
  return hexToBytes((data.startsWith("0x") ? data : `0x${data}`) as Hex);
}

function normalizeMaps(value: CalldataEncodable): unknown {
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([key, item]) => [key, normalizeMaps(item)]));
  }
  if (Array.isArray(value)) return value.map(normalizeMaps);
  // Preserve integers as bigint, including values outside JavaScript's safe range.
  return value;
}

/** Read finalized StudioNet state; this adapter never signs or submits a write. */
export async function readStudioContract(
  client: StudioReadClient,
  address: Address,
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<unknown> {
  if (client.chain?.id !== 61999 || client.chain.isStudio !== true) {
    throw new Error("The StudioNet read adapter requires the StudioNet chain configuration");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Invalid contract address");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(functionName)) throw new Error("Invalid contract method");

  // Studio's legacy parser strips a fixed-length RLP header, breaking calls over
  // 255 bytes. The same read endpoint accepts raw GenVM calldata without that
  // wrapper. Keep this workaround scoped to StudioNet; writes retain SDK encoding.
  // https://github.com/genlayerlabs/genlayer-studio/blob/main/backend/protocol_rpc/transactions_parser.py
  const calldata = abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args, undefined));
  const result = await client.request({
    method: "gen_call",
    params: [{
      type: "read",
      to: address,
      from: zeroAddress,
      data: toHex(calldata),
      transaction_hash_variant: "latest-final",
    }],
  });
  return normalizeMaps(abi.calldata.decode(resultBytes(result)));
}
