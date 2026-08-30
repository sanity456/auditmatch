import assert from "node:assert/strict";
import {test} from "node:test";
import {createPacedReader, describeReadError} from "../scripts/studio-runtime.mjs";

function clock() {
  let time = 0;
  const waits = [];
  return {now: () => time, wait: async (ms) => {waits.push(ms); time += ms;}, waits};
}

test("read starts are paced below the observed 30-per-minute limit", async () => {
  const timer = clock();
  const read = createPacedReader(timer);
  const starts = [];
  for (let index = 0; index < 10; index += 1) {
    await read(async () => {starts.push(timer.now()); return index;});
  }
  assert.deepEqual(starts, Array.from({length: 10}, (_, index) => index * 3000));
});

test("wrapped rate-limit errors receive a bounded read-only retry", async () => {
  const timer = clock();
  const retries = [];
  const read = createPacedReader({...timer, onRetry: (retry) => retries.push(retry)});
  let attempts = 0;
  const value = await read(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("Unknown RPC error", {cause: {code: -32429, message: "Rate limit exceeded: 30 requests per minute"}});
    }
    return "ok";
  }, "get_assessment");
  assert.equal(value, "ok");
  assert.equal(attempts, 2);
  assert.equal(retries[0].delayMs, 15000);
  assert.equal(retries[0].label, "get_assessment");
  assert.equal(timer.now(), 15000);
});

test("a temporary transport failure can recover without changing the operation", async () => {
  const timer = clock();
  const read = createPacedReader(timer);
  let attempts = 0;
  assert.equal(await read(async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("Failed to fetch");
    return 9000n;
  }), 9000n);
  assert.equal(attempts, 2);
});

test("contract and encoding failures are not retried", async () => {
  for (const message of ["contract reverted: missing assessment", "RLP string ends with 383 superfluous bytes"]) {
    const timer = clock();
    const read = createPacedReader(timer);
    let attempts = 0;
    await assert.rejects(read(async () => {attempts += 1; throw new Error(message);}));
    assert.equal(attempts, 1);
    assert.deepEqual(timer.waits, []);
  }
});

test("persistent read failures stop after four total attempts", async () => {
  const timer = clock();
  const read = createPacedReader(timer);
  let attempts = 0;
  await assert.rejects(read(async () => {
    attempts += 1;
    throw new Error("Rate limit exceeded");
  }), /Rate limit/);
  assert.equal(attempts, 4);
  assert.deepEqual(timer.waits, [15000, 30000, 45000]);
});

test("concurrent callers serialize and a failed read does not poison the queue", async () => {
  const timer = clock();
  const read = createPacedReader(timer);
  const starts = [];
  const operations = [0, 1, 2].map((index) => read(async () => {
    starts.push(timer.now());
    if (index === 1) throw new Error("contract reverted");
    return index;
  }));
  const results = await Promise.allSettled(operations);
  assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "fulfilled"]);
  assert.deepEqual(starts, [0, 3000, 6000]);
});

test("diagnostics include nested error details without recursing forever", () => {
  const error = {message: "Unknown RPC error", details: "Rate limit exceeded", code: -32429};
  error.cause = error;
  assert.match(describeReadError(error), /Rate limit exceeded/);
  assert.match(describeReadError(error), /-32429/);
});

test("a stalled read is bounded by the operation timeout", async () => {
  const timer = clock();
  const scheduled = [];
  const read = createPacedReader({
    ...timer,
    retryDelaysMs: [],
    operationTimeoutMs: 45000,
    schedule(callback, ms) {
      scheduled.push(ms);
      queueMicrotask(callback);
      return scheduled.length;
    },
    cancel() {},
  });
  await assert.rejects(read(() => new Promise(() => {}), "receipt"), /timed out after 45000ms/);
  assert.deepEqual(scheduled, [45000]);
});
