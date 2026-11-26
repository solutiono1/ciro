/**
 * Ciro SDK: a typed client of the Ciro HTTP API.
 *
 * It never holds a key. Reads are public. Writes return an unsigned transaction
 * for the caller to sign and broadcast. See src/index.d.ts for the types.
 */

export class CiroError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {unknown} body
   */
  constructor(status, code, body) {
    super(code);
    this.name = "CiroError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class CiroClient {
  /**
   * @param {{ apiUrl?: string, fetch?: typeof fetch }} [options]
   */
  constructor({ apiUrl = "http://127.0.0.1:8787", fetch: fetchImpl = globalThis.fetch } = {}) {
    this.apiUrl = String(apiUrl).replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  async request(method, path, body) {
    const response = await this.fetch(`${this.apiUrl}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new CiroError(response.status, json.error || "request_failed", json);
    return json;
  }

  meta() {
    return this.request("GET", "/v1/meta");
  }

  invoice(id) {
    return this.request("GET", `/v1/invoices/${id}`);
  }

  checkInvoice(id, name) {
    return this.request("POST", `/v1/invoices/${id}/check`, { name });
  }

  receipt(id) {
    return this.request("GET", `/v1/receipts/${id}`);
  }

  payee(address) {
    return this.request("GET", `/v1/payees/${address}`);
  }

  payeeInvoices(address) {
    return this.request("GET", `/v1/payees/${address}/invoices`);
  }

  payeeAllowances(address) {
    return this.request("GET", `/v1/payees/${address}/allowances`);
  }

  payerReceipts(address) {
    return this.request("GET", `/v1/payers/${address}/receipts`);
  }

  check(payee, name) {
    return this.request("POST", "/v1/check", { payee, name });
  }

  prepareRegister(name, { address } = {}) {
    const body = { name };
    if (address) body.address = address;
    return this.request("POST", "/v1/tx/register", body);
  }

  prepareInvoice({ amount, reference, due }) {
    return this.request("POST", "/v1/tx/invoice", { amount, reference, due });
  }

  preparePay(id, name, { payer } = {}) {
    const body = { id, name };
    if (payer) body.payer = payer;
    return this.request("POST", "/v1/tx/pay", body);
  }

  preparePayFromAllowance(id, name, { spender } = {}) {
    const body = { id, name };
    if (spender) body.spender = spender;
    return this.request("POST", "/v1/tx/pay-from-allowance", body);
  }

  prepareAllow({ spender, cap, expiry }) {
    return this.request("POST", "/v1/tx/allow", { spender, cap, expiry });
  }

  prepareRevoke(spender) {
    return this.request("POST", "/v1/tx/revoke", { spender });
  }
}

/**
 * @param {{ apiUrl?: string, fetch?: typeof fetch }} [options]
 */
export function createClient(options) {
  return new CiroClient(options);
}
