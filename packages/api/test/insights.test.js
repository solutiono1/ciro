import assert from "node:assert/strict";
import test from "node:test";
import { sendUnsigned, startFixture } from "../support/fixture.js";

const DUE = BigInt(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60);

test("the directory keeps one current owner per folded name", async (t) => {
  const fx = await startFixture();
  t.after(() => fx.stop());
  const owner = fx.accounts[1].address;
  const other = fx.accounts[2].address;

  let res = await fx.api("POST", "/v1/tx/register", { name: "Elena Rossi", address: owner });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  await sendUnsigned(fx.signer(1), fx.publicClient, res.json);

  res = await fx.api("POST", "/v1/names/check", { name: "  elena   rossi! ", address: owner });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.folded, "elena rossi");
  assert.equal(res.json.available, true);
  assert.equal(res.json.ownedByYou, true);

  res = await fx.api("POST", "/v1/names/check", { name: "Elena Rossi", address: other });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.available, false);
  assert.equal(res.json.owner, owner);
  assert.ok(res.json.suggestions.length > 0);
  assert.equal(res.json.suggestions.some((name) => name.toLowerCase() === "elena rossi"), false);

  res = await fx.api("POST", "/v1/tx/register", { name: "Elena Rossi", address: other });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.error, "name_taken");
  assert.ok(res.json.suggestions.length > 0);

  res = await fx.api("GET", "/v1/names");
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.total, 1);
  assert.equal(res.json.names[0].name, "Elena Rossi");
  assert.equal(res.json.names[0].address, owner);
});

test("stats and diagnostics read the chain without a database", async (t) => {
  const fx = await startFixture();
  t.after(() => fx.stop());
  const payee = fx.accounts[1].address;
  const payer = fx.accounts[2].address;

  let res = await fx.api("POST", "/v1/tx/register", { name: "Elena Rossi", address: payee });
  await sendUnsigned(fx.signer(1), fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/tx/invoice", {
    amount: "200000",
    reference: "Demo invoice",
    due: DUE.toString(),
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  await sendUnsigned(fx.signer(1), fx.publicClient, res.json);
  await fx.mint(2, 1_000_000n);
  res = await fx.api("POST", "/v1/tx/pay", { id: "1", name: "Elena Rossi", payer });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  await sendUnsigned(fx.signer(2), fx.publicClient, res.json.approvals[0]);
  await sendUnsigned(fx.signer(2), fx.publicClient, res.json);

  res = await fx.api("GET", "/v1/stats");
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.users.total, 1);
  assert.equal(res.json.invoices.total, 1);
  assert.equal(res.json.invoices.paid, 1);
  assert.equal(res.json.invoices.open, 0);
  assert.equal(res.json.invoices.conversion, 1);
  assert.equal(res.json.invoices.paidVolume, "200000");
  assert.equal(res.json.invoices.paidVolumeDisplay, "0.200000");
  assert.equal(res.json.invoices.fee, "0");
  assert.equal(res.json.recent.payments.length, 1);
  assert.equal(res.json.recent.payments[0].payer, payer);
  assert.equal(res.json.faucet.configured, false);
  assert.equal(res.json.api.configured, false);

  res = await fx.api("GET", "/v1/diagnostics");
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const byId = Object.fromEntries(res.json.checks.map((check) => [check.id, check]));
  assert.equal(byId.rpc.level, "ok");
  assert.equal(byId.contract.level, "ok");
  assert.equal(byId.token.level, "ok");
  assert.equal(byId.api.level, "ok");
  assert.equal(byId.explorer.level, "warn");
  assert.equal(res.json.overall, "warn");
  assert.equal(res.json.config.chainId, 31337);
});
