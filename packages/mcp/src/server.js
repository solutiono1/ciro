import { createInterface } from "node:readline";

const tools = [
  {
    name: "ciro_check",
    description: "Match a name. Pass invoiceId to match the name locked on that invoice. Pass payee to match the payee's current registration. This does not pay.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        payee: { type: "string" },
        invoiceId: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "ciro_prepare_invoice",
    description: "Prepare an unsigned create-invoice transaction. amount is an integer string of base units (6 decimals). This does not sign.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "string" },
        reference: { type: "string" },
        due: { type: "string" },
      },
      required: ["amount", "reference", "due"],
    },
  },
  {
    name: "ciro_prepare_pay",
    description: "Prepare an unsigned pay transaction and report exact, close, or none. A result other than exact has no transaction. This server does not sign and has no paying key.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        fromAllowance: { type: "boolean" },
        payer: { type: "string" },
        spender: { type: "string" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "ciro_receipt",
    description: "Read the receipt for a paid invoice.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

function apiBase() {
  return (process.env.CIRO_API_URL ?? "").replace(/\/$/, "");
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function callApi(method, pathname, body) {
  const base = apiBase();
  if (!base) return { ok: false, json: { error: "missing_api_url" } };
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const json = await response.json();
  return { ok: response.ok, json };
}

function withoutSecrets(args) {
  const clean = { ...(args ?? {}) };
  delete clean.privateKey;
  delete clean.key;
  delete clean.mnemonic;
  delete clean.seed;
  return clean;
}

async function callTool(name, args) {
  const clean = withoutSecrets(args);
  if (name === "ciro_check") {
    if (clean.invoiceId !== undefined) {
      return callApi("POST", `/v1/invoices/${clean.invoiceId}/check`, { name: clean.name });
    }
    return callApi("POST", "/v1/check", { payee: clean.payee, name: clean.name });
  }
  if (name === "ciro_prepare_invoice") {
    return callApi("POST", "/v1/tx/invoice", {
      amount: clean.amount,
      reference: clean.reference,
      due: clean.due,
    });
  }
  if (name === "ciro_prepare_pay") {
    const pathname = clean.fromAllowance ? "/v1/tx/pay-from-allowance" : "/v1/tx/pay";
    const body = { id: clean.id, name: clean.name };
    if (clean.payer) body.payer = clean.payer;
    if (clean.spender) body.spender = clean.spender;
    return callApi("POST", pathname, body);
  }
  if (name === "ciro_receipt") return callApi("GET", `/v1/receipts/${clean.id}`);
  return { ok: false, json: { error: "unknown_tool" } };
}

async function handle(message) {
  const id = message.id;
  const method = message.method;
  if (id === undefined) return;
  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "ciro", version: "0.1.0" },
      },
    });
    return;
  }
  if (method === "ping") {
    send({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools } });
    return;
  }
  if (method === "tools/call") {
    const name = message.params?.name;
    const called = await callTool(name, message.params?.arguments);
    send({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(called.json) }],
        isError: !called.ok,
      },
    });
    return;
  }
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method_not_found" } });
}

export function serve() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    handle(message).catch(() => {
      if (message.id !== undefined) {
        send({ jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "request_failed" } });
      }
    });
  });
}
