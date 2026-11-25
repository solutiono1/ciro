import test from "node:test";
import assert from "node:assert/strict";
import { connect, disconnect, refreshWallet } from "../src/wallet.js";
import { session } from "../src/session.js";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
let revokeFails = false;
const store = new Map();
const ethereum = {
  async request({ method }) {
    if (method === "eth_accounts" || method === "eth_requestAccounts") return [ACCOUNT];
    if (method === "eth_chainId") return "0xabe5";
    if (method === "wallet_revokePermissions") {
      if (revokeFails) throw new Error("wallet does not support revoke");
      return null;
    }
    throw new Error(`unsupported ${method}`);
  },
  on() {},
  removeListener() {},
};

globalThis.window = { ethereum };
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

function reset() {
  store.clear();
  revokeFails = false;
  session.account = null;
  session.chainId = null;
  session.payee = null;
}

test("an explicit disconnect blocks auto-reconnect even when eth_accounts still returns the account", async () => {
  reset();
  await connect();
  assert.equal(session.account, ACCOUNT);

  await disconnect();
  assert.equal(session.account, null);
  assert.equal(store.get("ciro.walletDisconnected"), "1");

  // This is the regression: the wallet keeps returning the old account.
  await refreshWallet();
  assert.equal(session.account, null, "refreshWallet must not re-add a disconnected wallet");

  // Only an explicit Connect clears the intent.
  await connect();
  assert.equal(session.account, ACCOUNT);
  assert.equal(store.has("ciro.walletDisconnected"), false);

  await refreshWallet();
  assert.equal(session.account, ACCOUNT);
});

test("a wallet without revoke support cannot silently reattach", async () => {
  reset();
  revokeFails = true;
  await disconnect();
  assert.equal(session.account, null);

  await refreshWallet();
  assert.equal(session.account, null);

  await connect();
  assert.equal(session.account, ACCOUNT);
});
