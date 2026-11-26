// Lightweight API telemetry. Cloudflare KV stores one short-lived key per
// request with the path, status, and latency in the key metadata. The stats
// endpoint lists the metadata, so it never reads a value and never needs a
// database. Without the CIRO_STATS binding the API still works; the dashboard
// simply says telemetry is not configured.
const DAY_SECONDS = 24 * 60 * 60;
const RETENTION_SECONDS = 14 * DAY_SECONDS;
const MAX_PAGES = 5;

export function telemetryEnabled(env) {
  return Boolean(env?.CIRO_STATS);
}

export async function recordRequest(env, entry) {
  const kv = env?.CIRO_STATS;
  if (!kv) return;
  const at = Number(entry.at) || Date.now();
  const day = new Date(at).toISOString().slice(0, 10);
  const key = `req:${day}:${at}:${Math.random().toString(36).slice(2, 10)}`;
  const metadata = {
    p: String(entry.path || "/").slice(0, 120),
    m: String(entry.method || "GET").slice(0, 8),
    s: Number(entry.status) || 0,
    ms: Math.max(0, Math.min(Number(entry.ms) || 0, 600_000)),
    e: entry.error ? String(entry.error).slice(0, 64) : null,
    t: at,
  };
  // The caller schedules this with waitUntil, so the response does not wait
  // for the KV write. A failed write only loses one row of telemetry.
  await kv.put(key, "", { metadata, expirationTtl: RETENTION_SECONDS }).catch(() => {});
}

function dayKeys(days) {
  const out = [];
  const now = Date.now();
  for (let index = 0; index < days; index += 1) {
    out.push(new Date(now - index * DAY_SECONDS * 1000).toISOString().slice(0, 10));
  }
  return out;
}

async function listDay(kv, day) {
  const rows = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await kv.list({ prefix: `req:${day}:`, cursor, limit: 1000 });
    for (const key of result.keys) {
      if (key.metadata) rows.push(key.metadata);
    }
    if (result.list_complete || !result.cursor) break;
    cursor = result.cursor;
  }
  return rows;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export async function readTelemetry(env, days = 2) {
  if (!telemetryEnabled(env)) return { configured: false };
  const rows = [];
  for (const day of dayKeys(days)) {
    try {
      rows.push(...await listDay(env.CIRO_STATS, day));
    } catch {
      // A KV read failure must not take down the dashboard.
    }
  }
  const total = rows.length;
  const errors = rows.filter((row) => row.s >= 400);
  const latencies = rows.map((row) => row.ms).filter((value) => Number.isFinite(value));
  const byStatus = {};
  const byPath = {};
  for (const row of rows) {
    byStatus[row.s] = (byStatus[row.s] || 0) + 1;
    byPath[row.p] = (byPath[row.p] || 0) + 1;
  }
  const recentErrors = errors
    .sort((a, b) => b.t - a.t)
    .slice(0, 12)
    .map((row) => ({ path: row.p, method: row.m, status: row.s, ms: row.ms, error: row.e, at: row.t }));
  const faucetEmpty = rows.filter((row) => row.e === "faucet_empty").length;
  const faucetClaims = rows.filter((row) => row.p === "/v1/faucet" && row.s === 200).length;
  const failedPayments = rows.filter((row) => row.p.startsWith("/v1/tx/pay") && row.s >= 400).length;
  return {
    configured: true,
    days,
    requests: total,
    errors: errors.length,
    errorRate: total ? errors.length / total : 0,
    avgMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
    p95Ms: percentile(latencies, 0.95),
    byStatus,
    byPath,
    wrongName: rows.filter((row) => row.e === "name_mismatch").length,
    failedPayments,
    faucetClaims,
    faucetEmpty,
    faucetEmptyRate: faucetClaims + faucetEmpty ? faucetEmpty / (faucetClaims + faucetEmpty) : 0,
    recentErrors,
  };
}
