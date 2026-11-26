import { apiUrl } from "./session.js";

async function requestOnce(method, path, body, timeout) {
  let response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw Object.assign(new Error("The Ciro API is not reachable."), { code: "offline" });
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(sentence(json.error));
    error.code = json.error || "request_failed";
    error.body = json;
    throw error;
  }
  return json;
}

export async function api(method, path, body) {
  // The Aevum testnet RPC and explorer can be slow. A read gets one retry on a
  // network error. Preparing an unsigned transaction is also safe to retry
  // because it has no on-chain effect; the faucet and payment broadcasts do
  // not retry. The faucet's own per-address history still prevents a double
  // send if a response is lost.
  const timeout = path === "/v1/faucet" ? 60_000 : 20_000;
  const safeToRetry = method === "GET" || path.startsWith("/v1/tx/") || path === "/v1/names/check";
  const delays = [600, 1500];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce(method, path, body, timeout);
    } catch (err) {
      if (!safeToRetry || err.code !== "offline" || attempt >= delays.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

export function sentence(code) {
  const copy = {
    offline: "The Ciro API is not reachable.",
    empty_name: "Enter a name with a letter or a number.",
    bad_amount: "Enter an amount like 100 or 100.50.",
    bad_due: "Enter a due date.",
    past_due: "That time has already passed.",
    name_mismatch: "That name does not match this invoice.",
    already_paid: "This invoice is already paid.",
    unknown_invoice: "That invoice does not exist.",
    not_paid: "This invoice is not paid yet.",
    chain_unavailable: "The chain did not answer.",
    chain_mismatch: "The API is on a different network than this page.",
    not_registered: "Register a name before creating an invoice.",
    name_taken: "That name is already claimed on Ciro. Choose another name.",
    allowance_revoked: "That allowance is revoked.",
    cap_exceeded: "That allowance is used up.",
    bad_address: "Enter a valid wallet address.",
    faucet_rate_limited: "This wallet requested test funds recently. Try again in a few minutes.",
    faucet_empty: "The Ciro testnet faucet is empty right now. Use the official QDay faucet as a fallback.",
    faucet_offline: "The Ciro testnet faucet is offline. Use the official QDay faucet as a fallback.",
    faucet_failed: "The Ciro testnet faucet could not send funds. Try again.",
    faucet_already_claimed: "This wallet already claimed from the Ciro faucet in the last 24 hours. Use the official QDay faucet if you need more.",
    use_official_faucet: "tUSD8 comes from the QDay faucet, not this app.",
    not_found: "That is not available on this network.",
  };
  return copy[code] || "The request failed.";
}
