import assert from "node:assert/strict";
import test from "node:test";
import { feeOf, formatFee, formatUnits, parseHuman } from "../src/money.js";
import { fold, isEmptyName } from "../src/normalize.js";

test("human amounts use 6 decimals", () => {
  assert.equal(parseHuman("100"), 100_000_000n);
  assert.equal(parseHuman("1"), 1_000_000n);
  assert.equal(parseHuman("0.000001"), 1n);
  assert.equal(parseHuman("1.5"), 1_500_000n);
  assert.equal(formatUnits(100_000_000n), "100.000000");
  assert.equal(formatUnits(1_000_000n), "1.000000");
  assert.throws(() => parseHuman("1.2345678"));
  assert.throws(() => parseHuman("1e6"));
});

test("fee matches the contract integer division", () => {
  assert.equal(feeOf(1_000_000n, 50), 5_000n);
  assert.equal(feeOf(100_000_000n, 0), 0n);
  assert.equal(formatFee(0n), "0");
  assert.equal(formatFee(5_000n), "0.005000");
});

test("fold matches the contract rules used by the pay tests", () => {
  assert.equal(Buffer.from(fold("  elena   rossi! ")).toString("utf8"), "elena rossi");
  assert.equal(Buffer.from(fold("Elena Rossi")).toString("utf8"), "elena rossi");
  assert.equal(isEmptyName("   !!!"), true);
  assert.equal(isEmptyName("Ada"), false);
  assert.equal(Buffer.from(fold("elena-rossi")).toString("utf8"), "elenarossi");
});
