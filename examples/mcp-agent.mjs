// An MCP client example: an agent reads a name and prepares transactions.
// It never receives a private key and never signs. A human wallet (or the CLI
// with a local key) signs the returned transaction.
//
// Run from the repo root:
//   node examples/mcp-agent.mjs
//
// Optional:
//   CIRO_API_URL=https://ciro-a9s.pages.dev/api
//   CIRO_AGENT_INVOICE=10

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = process.env.CIRO_API_URL || "https://ciro-a9s.pages.dev/api";
const invoiceId = process.env.CIRO_AGENT_INVOICE || "10";
const payee = "0xF69e6400b9c93B36d0730B3643f82fE54810498C";
const payer = "0x92cf6f88d9846C9aEcaE818cd811Ca45B9Ae90C7";

const child = spawn(process.execPath, [path.join(root, "packages/mcp/bin/ciro-mcp.js")], {
  cwd: root,
  env: { ...process.env, CIRO_API_URL: api },
  stdio: ["pipe", "pipe", "inherit"],
});
const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
let nextId = 1;

lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id == null || !pending.has(message.id)) return;
  const { resolve, reject, timer } = pending.get(message.id);
  clearTimeout(timer);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message || "mcp_error"));
  else resolve(message.result);
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 30_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

async function callTool(name, args) {
  const result = await request("tools/call", { name, arguments: args });
  const text = result?.content?.[0]?.text ?? "{}";
  const body = JSON.parse(text);
  if (result?.isError) return { ok: false, body };
  return { ok: true, body };
}

try {
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "ciro-agent-example", version: "1.0.0" },
  });
  notify("notifications/initialized");
  console.log(`server ${init.serverInfo.name} ${init.serverInfo.version}`);

  const list = await request("tools/list");
  console.log(`tools ${list.tools.map((tool) => tool.name).join(", ")}`);

  const check = await callTool("ciro_check", { payee, name: "Elena Rossi" });
  console.log(`check ${check.body.result}`);

  const invoice = await callTool("ciro_prepare_invoice", {
    amount: "1000000",
    reference: "Agent invoice",
    due: "2026-12-31",
  });
  console.log(`prepare_invoice ${invoice.ok ? invoice.body.summary : invoice.body.error}`);

  const pay = await callTool("ciro_prepare_pay", {
    id: invoiceId,
    name: "Elena Rossi",
    payer,
  });
  console.log(`prepare_pay ${pay.ok ? pay.body.summary : pay.body.error}`);

  const receipt = await callTool("ciro_receipt", { id: "8" });
  console.log(`receipt ${receipt.ok ? `${receipt.body.payeeName} ${receipt.body.amountDisplay} ${receipt.body.transactionHash}` : receipt.body.error}`);
  console.log("The agent prepared only. No key was shared and no transaction was signed.");
} finally {
  child.stdin.end();
  child.kill();
}
