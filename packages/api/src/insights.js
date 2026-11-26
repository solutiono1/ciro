import { encodeEventTopics, formatEther, getAddress, parseAbiItem } from "viem";
import { formatUnits } from "../../shared/src/money.js";
import { tokenAbi } from "./abi.js";
import { eventLogs, loadMeta, read } from "./chain.js";
import { faucetSnapshot } from "./faucet.js";
import { readTelemetry, telemetryEnabled } from "./telemetry.js";

const registeredEvent = parseAbiItem("event Registered(address indexed payee, bytes32 nameHash)");
const invoiceCreatedEvent = parseAbiItem(
  "event InvoiceCreated(uint256 indexed id, address indexed payee, uint256 amount, uint64 due, string memo)",
);
const paidEvent = parseAbiItem(
  "event Paid(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount, uint256 fee)",
);
const registeredTopic = encodeEventTopics({ abi: [registeredEvent] })[0];
const invoiceCreatedTopic = encodeEventTopics({ abi: [invoiceCreatedEvent] })[0];
const paidTopic = encodeEventTopics({ abi: [paidEvent] })[0];
const DAY = 24 * 60 * 60;

function sum(values) {
  return values.reduce((total, value) => total + value, 0n);
}

function asSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percent(part, whole) {
  return whole ? part / whole : 0;
}

