export type ReadRetryEvent = {
  label: string;
  attempt: number;
  delayMs: number;
  reason: string;
};

export type PacedReaderOptions = {
  intervalMs?: number;
  operationTimeoutMs?: number;
  retryDelaysMs?: number[];
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
  onRetry?: (event: ReadRetryEvent) => void | Promise<void>;
};

export type PacedReader = <T>(operation: () => Promise<T>, label?: string) => Promise<T>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function describeReadError(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; current && depth < 6 && !seen.has(current); depth += 1) {
    seen.add(current);
    if (typeof current !== "object") {
      messages.push(String(current));
      break;
    }
    const item = current as Record<string, unknown>;
    for (const key of ["shortMessage", "message", "details", "code"]) {
      if (typeof item[key] === "string" || typeof item[key] === "number") {
        messages.push(String(item[key]));
      }
    }
    current = item.cause;
  }
  return [...new Set(messages)].join(" | ").slice(0, 4000);
}

function isTransient(error: unknown): boolean {
  return /rate.?limit|429|-32429|failed to fetch|fetch failed|network error|timed? out|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|HTTP 50[234]/i.test(
    describeReadError(error),
  );
}

/** For read-only RPC operations. Never wrap transaction submission in this. */
export function createPacedReader({
  intervalMs = 3000,
  operationTimeoutMs = 45000,
  retryDelaysMs = [15000, 30000, 45000],
  now = Date.now,
  wait = sleep,
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onRetry = () => {},
}: PacedReaderOptions = {}): PacedReader {
  let nextStart = 0;
  let queue: Promise<void> = Promise.resolve();

  return <T>(operation: () => Promise<T>, label = "read"): Promise<T> => {
    const result = queue.then(async () => {
      for (let attempt = 0; ; attempt += 1) {
        const remaining = nextStart - now();
        if (remaining > 0) await wait(remaining);
        nextStart = now() + intervalMs;
        try {
          let timer: unknown;
          try {
            return await Promise.race([
              Promise.resolve().then(operation),
              new Promise<never>((_, reject) => {
                timer = schedule(
                  () => reject(new Error(label + " read timed out after " + operationTimeoutMs + "ms")),
                  operationTimeoutMs,
                );
              }),
            ]);
          } finally {
            if (timer !== undefined) cancel(timer);
          }
        } catch (error) {
          if (!isTransient(error) || attempt >= retryDelaysMs.length) throw error;
          const delayMs = retryDelaysMs[attempt];
          await onRetry({
            label,
            attempt: attempt + 1,
            delayMs,
            reason: describeReadError(error),
          });
          await wait(delayMs);
        }
      }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
}
