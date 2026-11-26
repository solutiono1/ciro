import test from "node:test";
import assert from "node:assert/strict";
import { handleFaucet } from "../src/faucet.js";

const KEY = `0x${"11".repeat(32)}`;
const BASE = {
  CIRO_FAUCET_KEY: KEY,
  CIRO_RPC_URL: "http://127.0.0.1:1",
  CIRO_FAUCET_CHAIN_ID: "44005",
};

test("faucet is offline without a key", async () => {
  const result = await handleFaucet({}, { address: "0x1111111111111111111111111111111111111111" });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "faucet_offline");
});

test("faucet rejects a bad address before touching the chain", async () => {
  const result = await handleFaucet(BASE, { address: "not-an-address" });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "bad_address");
});

test("faucet refuses a non-Aevum chain", async () => {
  const result = await handleFaucet({ ...BASE, CIRO_FAUCET_CHAIN_ID: "1" }, { address: "0x1111111111111111111111111111111111111111" });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "faucet_offline");
});

test("faucet fails closed when the RPC is unreachable", async () => {
  const result = await handleFaucet(BASE, { address: "0x1111111111111111111111111111111111111111" });
  assert.equal(result.status, 502);
  assert.equal(result.body.error, "faucet_failed");
});
