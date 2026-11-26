import test from "node:test";
import assert from "node:assert/strict";
import { pickDemoInvoice } from "../src/demo.js";

const open = (id, amount = "200000", reference = "Demo invoice") => ({
  id,
  amount,
  reference,
  status: "open",
});

test("the newest open 0.2 demo invoice wins", () => {
  const invoices = [
    open("12"),
    open("11"),
    { ...open("10", "1000000"), status: "open" },
    { ...open("9"), reference: "Studio deposit" },
    { ...open("8"), status: "paid" },
  ];
  assert.equal(pickDemoInvoice(invoices)?.id, "12");
});

test("a paid demo invoice is skipped", () => {
  const invoices = [{ ...open("12"), status: "paid" }, open("11")];
  assert.equal(pickDemoInvoice(invoices)?.id, "11");
});

test("no open demo invoice returns null", () => {
  assert.equal(pickDemoInvoice([{ ...open("12"), status: "paid" }]), null);
  assert.equal(pickDemoInvoice([]), null);
  assert.equal(pickDemoInvoice(undefined), null);
});
