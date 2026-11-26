import { createState, handleRequest, parseBody } from "../../packages/api/src/app.js";
import { handleFaucet } from "../../packages/api/src/faucet.js";
import { recordRequest } from "../../packages/api/src/telemetry.js";

// Cloudflare Pages Function for /api/*. It runs the same core as the Node
// server, with the state cached per isolate. No database, no key, no Railway.

let state = null;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}

function finish(context, request, path, started, status, body) {
  const error = body && typeof body === "object" && typeof body.error === "string" ? body.error : null;
  context.waitUntil(recordRequest(context.env, {
    path,
    method: request.method,
    status,
    ms: Date.now() - started,
    error,
    at: Date.now(),
  }));
  return json(body, status);
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const started = Date.now();

  let body = {};
  if (method === "POST") {
    const text = await request.text();
    if (text.length > 32_768) return finish(context, request, path, started, 400, { error: "bad_request" });
    try {
      body = parseBody(text);
    } catch {
      return finish(context, request, path, started, 400, { error: "bad_request" });
    }
  }

  if (path === "/v1/faucet" && method === "POST") {
    try {
      const result = await handleFaucet(env, body);
      return finish(context, request, path, started, result.status, result.body);
    } catch {
      return finish(context, request, path, started, 502, { error: "faucet_failed" });
    }
  }

  if (!state) {
    if (!env.CIRO_RPC_URL || !env.CIRO_ADDRESS) {
      return finish(context, request, path, started, 502, { error: "chain_unavailable" });
    }
    try {
      state = createState({
        rpcUrl: env.CIRO_RPC_URL,
        address: env.CIRO_ADDRESS,
        chainId: Number(env.CIRO_CHAIN_ID ?? "44005"),
        startBlock: BigInt(env.CIRO_START_BLOCK ?? "0"),
        explorerUrl: env.CIRO_EXPLORER_URL ?? "",
      });
    } catch {
      return finish(context, request, path, started, 502, { error: "chain_unavailable" });
    }
  }

  const result = await handleRequest(state, method, path, body, env);
  return finish(context, request, path, started, result.status, result.body);
}