function mean(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function shortInvoice(log, paid, now) {
  const id = log.args.id.toString();
  const payment = paid.get(id) || null;
  let status = "open";
  if (payment) status = "paid";
  else if (asSeconds(log.args.due) < now) status = "past_due";
  return {
    id,
    payee: getAddress(log.args.payee),
    amount: log.args.amount.toString(),
    amountDisplay: formatUnits(log.args.amount),
    due: log.args.due.toString(),
    createdAt: log.timestamp,
    status,
  };
}

// Stats and diagnostics are read-only and safe to cache briefly. The cache is
// per isolate, so a deploy or a new isolate always starts fresh. It protects
// the explorer and the faucet RPC from a dashboard left open on a refresh loop.
const INSIGHT_CACHE_MS = 10_000;

export async function computeStats(state, env = null) {
  if (state.statsCache && Date.now() - state.statsCache.at < INSIGHT_CACHE_MS) {
    return state.statsCache.value;
  }
  const value = await computeStatsFresh(state, env);
  state.statsCache = { at: Date.now(), value };
  return value;
}

async function computeStatsFresh(state, env = null) {
  const meta = await loadMeta(state);
  const [registered, created, paidLogs, blockNumber, faucet, api] = await Promise.all([
    eventLogs(state, registeredTopic, registeredEvent),
    eventLogs(state, invoiceCreatedTopic, invoiceCreatedEvent),
    eventLogs(state, paidTopic, paidEvent),
    state.client.getBlockNumber({ cacheTime: 0 }),
    faucetSnapshot(env),
    readTelemetry(env),
  ]);

  const now = Math.floor(Date.now() / 1000);
  const users = new Map();
  for (const log of registered) {
    const address = getAddress(log.args.payee);
    const at = log.timestamp ?? null;
    const prior = users.get(address);
    if (!prior) {
      users.set(address, { address, firstAt: at, lastAt: at });
    } else {
      if (at && (!prior.firstAt || at < prior.firstAt)) prior.firstAt = at;
      if (at && (!prior.lastAt || at > prior.lastAt)) prior.lastAt = at;
    }
  }
  const userRows = [...users.values()];
  const new7d = userRows.filter((row) => row.firstAt && row.firstAt >= now - 7 * DAY).length;
  const new30d = userRows.filter((row) => row.firstAt && row.firstAt >= now - 30 * DAY).length;

  const createdById = new Map();
  for (const log of created) createdById.set(log.args.id.toString(), log);
  const paidById = new Map();
  for (const log of paidLogs) paidById.set(log.args.id.toString(), log);

  const paidInCreated = [...createdById.keys()].filter((id) => paidById.has(id));
  const open = [];
  const pastDue = [];
  for (const [id, log] of createdById) {
    if (paidById.has(id)) continue;
    if (asSeconds(log.args.due) < now) pastDue.push(log);
    else open.push(log);
  }

  const volume = sum(paidLogs.map((log) => log.args.amount));
  const fee = sum(paidLogs.map((log) => log.args.fee));
  const timeToPay = [];
  for (const id of paidInCreated) {
    const createdLog = createdById.get(id);
    const paidLog = paidById.get(id);
    if (createdLog?.timestamp && paidLog?.timestamp) {
      timeToPay.push(Math.max(0, paidLog.timestamp - createdLog.timestamp));
    }
  }

  const payeeCounts = new Map();
  const payers = new Set();
  for (const log of paidLogs) {
    const payee = getAddress(log.args.payee);
    payeeCounts.set(payee, (payeeCounts.get(payee) || 0) + 1);
    payers.add(getAddress(log.args.payer));
  }
  const repeatPayees = [...payeeCounts.values()].filter((count) => count > 1).length;

  const allLogs = [...registered, ...created, ...paidLogs];
  const lastEventBlock = allLogs.reduce((max, log) => (log.blockNumber > max ? log.blockNumber : max), 0n);
  const lastEventAt = allLogs.reduce((max, log) => Math.max(max, log.timestamp || 0), 0);

  const recentPayments = [...paidLogs]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 8)
    .map((log) => ({
      id: log.args.id.toString(),
      payer: getAddress(log.args.payer),
      payee: getAddress(log.args.payee),
      amount: log.args.amount.toString(),
      amountDisplay: formatUnits(log.args.amount),
      fee: log.args.fee.toString(),
      feeDisplay: formatUnits(log.args.fee),
      at: log.timestamp,
      transactionHash: log.transactionHash,
    }));

  const recentInvoices = [...created]
    .sort((a, b) => Number(b.args.id - a.args.id))
    .slice(0, 8)
    .map((log) => shortInvoice(log, paidById, now));

  return {
    generatedAt: new Date().toISOString(),
    chain: {
      chainId: state.config.chainId,
      contract: state.config.address,
      token: getAddress(meta.token),
      symbol: meta.symbol,
      feeBps: Number(meta.feeBps),
      block: blockNumber.toString(),
      startBlock: state.config.startBlock.toString(),
      lastEventBlock: lastEventBlock.toString(),
      indexerLagBlocks: Number(blockNumber - lastEventBlock),
      indexerLagSeconds: lastEventAt ? Math.max(0, now - lastEventAt) : null,
    },
    users: {
      total: userRows.length,
      new7d,
      new30d,
      repeatPayees,
      uniquePayers: payers.size,
    },
    invoices: {
      total: createdById.size,
      paid: paidInCreated.length,
      open: open.length,
      pastDue: pastDue.length,
      conversion: percent(paidInCreated.length, createdById.size),
      paidVolume: volume.toString(),
      paidVolumeDisplay: formatUnits(volume),
      fee: fee.toString(),
      feeDisplay: formatUnits(fee),
      takeRateBps: volume > 0n ? Number((fee * 10_000n) / volume) : 0,
      avgSecondsToPay: mean(timeToPay),
      medianSecondsToPay: median(timeToPay),
    },
    faucet: {
      configured: Boolean(faucet.configured),
      reason: faucet.reason || null,
      treasury: faucet.treasury || null,
      tokenBalance: faucet.tokenBalance || "0",
      tokenBalanceDisplay: formatUnits(BigInt(faucet.tokenBalance || "0")),
      gasBalance: faucet.gasBalance || "0",
      gasBalanceDisplay: formatEther(BigInt(faucet.gasBalance || "0")),
      claims24h: faucet.claims24h ?? null,
      uniqueClaimants24h: faucet.uniqueClaimants24h ?? null,
      lastClaimAt: faucet.lastClaimAt ?? null,
      empty: Boolean(faucet.empty),
      claimToken: faucet.tokenAmount || null,
      claimGas: faucet.gasAmount || null,
    },
    api,
    recent: {
      payments: recentPayments,
      invoices: recentInvoices,
    },
  };
}

async function timed(checks, id, label, fn, { fix = null, optional = false } = {}) {
  const started = Date.now();
  try {
    const detail = await fn();
    checks.push({ id, label, level: "ok", ok: true, detail, ms: Date.now() - started, fix: null });
  } catch (err) {
    const level = optional ? "warn" : "fail";
    checks.push({
      id,
      label,
      level,
      ok: level === "ok",
      detail: err?.message || String(err),
      ms: Date.now() - started,
      fix,
    });
  }
}

export async function computeDiagnostics(state, env = null) {
  if (state.diagCache && Date.now() - state.diagCache.at < INSIGHT_CACHE_MS) {
    return state.diagCache.value;
  }
  const value = await computeDiagnosticsFresh(state, env);
  state.diagCache = { at: Date.now(), value };
  return value;
}

