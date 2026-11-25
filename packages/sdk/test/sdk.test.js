import assert from "node:assert/strict";
import test from "node:test";
import { startFixture, sendUnsigned } from "../../api/support/fixture.js";
import { CiroError, createClient } from "../src/index.js";

test("the sdk reads and prepares against a local chain", async (t) => {
  const fx = await startFixture();
  t.after(() => fx.stop());

  const client = createClient({ apiUrl: fx.apiUrl });

  const meta = await client.meta();
  assert.equal(meta.chainId, 31337);
  assert.equal(meta.symbol, "tUSD8");

  const reg = await client.prepareRegister("Elena Rossi");
  assert.equal(reg.summary, 'Register "Elena Rossi"');
  await sendUnsigned(fx.signer(1), fx.publicClient, reg);

  const payee = fx.accounts[1].address;
  const who = await client.payee(payee);
  assert.equal(who.registered, true);
  assert.equal(who.name, "Elena Rossi");

  assert.equal((await client.check(payee, "elena  rossi")).result, "exact");
  assert.equal((await client.check(payee, "Elena Rossio")).result, "close");

  await assert.rejects(
    () => client.invoice(99),
    (err) => err instanceof CiroError && err.code === "unknown_invoice",
  );
});
