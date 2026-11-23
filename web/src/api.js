import { apiUrl } from "./session.js";

export async function api(method, path, body) {
  let response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
    allowance_revoked: "That allowance is revoked.",
    cap_exceeded: "That allowance is used up.",
    bad_address: "Enter a valid wallet address.",
    faucet_rate_limited: "The faucet is cooling down. Wait a minute, then try again.",
    not_found: "That is not available on this network.",
  };
  return copy[code] || "The request failed.";
}