async function computeDiagnosticsFresh(state, env = null) {
  const checks = [];
  let meta = null;
  await Promise.all([
    timed(checks, "api", "API configuration", async () => {
      meta = await loadMeta(state);
      return `chain ${state.config.chainId}, fee ${Number(meta.feeBps) / 100}%, token ${meta.symbol}`;
    }, { fix: "Check CIRO_RPC_URL, CIRO_ADDRESS, and CIRO_CHAIN_ID in the Pages project." }),

    timed(checks, "rpc", "Chain RPC", async () => {
      const [chainId, block] = await Promise.all([
        state.client.getChainId(),
        state.client.getBlockNumber({ cacheTime: 0 }),
      ]);
      if (Number(chainId) !== state.config.chainId) {
        throw new Error(`RPC is chain ${chainId}, expected ${state.config.chainId}`);
      }
      return `chain ${chainId}, block ${block}`;
    }, { fix: "Retry in a minute. If it persists, check the Aevum RPC status or CIRO_RPC_URL." }),

    timed(checks, "contract", "Ciro contract", async () => {
      const code = await state.client.getCode({ address: state.config.address });
      if (!code || code === "0x") throw new Error("no contract code at CIRO_ADDRESS");
      return `${Math.ceil((code.length - 2) / 2)} bytes at ${state.config.address}`;
    }, { fix: "The configured address has no code. Confirm CIRO_ADDRESS is the verified Ciro deployment." }),

    timed(checks, "token", "tUSD8 token", async () => {
      const token = await read(state, "token", []);
      const [symbol, decimals] = await Promise.all([
        state.client.readContract({ address: token, abi: tokenAbi, functionName: "symbol" }),
        state.client.readContract({ address: token, abi: tokenAbi, functionName: "decimals" }),
      ]);
      return `${symbol}, ${decimals} decimals at ${getAddress(token)}`;
    }, { fix: "The token read failed. Check the RPC and the token address returned by the contract." }),

    timed(checks, "explorer", "Aevum explorer", async () => {
      if (!state.config.explorerUrl) throw new Error("CIRO_EXPLORER_URL is not set");
      const response = await fetch(`${state.config.explorerUrl}/api?module=block&action=eth_block_number`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`explorer HTTP ${response.status}`);
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      return `block ${json.result ?? "ok"}`;
    }, { fix: "Lists fall back to a slower RPC scan. Check the explorer status or CIRO_EXPLORER_URL.", optional: true }),

    timed(checks, "faucet", "Testnet faucet", async () => {
      const snapshot = await faucetSnapshot(env);
      if (!snapshot.configured) throw new Error(snapshot.reason || "not configured");
      if (snapshot.empty) throw new Error("treasury token balance is below one claim");
      return `${formatUnits(BigInt(snapshot.tokenBalance))} tUSD8, ${formatEther(BigInt(snapshot.gasBalance))} tQDAY, ${snapshot.claims24h} claims in 24h`;
    }, { fix: "Refill the treasury or keep the QDay Discord fallback. The faucet is optional for invoice reads.", optional: true }),

    timed(checks, "indexer", "Event index", async () => {
      const [registered, created, paid, block] = await Promise.all([
        eventLogs(state, registeredTopic, registeredEvent),
        eventLogs(state, invoiceCreatedTopic, invoiceCreatedEvent),
        eventLogs(state, paidTopic, paidEvent),
        state.client.getBlockNumber({ cacheTime: 0 }),
      ]);
      const last = [...registered, ...created, ...paid]
        .reduce((max, log) => (log.blockNumber > max ? log.blockNumber : max), 0n);
      const lag = last ? Number(block - last) : 0;
      if (lag > 10_000) throw new Error(`${lag} blocks behind the chain head`);
      return last ? `last event block ${last}, head ${block}, lag ${lag}` : "no events yet";
    }, { fix: "The explorer or RPC may be behind. Receipts still work; lists can lag.", optional: true }),

    timed(checks, "telemetry", "API telemetry", async () => {
      if (!telemetryEnabled(env)) throw new Error("CIRO_STATS KV binding is not configured");
      return "KV binding present";
    }, { fix: "Bind a KV namespace as CIRO_STATS to persist request logs. The API works without it.", optional: true }),
  ]);

  checks.sort((a, b) => {
    const order = { fail: 0, warn: 1, ok: 2 };
    return order[a.level] - order[b.level] || a.label.localeCompare(b.label);
  });

  return {
    generatedAt: new Date().toISOString(),
    overall: checks.some((check) => check.level === "fail") ? "fail" : checks.some((check) => check.level === "warn") ? "warn" : "ok",
    checks,
    config: {
      chainId: state.config.chainId,
      contract: state.config.address,
      token: meta ? getAddress(meta.token) : null,
      symbol: meta?.symbol || null,
      startBlock: state.config.startBlock.toString(),
      explorerUrl: state.config.explorerUrl || null,
      faucetKey: Boolean(env?.CIRO_FAUCET_KEY),
      telemetry: telemetryEnabled(env),
    },
  };
}
