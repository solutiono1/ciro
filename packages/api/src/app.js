import { createServer as createHttpServer } from "node:http";
import { createPublicClient, defineChain, getAddress, http, isAddress } from "viem";
import {
  buildPay,
  chainNow,
  encodeAllow,
  encodeCreate,
  encodeMint,
  encodeRegister,
  encodeRevoke,
  allowanceRows,
  findPaid,
  invoiceJson,
  listInvoiceIds,
  loadMeta,
  matchInvoice,
  matchPayee,
  paidLogsForPayer,
  publicMeta,
  readInvoice,
  readPayee,
  txBody,
} from "./chain.js";
import { ApiError } from "./errors.js";
import { isoFromSeconds } from "./summary.js";
import { feeOf, formatFee, formatUnits, parseBaseUnits } from "../../shared/src/money.js";
import { isEmptyName } from "../../shared/src/normalize.js";

const UINT64 = 18446744073709551615n;
const MAX_UINT256 = (1n << 256n) - 1n;
// 9999-12-31T23:59:59Z. Above this, a JavaScript Date cannot format the time.
const MAX_DATE_SECONDS = 253402300799n;

// The faucet is a testnet convenience. It is rate-limited per address and is
// disabled entirely on a priced deployment, so it can never mint value that
// matters. The map is in-memory by design: there is no database, and a testnet
// cooldown that resets on restart is enough.
const FAUCET_COOLDOWN_MS = 60_000;
const faucetLast = new Map();

