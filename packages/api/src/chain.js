import { BaseError, encodeFunctionData, getAddress, parseAbiItem, zeroAddress } from "viem";
import { ciroAbi, RESULTS, tokenAbi } from "./abi.js";
import { approvalAmounts } from "./approval.js";
import { apiErrorFromRevert, ApiError } from "./errors.js";
import { approveSummary, paySummary } from "./summary.js";
import { feeOf, formatUnits } from "../../shared/src/money.js";

const LOG_SPAN = 1000n;
const paidEvent = parseAbiItem(
  "event Paid(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount, uint256 fee)",
);
const allowanceSetEvent = parseAbiItem(
  "event AllowanceSet(address indexed payee, address indexed spender, uint256 cap, uint64 expiry)",
);

export function revertName(err) {
  if (!(err instanceof BaseError)) return null;
  const rev = err.walk((item) => item.name === "ContractFunctionRevertedError");
  return rev?.data?.errorName ?? null;
}

function asRecord(raw, keys) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  const out = {};
  keys.forEach((key, index) => {
    out[key] = raw[index];
  });
  return out;
}

async function read(state, functionName, args) {
  try {
    return await state.client.readContract({
      address: state.config.address,
      abi: ciroAbi,
      functionName,
      args,
    });
  } catch (err) {
    const name = revertName(err);
    const mapped = name ? apiErrorFromRevert(name) : null;
    if (mapped) throw mapped;
    throw new ApiError(502, "chain_unavailable");
  }
}

export async function chainNow(state) {
  const block = await state.client.getBlock();
  return block.timestamp;
}

export async function loadMeta(state) {
  if (state.meta) return state.meta;
  const id = await state.client.getChainId();
  if (id !== state.config.chainId) throw new ApiError(500, "chain_mismatch");
  const feeBps = await read(state, "feeBps", []);
  const token = await read(state, "token", []);
  let symbol = "tUSD8";
  try {
    const found = await state.client.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "symbol",
    });
    if (typeof found === "string" && found.length > 0 && found.length <= 16) symbol = found;
  } catch {
    symbol = "tUSD8";
  }
  state.meta = { feeBps, token, symbol };
  return state.meta;
}

export async function readInvoice(state, id) {
  const raw = await read(state, "getInvoice", [id]);
  return asRecord(raw, ["payee", "amount", "payer", "due", "paidAt", "chainId", "memo", "payeeName"]);
}

export function invoiceJson(id, inv, now, symbol) {
  let status = "open";
  if (inv.paidAt !== 0n) status = "paid";
  else if (now > inv.due) status = "past_due";
  return {
    id: id.toString(),
    payee: getAddress(inv.payee),
    payeeName: inv.payeeName,
    amount: inv.amount.toString(),
    amountDisplay: formatUnits(inv.amount),
    symbol,
    reference: inv.memo,
    due: inv.due.toString(),
    payer: inv.payer === zeroAddress ? null : getAddress(inv.payer),
    paidAt: inv.paidAt === 0n ? null : inv.paidAt.toString(),
    chainId: Number(inv.chainId),
    status,
  };
}

export async function readPayee(state, account) {
  const [record, name] = await Promise.all([
    read(state, "payees", [account]),
    read(state, "displayName", [account]),
  ]);
  const payee = asRecord(record, ["nameHash", "initials", "words", "length", "active"]);
  if (!payee.active) return { address: getAddress(account), registered: false, name: null };
  return { address: getAddress(account), registered: true, name };
}

export async function listInvoiceIds(state, account) {
  const ids = await read(state, "invoicesOf", [account]);
  return ids;
}

export async function matchPayee(state, account, name) {
  const result = await read(state, "check", [account, name]);
  return RESULTS[Number(result)] ?? "none";
}

export async function matchInvoice(state, id, name) {
  const result = await read(state, "checkInvoice", [id, name]);
  return RESULTS[Number(result)] ?? "none";
}

