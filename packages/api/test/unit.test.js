import assert from "node:assert/strict";
import test from "node:test";
import { approvalAmounts } from "../src/approval.js";
import { paySummary } from "../src/summary.js";
import { readTelemetry, recordRequest, telemetryEnabled } from "../src/telemetry.js";

test("pay summary matches the documented shape", () => {
  assert.equal(paySummary(4n, 100_000_000n, 0n, "tUSD8"), "Pay invoice 4, 100.000000 tUSD8, fee 0");
  assert.equal(paySummary(1n, 1_000_000n, 5_000n, "tUSD8"), "Pay invoice 1, 1.000000 tUSD8, fee 0.005000");
});

test("approval resets a non-zero allowance before setting the exact amount", () => {
  assert.deepEqual(approvalAmounts(0n, 1_000_000n), [1_000_000n]);
  assert.deepEqual(approvalAmounts(1_000_000n, 1_000_000n), []);
  assert.deepEqual(approvalAmounts(2_000_000n, 1_000_000n), [0n, 1_000_000n]);
  assert.deepEqual(approvalAmounts(1n, 1_000_000n), [0n, 1_000_000n]);
});

test("telemetry stores metadata and summarizes errors without invoice data", async () => {
  const rows = new Map();
  const kv = {
    async put(key, value, options) {
      assert.equal(value, "");
      rows.set(key, options.metadata);
    },
    async list({ prefix }) {
      const keys = [...rows.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([name, metadata]) => ({ name, metadata }));
      return { keys, list_complete: true };
    },
  };
  const env = { CIRO_STATS: kv };
  assert.equal(telemetryEnabled(env), true);
  assert.equal(telemetryEnabled({}), false);

  await recordRequest(env, { path: "/v1/tx/pay", method: "POST", status: 409, ms: 12, error: "name_mismatch" });
  await recordRequest(env, { path: "/v1/faucet", method: "POST", status: 200, ms: 800 });
  await recordRequest(env, { path: "/v1/faucet", method: "POST", status: 409, ms: 20, error: "faucet_empty" });
  await recordRequest(env, { path: "/v1/invoices/1", method: "GET", status: 500, ms: 30, error: "chain_unavailable" });

  const summary = await readTelemetry(env);
  assert.equal(summary.configured, true);
  assert.equal(summary.requests, 4);
  assert.equal(summary.errors, 3);
  assert.equal(summary.wrongName, 1);
  assert.equal(summary.failedPayments, 1);
  assert.equal(summary.faucetClaims, 1);
  assert.equal(summary.faucetEmpty, 1);
  assert.equal(summary.faucetEmptyRate, 0.5);
  assert.equal(summary.recentErrors.length, 3);
  assert.equal(summary.byPath["/v1/faucet"], 2);
});
