import assert from "node:assert/strict";
import test from "node:test";
import { payDecision } from "../src/pay-state.js";

const ready = {
  status: "open",
  result: "exact",
  connected: true,
  chainMatches: true,
  gasKnown: true,
  gasEnough: true,
  tokenKnown: true,
  tokenEnough: true,
};

test("only an exact ready payment exposes pay", () => {
  assert.equal(payDecision(ready).action, "pay");
  assert.equal(payDecision({ ...ready, result: "close" }).action, "close");
  assert.equal(payDecision({ ...ready, result: "none" }).action, "none");
  assert.equal(payDecision({ ...ready, result: null }).action, "type");
});

test("exact still does not pay on the wrong chain or an empty wallet", () => {
  assert.equal(payDecision({ ...ready, connected: false }).action, "connect");
  assert.equal(payDecision({ ...ready, chainMatches: false }).action, "switch");
  assert.equal(payDecision({ ...ready, gasEnough: false }).action, "need-gas");
  assert.equal(payDecision({ ...ready, tokenEnough: false }).action, "need-token");
  assert.equal(payDecision({ ...ready, status: "past_due" }).action, "closed");
  assert.equal(payDecision({ ...ready, status: "paid" }).action, "paid");
});

test("an unknown balance does not pretend the wallet is empty", () => {
  assert.equal(payDecision({ ...ready, tokenKnown: false, tokenEnough: false }).action, "pay");
  assert.equal(payDecision({ ...ready, gasKnown: false, gasEnough: false }).action, "pay");
});
