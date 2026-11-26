import { encodeEventTopics, getAddress, parseAbiItem } from "viem";
import { fold } from "../../shared/src/normalize.js";
import { ApiError } from "./errors.js";
import { eventLogs, read } from "./chain.js";

// The v1 contract stores a name per address but cannot make the folded name
// unique across addresses. The app adds that rule for every registration it
// prepares, and the v2 contract makes it enforceable on chain. The directory
// is read from Registered events, so it needs no database and no API key.
const registeredEvent = parseAbiItem("event Registered(address indexed payee, bytes32 nameHash)");
const registeredTopic = encodeEventTopics({ abi: [registeredEvent] })[0];
const CACHE_MS = 10_000;
const MAX_SUGGESTIONS = 3;

export function foldedName(name) {
  return new TextDecoder().decode(fold(name));
}

function sameAddress(a, b) {
  return Boolean(a && b) && getAddress(a) === getAddress(b);
}

function activeOf(record) {
  if (Array.isArray(record)) return Boolean(record[4]);
  return Boolean(record?.active);
}

export async function nameDirectory(state) {
  if (state.nameCache && Date.now() - state.nameCache.at < CACHE_MS) return state.nameCache.rows;

  const logs = await eventLogs(state, registeredTopic, registeredEvent);
  // Keep the newest registration per address. Re-registering replaces the
  // display name without creating a second owner.
  const newest = new Map();
  for (const log of logs) {
    const address = getAddress(log.args.payee);
    const previous = newest.get(address);
    const at = log.timestamp ?? 0;
    if (!previous || at >= (previous.at ?? 0)) {
      newest.set(address, { address, at, blockNumber: log.blockNumber });
    }
  }

  const rows = [];
  await Promise.all([...newest.values()].map(async (entry) => {
    const [record, name] = await Promise.all([
      read(state, "payees", [entry.address]),
      read(state, "displayName", [entry.address]),
    ]);
    if (!activeOf(record) || typeof name !== "string") return;
    const folded = foldedName(name);
    if (!folded) return;
    rows.push({
      address: entry.address,
      name,
      folded,
      registeredAt: entry.at || null,
    });
  }));

  rows.sort((a, b) => a.folded.localeCompare(b.folded) || a.address.localeCompare(b.address));
  state.nameCache = { at: Date.now(), rows };
  return rows;
}

function suggestionCandidates(name) {
  const clean = String(name).replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  const first = words[0] || "name";
  const rest = words.slice(1).join(" ");
  const joined = words.join("");
  const candidates = [
    `${clean} 2`,
    `${clean} 7`,
    `${clean} Studio`,
    `${first}-${rest || "pay"}`,
    joined,
    `the ${clean}`,
  ];
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const value = candidate.replace(/\s+/g, " ").trim().slice(0, 64);
    const folded = foldedName(value);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    out.push(value);
    if (out.length >= MAX_SUGGESTIONS * 2) break;
  }
  return out;
}

export function suggestionsFor(name, rows) {
  const taken = new Set(rows.map((row) => row.folded));
  const out = [];
  for (const candidate of suggestionCandidates(name)) {
    if (taken.has(foldedName(candidate))) continue;
    out.push(candidate);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

export async function checkName(state, name, account = null) {
  const folded = foldedName(name);
  if (!folded) throw new ApiError(400, "empty_name");
  const rows = await nameDirectory(state);
  const owner = rows.find((row) => row.folded === folded) || null;
  const available = !owner || sameAddress(owner.address, account);
  return {
    name,
    folded,
    available,
    owner: owner?.address ?? null,
    ownedByYou: Boolean(owner && account && sameAddress(owner.address, account)),
    suggestions: available ? [] : suggestionsFor(name, rows),
  };
}

export async function nameList(state) {
  const rows = await nameDirectory(state);
  return {
    names: rows.map((row) => ({
      address: row.address,
      name: row.name,
      folded: row.folded,
      registeredAt: row.registeredAt,
    })),
    total: rows.length,
  };
}
