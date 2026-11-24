import { decodeFunctionData, getAddress } from "viem";
import { ciroAbi, tokenAbi } from "../../packages/api/src/abi.js";

// Every transaction the API returns is decoded before the wallet sees it.
// A compromised API must not be able to change the target, the chain, the
// invoice, the name, or the approval amount the user was shown.

function fail(message) {
  throw new Error(message);
}

function sameAddress(left, right) {
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return false;
  }
}

function checkCiro(functionName, args, expect) {
  switch (functionName) {
    case "pay": {
      if (expect.kind !== "pay") fail("The API prepared a different action.");
      if (BigInt(args[0]) !== BigInt(expect.id)) fail("The invoice in the transaction does not match this page.");
      if (String(args[1]) !== String(expect.name)) fail("The name in the transaction does not match the name you typed.");
      return;
    }
    case "register": {
      if (expect.kind !== "register" || String(args[0]) !== String(expect.name)) {
        fail("The registration in the transaction does not match this page.");
      }
      return;
    }
    case "create": {
      if (
        expect.kind !== "create"
        || BigInt(args[0]) !== BigInt(expect.amount)
        || String(args[1]) !== String(expect.memo)
        || BigInt(args[2]) !== BigInt(expect.due)
      ) {
        fail("The invoice in the transaction does not match this form.");
      }
      return;
    }
    case "allow": {
      if (
        expect.kind !== "allow"
        || !sameAddress(args[0], expect.spender)
        || BigInt(args[1]) !== BigInt(expect.cap)
        || BigInt(args[2]) !== BigInt(expect.expiry)
      ) {
        fail("The allowance in the transaction does not match this form.");
      }
      return;
    }
    case "revoke": {
      if (expect.kind !== "revoke" || !sameAddress(args[0], expect.spender)) {
        fail("The revoke in the transaction does not match this page.");
      }
      return;
    }
    default:
      fail("The API prepared a contract call this page does not use.");
  }
}

function checkToken(functionName, args, expect, contract) {
  if (functionName === "approve") {
    if (expect.kind !== "approve") fail("The API prepared an approval this page does not use.");
    if (!sameAddress(args[0], contract)) fail("The approval is not for the Ciro contract.");
    const amount = BigInt(args[1]);
    if (amount !== 0n && amount !== BigInt(expect.amount)) {
      fail("The approval amount does not match this invoice.");
    }
    return;
  }
  if (functionName === "mint") {
    if (
      expect.kind !== "mint"
      || !sameAddress(args[0], expect.to)
      || BigInt(args[1]) !== BigInt(expect.amount)
    ) {
      fail("The mint in the transaction does not match this faucet request.");
    }
    return;
  }
  fail("The API prepared a token call this page does not use.");
}

export function verifyStep(step, deployment, expect = {}) {
  if (!deployment) fail("The Ciro deployment is not loaded.");
  if (Number(step.chainId) !== Number(deployment.chainId)) {
    fail("The transaction is on the wrong network.");
  }
  if (!step.to || !step.data) fail("The transaction is missing a target or data.");

  let to;
  try {
    to = getAddress(step.to);
  } catch {
    fail("The transaction target is not a valid address.");
  }

  if (to === getAddress(deployment.contract)) {
    let decoded;
    try {
      decoded = decodeFunctionData({ abi: ciroAbi, data: step.data });
    } catch {
      fail("The transaction is not a Ciro call.");
    }
    checkCiro(decoded.functionName, decoded.args, expect);
    return;
  }

  if (to === getAddress(deployment.token)) {
    let decoded;
    try {
      decoded = decodeFunctionData({ abi: tokenAbi, data: step.data });
    } catch {
      fail("The transaction is not a token call.");
    }
    checkToken(decoded.functionName, decoded.args, expect, deployment.contract);
    return;
  }

  fail("The transaction targets an unknown contract.");
}
