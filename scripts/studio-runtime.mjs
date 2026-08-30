import {fileURLToPath} from "node:url";
import {build} from "esbuild";

// Compile the actual app helpers for Node, rather than copying their behavior
// into the live/deployment test harnesses. No Node TypeScript loader is required.
const root = new URL("../", import.meta.url);
const output = new URL("node_modules/.cache/auditmatch/studio-runtime/", root);
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ["src/read-queue.ts", "src/studio-read.ts", "src/transaction.ts"],
  outdir: fileURLToPath(output),
  outExtension: {".js": ".mjs"},
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "silent",
});

export const {readStudioContract} = await import(new URL("studio-read.mjs", output));
export const {assertSuccessfulStudioExecution, getStudioLeaderReceipt} =
  await import(new URL("transaction.mjs", output));
export const {createPacedReader, describeReadError} =
  await import(new URL("read-queue.mjs", output));
