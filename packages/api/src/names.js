import { encodeEventTopics, getAddress, parseAbiItem } from "viem";
import { fold } from "../../shared/src/normalize.js";
import { ApiError } from "./errors.js";
import { eventLogs, read } from "./chain.js";
import { isLegacyTestAddress } from "./legacy.js";

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
      hidden: isLegacyTestAddress(entry.address),
    });
  }));

  rows.sort((a, b) => a.folded.localeCompare(b.folded)
    || (b.registeredAt || 0) - (a.registeredAt || 0)
    || a.address.localeCompare(b.address));
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
  const matches = rows.filter((row) => row.folded === folded);
  // Prefer a current, non-legacy owner for the address the UI shows. An owner
  // can still re-register their own name, including a legacy test owner.
  const owner = matches.find((row) => !row.hidden) || matches[0] || null;
  const ownedByYou = Boolean(account && matches.some((row) => sameAddress(row.address, account)));
  const available = matches.length === 0 || ownedByYou;
  return {
    name,
    folded,
    available,
    owner: owner?.address ?? null,
    ownedByYou,
    owners: matches.length,
    suggestions: available ? [] : suggestionsFor(name, rows),
  };
}

export async function nameList(state) {
  const rows = await nameDirectory(state);
  // Group by folded name. The newest visible registration is the canonical
  // row; legacy test rows stay taken but are not listed. A name with no
  // visible owner is omitted from the public directory.
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.folded) || [];
    group.push(row);
    groups.set(row.folded, group);
  }
  const names = [];
  for (const group of groups.values()) {
    const canonical = group.find((row) => !row.hidden);
    if (!canonical) continue;
    names.push({
      address: canonical.address,
      name: canonical.name,
      folded: canonical.folded,
      registeredAt: canonical.registeredAt,
      owners: group.length,
    });
  }
  names.sort((a, b) => a.folded.localeCompare(b.folded));
  return {
    names,
    total: names.length,
    hidden: rows.length - names.length,
  };
}
