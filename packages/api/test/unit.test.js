import assert from "node:assert/strict";
import test from "node:test";
import { approvalAmounts } from "../src/approval.js";
import { paySummary } from "../src/summary.js";

test("pay summary matches the documented shape", () => {
  assert.equal(paySummary(4n, 100_000_000n, 0n, "tUSD8"), "Pay invoice 4, 100.000000 tUSD8, fee 0");
  assert.equal(paySummary(1n, 1_000_000n, 5_000n, "tUSD8"), "Pay invoice 1, 1.000000 tUSD8, fee 0.005000");
});

test("approval resets a non-zero allowance before setting the exact amount", () => {
  assert.deepEqual(approvalAmounts(0n, 1_000_000n), [1_000_000n]);
  assert.deepEqual(approvalAmounts(1_000_000n, 1_000_000n), []);
  assert.deepEqual(approvalAmounts(2_000_000n, 1_000_000n), []);
  assert.deepEqual(approvalAmounts(1n, 1_000_000n), [0n, 1_000_000n]);
});
