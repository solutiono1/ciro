import { readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Mirrors packages/shared/src/money.js. Kept inside the published CLI package so
// `npx @getciro/cli` does not depend on a monorepo-only path.
const SCALE = 1_000_000n;
function parseHuman(input) {
  if (typeof input !== "string" || !/^\d+(\.\d{1,6})?$/.test(input)) {
    throw new Error("bad_amount");
  }
  const [whole, frac = ""] = input.split(".");
  return BigInt(whole) * SCALE + BigInt(frac.padEnd(6, "0"));
}

const USAGE = `ciro register <name>
ciro invoice --amount 100 --reference "March design" --due 2026-12-01
ciro check --payee 0x… --name "Elena Rossi"
ciro pay <id> --name "Elena Rossi" [--from-allowance]
ciro receipt <id>
ciro allow <spender> --cap 500 --expiry 2026-12-31
ciro revoke <spender>

Signing commands print the summary, then require --yes when stdin is not a terminal.
The key file is mode 0600. The API never sees it.`;

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let yes = false;
  let fromAllowance = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--from-allowance") {
      fromAllowance = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${arg}`);
      flags[arg.slice(2)] = value;
      continue;
    }
    positional.push(arg);
  }
  return { positional, flags, yes, fromAllowance };
}

export function loadConfig(file) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`cannot read config ${file}`);
  }
  if (!raw.apiUrl || !raw.rpcUrl || raw.chainId === undefined) {
    throw new Error("config needs apiUrl, rpcUrl, and chainId");
  }
  return {
    apiUrl: String(raw.apiUrl).replace(/\/$/, ""),
    rpcUrl: String(raw.rpcUrl),
    chainId: Number(raw.chainId),
    keyPath: raw.keyPath ? String(raw.keyPath) : null,
  };
}

function configFile(env) {
  if (env.CIRO_CONFIG) return env.CIRO_CONFIG;
  return join(env.HOME ?? "", ".ciro", "config.json");
}

function loadKey(file) {
  if (!file) throw new Error("config keyPath is required to sign");
  const mode = statSync(file).mode & 0o077;
  if (mode !== 0) throw new Error("key file must be mode 0600");
  const text = readFileSync(file, "utf8").trim();
  const hex = text.startsWith("0x") ? text : `0x${text}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) throw new Error("key file must contain one hex private key");
  return hex;
}

function safe(err) {
  const message = err instanceof Error ? err.message : "error";
  if (/0x[0-9a-fA-F]{64}/.test(message)) return "request failed";
  return message;
}

