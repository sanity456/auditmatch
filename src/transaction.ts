type LeaderReceipt = {mode: "leader"; execution_result?: unknown; [key: string]: unknown};
type StudioReceipt = {
  consensus_data?: {leader_receipt?: unknown};
};

export function getStudioLeaderReceipt(receipt: unknown): LeaderReceipt | undefined {
  const leaders = (receipt as StudioReceipt | null)?.consensus_data?.leader_receipt;
  const entries: unknown[] = Array.isArray(leaders) ? leaders : leaders ? [leaders] : [];
  // StudioNet can append idle validator results after the successful leader.
  // Neither a validator success nor a validator failure replaces that proposal.
  return entries.filter((entry): entry is LeaderReceipt =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry)
    && (entry as {mode?: unknown}).mode === "leader",
  ).at(-1);
}

export function assertSuccessfulStudioExecution(receipt: unknown, action: string): void {
  const latest = getStudioLeaderReceipt(receipt);
  if (latest?.execution_result !== "SUCCESS") {
    const result = typeof latest?.execution_result === "string"
      ? latest.execution_result
      : "UNKNOWN";
    throw new Error(
      `${action} finalized, but execution was not successful (${result}). Check the transaction before retrying.`,
    );
  }
}