export async function scanLogs(state, event, args) {
  // viem caches eth_blockNumber. A cached head hides logs from blocks mined after it.
  const latest = await state.client.getBlockNumber({ cacheTime: 0 });
  let from = state.config.startBlock < 0n ? 0n : state.config.startBlock;
  const logs = [];
  if (from > latest) return logs;
  while (from <= latest) {
    const to = from + LOG_SPAN - 1n <= latest ? from + LOG_SPAN - 1n : latest;
    const batch = await state.client.getLogs({
      address: state.config.address,
      event,
      args,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...batch);
    if (to === latest) break;
    from = to + 1n;
  }
  return logs;
}

export async function findPaid(state, id) {
  const logs = await scanLogs(state, paidEvent, { id });
  return logs.length > 0 ? logs[logs.length - 1] : null;
}

export async function paidIdsForPayer(state, payer) {
  const logs = await scanLogs(state, paidEvent, { payer });
  const ids = [];
  const seen = new Set();
  for (let index = logs.length - 1; index >= 0 && ids.length < 100; index -= 1) {
    const id = logs[index].args.id;
    const key = id.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }
  return ids;
}

export async function allowanceRows(state, payee) {
  const sets = await scanLogs(state, allowanceSetEvent, { payee });
  const spenders = [];
  const seen = new Set();
  for (const log of sets) {
    const spender = getAddress(log.args.spender);
    if (seen.has(spender)) continue;
    seen.add(spender);
    spenders.push(spender);
  }
  const rows = [];
  for (const spender of spenders.slice(0, 50)) {
    const raw = await read(state, "allowances", [payee, spender]);
    const allowance = asRecord(raw, ["remaining", "expiry", "set", "revoked"]);
    if (!allowance.set) continue;
    rows.push({
      spender,
      remaining: allowance.remaining.toString(),
      expiry: allowance.expiry.toString(),
      revoked: Boolean(allowance.revoked),
    });
  }
  return rows;
}

export async function publicMeta(state) {
  const meta = await loadMeta(state);
  return {
    chainId: state.config.chainId,
    contract: state.config.address,
    token: getAddress(meta.token),
    symbol: meta.symbol,
    feeBps: Number(meta.feeBps),
    nativeSymbol: "tQDAY",
  };
}

export function txBody(state, data, summary, to = state.config.address) {
  return {
    chainId: state.config.chainId,
    to,
    data,
    value: "0",
    summary,
  };
}

// Testnet only. MockUSD8.mint is public so a new payer can fund a wallet
// without leaving the app. A token without a public mint will revert.
export function encodeMint(to, amount) {
  return encodeFunctionData({ abi: tokenAbi, functionName: "mint", args: [to, amount] });
}

export function encodeRegister(name) {
  return encodeFunctionData({ abi: ciroAbi, functionName: "register", args: [name] });
}

export function encodeCreate(amount, memo, due) {
  return encodeFunctionData({ abi: ciroAbi, functionName: "create", args: [amount, memo, due] });
}

export function encodePay(id, name, fromAllowance) {
  return encodeFunctionData({
    abi: ciroAbi,
    functionName: fromAllowance ? "payFromAllowance" : "pay",
    args: [id, name],
  });
}

export function encodeAllow(spender, cap, expiry) {
  return encodeFunctionData({ abi: ciroAbi, functionName: "allow", args: [spender, cap, expiry] });
}

export function encodeRevoke(spender) {
  return encodeFunctionData({ abi: ciroAbi, functionName: "revoke", args: [spender] });
}

export async function buildPay(state, id, name, fromAllowance, spender) {
  const meta = await loadMeta(state);
  const inv = await readInvoice(state, id);
  const now = await chainNow(state);
  if (inv.paidAt !== 0n) throw new ApiError(409, "already_paid");
  if (now > inv.due) throw new ApiError(409, "past_due");
  const result = await matchInvoice(state, id, name);
  if (result !== "exact") throw new ApiError(409, "name_mismatch", { result });

  if (fromAllowance && spender) {
    const raw = await read(state, "allowances", [inv.payee, spender]);
    const allowance = asRecord(raw, ["remaining", "expiry", "set", "revoked"]);
    if (!allowance.set) throw new ApiError(409, "no_allowance");
    if (allowance.revoked) throw new ApiError(409, "allowance_revoked");
    if (now > allowance.expiry) throw new ApiError(409, "allowance_expired");
    if (allowance.remaining < inv.amount) throw new ApiError(409, "cap_exceeded");
  }

  const fee = feeOf(inv.amount, meta.feeBps);
  const summary = paySummary(id, inv.amount, fee, meta.symbol);
  const tx = txBody(state, encodePay(id, name, fromAllowance), summary);
  tx.approvals = [];
  if (spender) {
    let current = 0n;
    try {
      current = await state.client.readContract({
        address: meta.token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [spender, state.config.address],
      });
    } catch {
      current = 0n;
    }
    for (const amount of approvalAmounts(current, inv.amount)) {
      tx.approvals.push({
        chainId: state.config.chainId,
        to: getAddress(meta.token),
        data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [state.config.address, amount] }),
        value: "0",
        summary: approveSummary(amount, meta.symbol),
      });
    }
  }
  return tx;
}
