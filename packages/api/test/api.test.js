import assert from "node:assert/strict";
import test from "node:test";
import { getAddress, keccak256 } from "viem";
import { ciroAbi, tokenAbi } from "../src/abi.js";
import { sendUnsigned, startFixture } from "../support/fixture.js";
import { fold } from "../../shared/src/normalize.js";

const DUE = BigInt(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60);

test("api prepares unsigned transactions and refuses a close name", async (t) => {
  const fx = await startFixture();
  t.after(() => fx.stop());
  const payee = fx.signer(1);
  const payer = fx.signer(2);
  const agent = fx.signer(4);
  const payeeAddress = fx.accounts[1].address;
  const payerAddress = fx.accounts[2].address;
  const agentAddress = fx.accounts[4].address;

  let res = await fx.api("POST", "/v1/tx/register", { name: "   !!!" });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "empty_name");
  assert.equal("data" in res.json, false);

  res = await fx.api("POST", "/v1/tx/register", { name: "Ada Okonkwo" });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.summary, 'Register "Ada Okonkwo"');
  assert.equal(res.json.value, "0");
  await sendUnsigned(payee, fx.publicClient, res.json);

  const stored = await fx.publicClient.readContract({
    address: fx.ciro,
    abi: ciroAbi,
    functionName: "payees",
    args: [payeeAddress],
  });
  const nameHash = stored.nameHash ?? stored[0];
  assert.equal(nameHash, keccak256(fold("Ada Okonkwo")));

  res = await fx.api("GET", `/v1/payees/${payeeAddress.toLowerCase()}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.registered, true);
  assert.equal(res.json.name, "Ada Okonkwo");

  res = await fx.api("POST", "/v1/check", { payee: payeeAddress, name: "  ada   okonkwo! " });
  assert.equal(res.json.result, "exact");
  res = await fx.api("POST", "/v1/check", { payee: payeeAddress, name: "Ada Okonkwa" });
  assert.equal(res.json.result, "close");
  res = await fx.api("POST", "/v1/check", { payee: payeeAddress, name: "Bob" });
  assert.equal(res.json.result, "none");

  const freshAddress = fx.accounts[3].address;
  res = await fx.api("POST", "/v1/tx/faucet", { address: freshAddress });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.to, getAddress(fx.token));
  assert.equal(res.json.summary, `Mint 1000.000000 tUSD8 to ${freshAddress} on testnet`);
  await sendUnsigned(fx.signer(3), fx.publicClient, res.json);
  const minted = await fx.publicClient.readContract({
    address: fx.token,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [freshAddress],
  });
  assert.equal(minted, 1_000_000_000n);

  res = await fx.api("POST", "/v1/tx/invoice", {
    amount: "1000000",
    reference: "March design",
    due: DUE.toString(),
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  await sendUnsigned(payee, fx.publicClient, res.json);

  res = await fx.api("GET", "/v1/invoices/1");
  assert.equal(res.json.reference, "March design");
  assert.equal(res.json.payeeName, "Ada Okonkwo");
  assert.equal(res.json.amount, "1000000");
  assert.equal(res.json.status, "open");
  assert.equal(res.json.payer, null);

  res = await fx.api("GET", `/v1/payees/${payeeAddress}/invoices`);
  assert.equal(res.json.invoices.length, 1);
  assert.equal(res.json.truncated, false);

  res = await fx.api("GET", "/v1/receipts/1");
  assert.equal(res.status, 404);
  assert.equal(res.json.error, "not_paid");

  res = await fx.api("POST", "/v1/tx/pay", { id: "1", name: "Ada Okonkwa", payer: payerAddress });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, "name_mismatch");
  assert.equal(res.json.result, "close");
  assert.equal("data" in res.json, false);

  res = await fx.api("GET", "/v1/invoices/99");
  assert.equal(res.status, 404);
  assert.equal(res.json.error, "unknown_invoice");

  await fx.mint(2, 1_000_000n);
  res = await fx.api("POST", "/v1/tx/pay", { id: "1", name: "  ada   okonkwo! ", payer: payerAddress });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.summary, "Pay invoice 1, 1.000000 tUSD8, fee 0");
  assert.equal(res.json.approvals.length, 1);
  await sendUnsigned(payer, fx.publicClient, res.json.approvals[0]);
  const paid = await sendUnsigned(payer, fx.publicClient, res.json);

  res = await fx.api("GET", "/v1/receipts/1");
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.transactionHash, paid.transactionHash);
  assert.equal(res.json.payeeName, "Ada Okonkwo");
  assert.equal(res.json.fee, "0");
  assert.equal(res.json.net, "1000000");
  assert.equal(res.json.netDisplay, "1.000000");
  assert.equal(res.json.payer, payerAddress);

  res = await fx.api("GET", `/v1/payers/${payerAddress}/receipts`);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.receipts.length, 1);
  assert.equal(res.json.receipts[0].id, "1");
  assert.equal(res.json.receipts[0].net, "1000000");

  res = await fx.api("POST", "/v1/tx/invoice", {
    amount: "1",
    reference: "x",
    due: "18446744073709551615",
  });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "bad_due");

  res = await fx.api("GET", `/v1/invoices/${(2n ** 256n).toString()}`);
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "bad_request");

  res = await fx.api("POST", "/v1/tx/allow", { spender: agentAddress, cap: "0", expiry: DUE.toString() });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "bad_amount");

  res = await fx.api("POST", "/v1/tx/allow", { spender: agentAddress, cap: "1000000", expiry: "1" });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.error, "past_due");

  res = await fx.api("POST", "/v1/tx/register", { name: "Ada\nOkonkwo" });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "bad_request");

  res = await fx.api("POST", "/v1/tx/register", { name: "José" });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "bad_request");

  res = await fx.api("POST", "/v1/tx/invoice", {
    amount: "1",
    reference: "bad\u001b[2J",
    due: DUE.toString(),
  });
  assert.equal(res.status, 400, JSON.stringify(res.json));
  assert.equal(res.json.error, "bad_request");

  const payerBalance = await fx.publicClient.readContract({
    address: fx.token,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [payerAddress],
  });
  assert.equal(payerBalance, 0n);

  res = await fx.api("POST", "/v1/tx/register", { name: "Ada Mensah" });
  await sendUnsigned(payee, fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/invoices/1/check", { name: "Ada Okonkwo" });
  assert.equal(res.json.result, "exact");
  res = await fx.api("POST", "/v1/invoices/1/check", { name: "Ada Mensah" });
  assert.equal(res.json.result, "none");
  res = await fx.api("POST", "/v1/check", { payee: payeeAddress, name: "Ada Mensah" });
  assert.equal(res.json.result, "exact");

  res = await fx.api("POST", "/v1/tx/invoice", { amount: "500000", reference: "retainer", due: DUE.toString() });
  await sendUnsigned(payee, fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/tx/allow", {
    spender: agentAddress,
    cap: "500000",
    expiry: DUE.toString(),
  });
  await sendUnsigned(payee, fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/tx/revoke", { spender: agentAddress });
  await sendUnsigned(payee, fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/tx/pay-from-allowance", {
    id: "2",
    name: "Ada Mensah",
    spender: agentAddress,
  });
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.error, "allowance_revoked");
  assert.equal("data" in res.json, false);

  res = await fx.api("POST", "/v1/tx/allow", {
    spender: agentAddress,
    cap: "500000",
    expiry: DUE.toString(),
  });
  await sendUnsigned(payee, fx.publicClient, res.json);
  await fx.mint(4, 500_000n);
  res = await fx.api("POST", "/v1/tx/pay-from-allowance", {
    id: "2",
    name: "Ada Mensah",
    spender: agentAddress,
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  for (const approval of res.json.approvals) await sendUnsigned(agent, fx.publicClient, approval);
  await sendUnsigned(agent, fx.publicClient, res.json);

  res = await fx.api("POST", "/v1/tx/invoice", { amount: "1", reference: "over cap", due: DUE.toString() });
  await sendUnsigned(payee, fx.publicClient, res.json);
  res = await fx.api("POST", "/v1/tx/pay-from-allowance", {
    id: "3",
    name: "Ada Mensah",
    spender: agentAddress,
  });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, "cap_exceeded");

  res = await fx.api("GET", "/v1/meta");
  assert.equal(res.status, 200);
  assert.equal(res.json.chainId, 31337);
  assert.equal(getAddress(res.json.token), getAddress(fx.token));
  assert.equal(res.json.feeBps, 0);
  assert.equal(res.json.symbol, "tUSD8");

  res = await fx.api("GET", `/v1/payers/${payerAddress}/receipts`);
  assert.equal(res.json.receipts.length, 1);
  assert.equal(res.json.receipts[0].id, "1");

  res = await fx.api("GET", `/v1/payees/${payeeAddress}/allowances`);
  assert.equal(res.json.allowances.length, 1);
  assert.equal(res.json.allowances[0].spender, agentAddress);
  assert.equal(res.json.allowances[0].remaining, "0");
  assert.equal(res.json.allowances[0].revoked, false);
});
