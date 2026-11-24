import assert from "node:assert/strict";
import test from "node:test";
import { encodeFunctionData } from "viem";
import { ciroAbi, tokenAbi } from "../../packages/api/src/abi.js";
import { verifyStep } from "../src/tx-guard.js";

const deployment = {
  chainId: 44005,
  contract: "0x4aceb37ecace160b4363111460020c2d088c529c",
  token: "0x456569838f1d43009a91eba4263147afd7233483",
};
const contract = deployment.contract;
const token = deployment.token;

const step = (to, data, chainId = 44005) => ({ to, data, chainId, value: "0" });
const ciro = (functionName, args) => encodeFunctionData({ abi: ciroAbi, functionName, args });
const tokenCall = (functionName, args) => encodeFunctionData({ abi: tokenAbi, functionName, args });

test("the pay step must match the invoice and the typed name", () => {
  const data = ciro("pay", [1n, "Ada Okonkwo"]);
  assert.doesNotThrow(() => verifyStep(step(contract, data), deployment, { kind: "pay", id: "1", name: "Ada Okonkwo" }));
  assert.throws(() => verifyStep(step(contract, data), deployment, { kind: "pay", id: "2", name: "Ada Okonkwo" }), /invoice/);
  assert.throws(() => verifyStep(step(contract, data), deployment, { kind: "pay", id: "1", name: "Ada Okonkwa" }), /name/);
  assert.throws(() => verifyStep(step(contract, data), deployment, { kind: "approve", amount: "1000000" }), /different action/);
});

test("payFromAllowance is not accepted by the direct pay page", () => {
  const data = ciro("payFromAllowance", [1n, "Ada Okonkwo"]);
  assert.throws(() => verifyStep(step(contract, data), deployment, { kind: "pay", id: "1", name: "Ada Okonkwo" }), /does not use/);
});

test("an approval must target Ciro and the invoice amount", () => {
  const exact = tokenCall("approve", [contract, 1_000_000n]);
  const reset = tokenCall("approve", [contract, 0n]);
  assert.doesNotThrow(() => verifyStep(step(token, exact), deployment, { kind: "approve", amount: "1000000" }));
  assert.doesNotThrow(() => verifyStep(step(token, reset), deployment, { kind: "approve", amount: "1000000" }));

  const wrongAmount = tokenCall("approve", [contract, 9_000_000n]);
  assert.throws(() => verifyStep(step(token, wrongAmount), deployment, { kind: "approve", amount: "1000000" }), /amount/);

  const wrongSpender = tokenCall("approve", [token, 1_000_000n]);
  assert.throws(() => verifyStep(step(token, wrongSpender), deployment, { kind: "approve", amount: "1000000" }), /not for the Ciro/);
});

test("the chain and target are pinned", () => {
  const data = ciro("pay", [1n, "Ada Okonkwo"]);
  assert.throws(() => verifyStep(step(contract, data, 1), deployment, { kind: "pay", id: "1", name: "Ada Okonkwo" }), /wrong network/);
  assert.throws(() => verifyStep(step(token, data), deployment, { kind: "pay", id: "1", name: "Ada Okonkwo" }), /not a token call/);
  assert.throws(() => verifyStep(step("0x0000000000000000000000000000000000000001", data), deployment, { kind: "pay", id: "1", name: "Ada Okonkwo" }), /unknown contract/);
});

test("register and revoke must match the form", () => {
  const register = ciro("register", ["Ada Okonkwo"]);
  assert.doesNotThrow(() => verifyStep(step(contract, register), deployment, { kind: "register", name: "Ada Okonkwo" }));
  assert.throws(() => verifyStep(step(contract, register), deployment, { kind: "register", name: "Bob" }), /registration/);

  const revoke = ciro("revoke", ["0x0000000000000000000000000000000000000002"]);
  assert.doesNotThrow(() => verifyStep(step(contract, revoke), deployment, { kind: "revoke", spender: "0x0000000000000000000000000000000000000002" }));
  assert.throws(() => verifyStep(step(contract, revoke), deployment, { kind: "revoke", spender: "0x0000000000000000000000000000000000000003" }), /revoke/);
});

test("create and allow compare the encoded seconds", () => {
  const create = ciro("create", [1_000_000n, "March design", 1_800_000_000n]);
  assert.doesNotThrow(() => verifyStep(step(contract, create), deployment, {
    kind: "create", amount: "1000000", memo: "March design", due: 1_800_000_000,
  }));
  assert.throws(() => verifyStep(step(contract, create), deployment, {
    kind: "create", amount: "1000000", memo: "March design", due: 1_800_000_001,
  }), /invoice/);

  const allow = ciro("allow", ["0x0000000000000000000000000000000000000002", 1_000_000n, 1_800_000_000n]);
  assert.doesNotThrow(() => verifyStep(step(contract, allow), deployment, {
    kind: "allow", spender: "0x0000000000000000000000000000000000000002", cap: "1000000", expiry: 1_800_000_000,
  }));
  assert.throws(() => verifyStep(step(contract, allow), deployment, {
    kind: "allow", spender: "0x0000000000000000000000000000000000000002", cap: "1000001", expiry: 1_800_000_000,
  }), /allowance/);
});

test("the faucet mint is pinned to the connected account and the fixed amount", () => {
  const mint = tokenCall("mint", ["0x0000000000000000000000000000000000000002", 1_000_000_000n]);
  assert.doesNotThrow(() => verifyStep(step(token, mint), deployment, {
    kind: "mint", to: "0x0000000000000000000000000000000000000002", amount: 1_000_000_000n,
  }));
  assert.throws(() => verifyStep(step(token, mint), deployment, {
    kind: "mint", to: "0x0000000000000000000000000000000000000003", amount: 1_000_000_000n,
  }), /mint/);
});
