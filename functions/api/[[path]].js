import { createState, handleRequest, parseBody } from "../../packages/api/src/app.js";

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

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";

  let body = {};
  if (method === "POST") {
    const text = await request.text();
    if (text.length > 32_768) return json({ error: "bad_request" }, 400);
    try {
      body = parseBody(text);
    } catch {
      return json({ error: "bad_request" }, 400);
    }
  }

  if (!state) {
    if (!env.CIRO_RPC_URL || !env.CIRO_ADDRESS) return json({ error: "chain_unavailable" }, 502);
    try {
      state = createState({
        rpcUrl: env.CIRO_RPC_URL,
        address: env.CIRO_ADDRESS,
        chainId: Number(env.CIRO_CHAIN_ID ?? "44005"),
        startBlock: BigInt(env.CIRO_START_BLOCK ?? "0"),
        explorerUrl: env.CIRO_EXPLORER_URL ?? "",
      });
    } catch {
      return json({ error: "chain_unavailable" }, 502);
    }
  }

  const result = await handleRequest(state, method, path, body);
  return json(result.body, result.status);
}
