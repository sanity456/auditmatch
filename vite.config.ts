import {defineConfig} from "vite";
import type {Plugin} from "vite";
import react from "@vitejs/plugin-react";
import {sites} from "@openai/sites-vite-plugin";
import {mkdir, readdir, rename} from "node:fs/promises";
import {resolve} from "node:path";

const cloudflareSpaWorker = (): Plugin => ({
  name: "auditmatch-cloudflare-spa-worker",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "server/index.js",
      source: `export default {
  async fetch(request, env) {
    if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Static asset binding unavailable", {status: 500});
    }

    let response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false;

    if (response.status === 404 && request.method === "GET" && acceptsHtml) {
      const shellUrl = new URL(request.url);
      shellUrl.pathname = "/index.html";
      response = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));
    }

    return response;
  },
};
`,
    });
  },
  async closeBundle() {
    const distDirectory = resolve("dist");
    const clientDirectory = resolve(distDirectory, "client");
    await mkdir(clientDirectory, {recursive: true});

    for (const entry of await readdir(distDirectory)) {
      if (entry === "client" || entry === "server" || entry === ".openai") continue;
      await rename(resolve(distDirectory, entry), resolve(clientDirectory, entry));
    }
  },
});

export default defineConfig({
  plugins: [react(), sites(), cloudflareSpaWorker()],
  server: {
    host: "127.0.0.1",
    port: 5175,
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
});
