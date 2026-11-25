import test from "node:test";
import assert from "node:assert/strict";
import { receiptCsv } from "../src/format.js";

test("receipt CSV is an accountant-friendly record and quotes commas and quotes", () => {
  const csv = receiptCsv({
    id: "8",
    payee: "Elena Rossi",
    payeeAddress: "0xF69e6400b9c93B36d0730B3643f82fE54810498C",
    payer: "0x92cf6f88d9846C9aEcaE818cd811Ca45B9Ae90C7",
    amount: "1.000000",
    fee: "0",
    net: "1.000000",
    symbol: "tUSD8",
    reference: 'Studio, "deposit"',
    paidAt: "2026-11-25T09:38:41Z",
    chainId: "44005",
    transactionHash: "0x003e61d3f9f802792a25f5720b039d31d9bec7dcc29343a49c948f5134f396cd",
  });
  assert.match(csv, /^Field,Value\n/);
  assert.match(csv, /^Invoice,8$/m);
  assert.match(csv, /^Payee,Elena Rossi$/m);
  assert.match(csv, /^Reference,"Studio, ""deposit"""$/m);
  assert.match(csv, /^Network,44005$/m);
  assert.match(csv, /^Transaction,0x003e61d3/m);
});
