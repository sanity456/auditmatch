const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const configuredAddress =
  import.meta.env.VITE_AUDITMATCH_CONTRACT_ADDRESS?.trim() || ZERO_ADDRESS;

if (!ADDRESS_PATTERN.test(configuredAddress)) {
  throw new Error("VITE_AUDITMATCH_CONTRACT_ADDRESS is not a valid address");
}

export const AUDITMATCH_CONTRACT_ADDRESS = configuredAddress as `0x${string}`;
export const HAS_LIVE_DEPLOYMENT = configuredAddress.toLowerCase() !== ZERO_ADDRESS;