export function createServer(config) {
  const chain = defineChain({
    id: config.chainId,
    name: config.chainId === 44005 ? "Aevum" : "Ciro local",
    nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const state = {
    config,
    client: createPublicClient({ chain, transport: http(config.rpcUrl) }),
    meta: null,
  };
  return createHttpServer((req, res) => {
    route(req, res, state).catch((err) => {
      if (res.headersSent) return;
      if (err instanceof ApiError) {
        send(res, err.status, err.body());
        return;
      }
      send(res, 502, { error: "chain_unavailable" });
    });
  });
}

async function route(req, res, state) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const result = await dispatch(req, url.pathname, state);
  send(res, result.status, result.body);
}

async function dispatch(req, path, state) {
  const invoice = path.match(/^\/v1\/invoices\/([1-9]\d{0,77})$/);
  const invoiceCheck = path.match(/^\/v1\/invoices\/([1-9]\d{0,77})\/check$/);
  const receipt = path.match(/^\/v1\/receipts\/([1-9]\d{0,77})$/);
  const payeeInvoices = path.match(/^\/v1\/payees\/(0x[0-9a-fA-F]{40})\/invoices$/);
  const payeeAllowances = path.match(/^\/v1\/payees\/(0x[0-9a-fA-F]{40})\/allowances$/);
  const payerReceipts = path.match(/^\/v1\/payers\/(0x[0-9a-fA-F]{40})\/receipts$/);
  const payee = path.match(/^\/v1\/payees\/(0x[0-9a-fA-F]{40})$/);

  if (req.method === "GET" && path === "/v1/meta") return { status: 200, body: await publicMeta(state) };
  if (req.method === "GET" && invoice) return getOneInvoice(state, parseId(invoice[1]));
  if (req.method === "POST" && invoiceCheck) return postInvoiceCheck(state, parseId(invoiceCheck[1]), await readJson(req));
  if (req.method === "GET" && receipt) return getReceipt(state, parseId(receipt[1]));
  if (req.method === "POST" && path === "/v1/check") return postCheck(state, await readJson(req));
  if (req.method === "GET" && payeeInvoices) return getPayeeInvoices(state, requireAddress(payeeInvoices[1]));
  if (req.method === "GET" && payeeAllowances) return getAllowances(state, requireAddress(payeeAllowances[1]));
  if (req.method === "GET" && payerReceipts) return getPayerReceipts(state, requireAddress(payerReceipts[1]));
  if (req.method === "GET" && payee) return { status: 200, body: await readPayee(state, requireAddress(payee[1])) };
  if (req.method === "POST" && path === "/v1/tx/register") return postRegister(state, await readJson(req));
  if (req.method === "POST" && path === "/v1/tx/invoice") return postInvoice(state, await readJson(req));
  if (req.method === "POST" && path === "/v1/tx/pay") return postPay(state, await readJson(req), false);
  if (req.method === "POST" && path === "/v1/tx/pay-from-allowance") return postPay(state, await readJson(req), true);
  if (req.method === "POST" && path === "/v1/tx/allow") return postAllow(state, await readJson(req));
  if (req.method === "POST" && path === "/v1/tx/revoke") return postRevoke(state, await readJson(req));
  if (req.method === "POST" && path === "/v1/tx/faucet") return postFaucet(state, await readJson(req));
  throw new ApiError(404, "not_found");
}

async function getOneInvoice(state, id) {
  const meta = await loadMeta(state);
  const now = await chainNow(state);
  const inv = await readInvoice(state, id);
  return { status: 200, body: invoiceJson(id, inv, now, meta.symbol) };
}

async function getPayeeInvoices(state, account) {
  const meta = await loadMeta(state);
  const now = await chainNow(state);
  const ids = await listInvoiceIds(state, account);
  const truncated = ids.length > 100;
  // Keep the newest 100. A payee with a long history must still see today's invoice.
  const page = (truncated ? ids.slice(-100) : ids).reverse();
  const invoices = [];
  for (const id of page) {
    invoices.push(invoiceJson(id, await readInvoice(state, id), now, meta.symbol));
  }
  return { status: 200, body: { invoices, truncated } };
}

async function getAllowances(state, account) {
  const rows = await allowanceRows(state, account);
  return { status: 200, body: { allowances: rows } };
}

async function getPayerReceipts(state, account) {
  // One log scan for the whole list. Asking getReceipt to find each log again
  // would rescan the chain up to 100 times for a single request.
  const rows = await paidLogsForPayer(state, account);
  const receipts = [];
  for (const row of rows) {
    const receipt = await getReceipt(state, row.id, row.log);
    receipts.push(receipt.body);
  }
  return { status: 200, body: { receipts } };
}

async function getReceipt(state, id, knownLog = null) {
  const meta = await loadMeta(state);
  const inv = await readInvoice(state, id);
  if (inv.paidAt === 0n) throw new ApiError(404, "not_paid");
  const log = knownLog ?? await findPaid(state, id);
  const fee = log?.args?.fee ?? feeOf(inv.amount, meta.feeBps);
  const net = inv.amount - fee;
  return {
    status: 200,
    body: {
      id: id.toString(),
      payee: getAddress(inv.payee),
      payeeName: inv.payeeName,
      payer: getAddress(inv.payer),
      amount: inv.amount.toString(),
      amountDisplay: formatUnits(inv.amount),
      symbol: meta.symbol,
      fee: fee.toString(),
      feeDisplay: formatFee(fee),
      net: net.toString(),
      netDisplay: formatUnits(net),
      reference: inv.memo,
      paidAt: inv.paidAt.toString(),
      chainId: Number(inv.chainId),
      transactionHash: log?.transactionHash ?? null,
    },
  };
}

async function postCheck(state, body) {
  const name = requireName(body.name, true);
  const result = await matchPayee(state, requireAddress(body.payee), name);
  return { status: 200, body: { result } };
}

async function postInvoiceCheck(state, id, body) {
  const name = requireName(body.name, true);
  const result = await matchInvoice(state, id, name);
  return { status: 200, body: { result } };
}

async function postRegister(state, body) {
  const name = requireName(body.name, false);
  if (isEmptyName(name)) throw new ApiError(400, "empty_name");
  await loadMeta(state);
  return { status: 200, body: txBody(state, encodeRegister(name), `Register "${name}"`) };
}

async function postInvoice(state, body) {
  if (typeof body.reference !== "string" || body.reference.length > 256) throw new ApiError(400, "bad_request");
  if (/[\u0000-\u001f\u007f-\u009f]/.test(body.reference)) throw new ApiError(400, "bad_request");
  const amount = parseAmount(body.amount);
  if (amount === 0n) throw new ApiError(400, "bad_amount");
  const due = parseDue(body.due);
  const now = await chainNow(state);
  if (due <= now) throw new ApiError(409, "past_due");
  const meta = await loadMeta(state);
  const summary = `Create invoice for ${formatUnits(amount)} ${meta.symbol}, reference ${body.reference}, due ${isoFromSeconds(due)}`;
  return { status: 200, body: txBody(state, encodeCreate(amount, body.reference, due), summary) };
}

async function postPay(state, body, fromAllowance) {
  const id = parseId(body.id);
  const name = requireName(body.name, true);
  const field = fromAllowance ? body.spender : body.payer;
  const account = field === undefined ? null : requireAddress(field);
  return { status: 200, body: await buildPay(state, id, name, fromAllowance, account) };
}

async function postAllow(state, body) {
  const spender = requireAddress(body.spender);
  const cap = parseAmount(body.cap);
  if (cap === 0n) throw new ApiError(400, "bad_amount");
  const expiry = parseDue(body.expiry);
  const now = await chainNow(state);
  if (expiry <= now) throw new ApiError(409, "past_due");
  const meta = await loadMeta(state);
  const summary = `Allow ${spender} to settle up to ${formatUnits(cap)} ${meta.symbol} until ${isoFromSeconds(expiry)}`;
  return { status: 200, body: txBody(state, encodeAllow(spender, cap, expiry), summary) };
}

async function postRevoke(state, body) {
  const spender = requireAddress(body.spender);
  await loadMeta(state);
  return { status: 200, body: txBody(state, encodeRevoke(spender), `Revoke ${spender}`) };
}

async function postFaucet(state, body) {
  const to = requireAddress(body.address);
  const meta = await loadMeta(state);
  // The in-app mint only works on a local test chain with a mintable token.
  // Aevum's tUSD8 has no public mint, so the app routes to the official faucet.
  if (state.config.chainId === 44005) throw new ApiError(409, "use_official_faucet");
  // A faucet only exists on a zero-fee (testnet) deployment. On a priced
  // deployment it returns not_found, so the mint can never touch real value.
  if (Number(meta.feeBps) !== 0) throw new ApiError(404, "not_found");
  const last = faucetLast.get(to);
  if (last && Date.now() - last < FAUCET_COOLDOWN_MS) throw new ApiError(429, "faucet_rate_limited");
  faucetLast.set(to, Date.now());
  const amount = 1_000n * 1_000_000n;
  const summary = `Mint ${formatUnits(amount)} ${meta.symbol} to ${to} on testnet`;
  return {
    status: 200,
    body: txBody(state, encodeMint(to, amount), summary, getAddress(meta.token)),
  };
}

function parseAmount(value) {
  try {
    return parseBaseUnits(value);
  } catch {
    throw new ApiError(400, "bad_amount");
  }
}

function parseDue(value) {
  let due;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const ms = Date.parse(`${value}T23:59:59Z`);
    if (Number.isNaN(ms)) throw new ApiError(400, "bad_due");
    due = BigInt(Math.floor(ms / 1000));
  } else if (typeof value === "string" && /^\d+$/.test(value)) {
    due = BigInt(value);
  } else if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    due = BigInt(value);
  } else {
    throw new ApiError(400, "bad_due");
  }
  if (due > UINT64 || due > MAX_DATE_SECONDS) throw new ApiError(400, "bad_due");
  return due;
}

function parseId(value) {
  let id;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) id = BigInt(value);
  else if (typeof value === "string" && /^[1-9]\d{0,77}$/.test(value)) id = BigInt(value);
  else throw new ApiError(400, "bad_request");
  if (id > MAX_UINT256) throw new ApiError(400, "bad_request");
  return id;
}

function requireName(value, allowEmpty) {
  if (typeof value !== "string" || value.length > 128) throw new ApiError(400, "bad_request");
  if (!allowEmpty && value.length === 0) throw new ApiError(400, "bad_request");
  // The deployed fold drops every byte outside ASCII. Rejecting non-ASCII
  // names here prevents a registration that would collide after folding.
  if (/[^\x20-\x7E]/.test(value)) throw new ApiError(400, "bad_request");
  return value;
}

function requireAddress(value) {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) throw new ApiError(400, "bad_address");
  return getAddress(value);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const ok = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32_768) {
        fail(new ApiError(400, "bad_request"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        ok({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          fail(new ApiError(400, "bad_request"));
          return;
        }
        ok(parsed);
      } catch (err) {
        fail(err instanceof ApiError ? err : new ApiError(400, "bad_request"));
      }
    });
    req.on("error", () => fail(new ApiError(400, "bad_request")));
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}