async function callApi(config, method, pathname, body) {
  const response = await fetch(`${config.apiUrl}${pathname}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const json = await response.json();
  if (!response.ok) {
    const result = json.result ? ` ${json.result}` : "";
    throw new Error(`${json.error ?? "request_failed"}${result}`);
  }
  return json;
}

function ask(stdin, stderr, prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stderr });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function sendSteps(config, account, tx, yes, stdin, stdout, stderr) {
  const steps = [...(tx.approvals ?? []), tx];
  for (const step of steps) {
    if (step.chainId !== config.chainId) throw new Error("chain_mismatch");
    if (!/^0x[0-9a-fA-F]{40}$/.test(step.to) || !/^0x[0-9a-fA-F]+$/.test(step.data)) {
      throw new Error("bad_transaction");
    }
    stdout.write(`${step.summary}\n`);
  }
  if (!yes) {
    if (!stdin.isTTY) throw new Error("pass --yes to sign without a prompt");
    const answer = await ask(stdin, stderr, "Sign and send? [y/N] ");
    if (answer.trim().toLowerCase() !== "y") throw new Error("not_signed");
  }
  const chain = defineChain({
    id: config.chainId,
    name: config.chainId === 44005 ? "Aevum" : "Ciro",
    nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const wallet = createWalletClient({ account, chain, transport: http(config.rpcUrl) });
  const reader = createPublicClient({ chain, transport: http(config.rpcUrl) });
  for (const step of steps) {
    const hash = await wallet.sendTransaction({ to: step.to, data: step.data, value: 0n });
    const receipt = await reader.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("transaction_reverted");
    stdout.write(`${hash}\n`);
  }
}

export async function main(argv, options = {}) {
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const stdin = options.stdin ?? process.stdin;
  try {
    if (argv.includes("--help") || argv.includes("-h")) {
      stderr.write(`${USAGE}\n`);
      return 0;
    }
    const parsed = parseArgs(argv);
    const command = parsed.positional[0];
    if (!command || command === "help") {
      stderr.write(`${USAGE}\n`);
      return command === "help" ? 0 : 1;
    }
    const config = loadConfig(configFile(env));
    if (command === "check") {
      const json = await callApi(config, "POST", "/v1/check", {
        payee: parsed.flags.payee,
        name: parsed.flags.name,
      });
      stdout.write(`${json.result}\n`);
      return 0;
    }
    if (command === "receipt") {
      const id = parsed.positional[1];
      if (!id) throw new Error("usage: ciro receipt <id>");
      const json = await callApi(config, "GET", `/v1/receipts/${id}`);
      stdout.write(`Receipt ${json.id}\n`);
      stdout.write(`Payee: ${json.payeeName}\n`);
      stdout.write(`Payer: ${json.payer}\n`);
      stdout.write(`Amount: ${json.amountDisplay} ${json.symbol}\n`);
      stdout.write(`Fee: ${json.feeDisplay}\n`);
      stdout.write(`Reference: ${json.reference}\n`);
      stdout.write(`Network: ${json.chainId}\n`);
      stdout.write(`Paid: ${json.paidAt}\n`);
      stdout.write(`Transaction: ${json.transactionHash}\n`);
      return 0;
    }

    const account = privateKeyToAccount(loadKey(config.keyPath));
    let tx;
    if (command === "register") {
      const name = parsed.positional.slice(1).join(" ");
      if (!name) throw new Error("usage: ciro register <name>");
      tx = await callApi(config, "POST", "/v1/tx/register", { name, address: account.address });
    } else if (command === "invoice") {
      if (!parsed.flags.amount || parsed.flags.reference === undefined || !parsed.flags.due) {
        throw new Error("usage: ciro invoice --amount <tUSD8> --reference <text> --due <YYYY-MM-DD>");
      }
      tx = await callApi(config, "POST", "/v1/tx/invoice", {
        amount: parseHuman(parsed.flags.amount).toString(),
        reference: parsed.flags.reference,
        due: parsed.flags.due,
      });
    } else if (command === "pay") {
      const id = parsed.positional[1];
      if (!id || !parsed.flags.name) throw new Error("usage: ciro pay <id> --name <name>");
      const pathname = parsed.fromAllowance ? "/v1/tx/pay-from-allowance" : "/v1/tx/pay";
      const body = parsed.fromAllowance
        ? { id, name: parsed.flags.name, spender: account.address }
        : { id, name: parsed.flags.name, payer: account.address };
      tx = await callApi(config, "POST", pathname, body);
    } else if (command === "allow") {
      const spender = parsed.positional[1];
      if (!spender || !parsed.flags.cap || !parsed.flags.expiry) {
        throw new Error("usage: ciro allow <spender> --cap <tUSD8> --expiry <YYYY-MM-DD>");
      }
      tx = await callApi(config, "POST", "/v1/tx/allow", {
        spender,
        cap: parseHuman(parsed.flags.cap).toString(),
        expiry: parsed.flags.expiry,
      });
    } else if (command === "revoke") {
      const spender = parsed.positional[1];
      if (!spender) throw new Error("usage: ciro revoke <spender>");
      tx = await callApi(config, "POST", "/v1/tx/revoke", { spender });
    } else {
      throw new Error(`unknown command ${command}`);
    }
    await sendSteps(config, account, tx, parsed.yes, stdin, stdout, stderr);
    return 0;
  } catch (err) {
    stderr.write(`${safe(err)}\n`);
    return 1;
  }
}
