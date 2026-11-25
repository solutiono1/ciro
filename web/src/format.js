import { feeOf, formatFee, formatUnits, parseHuman } from "../../packages/shared/src/money.js";
import { fold } from "../../packages/shared/src/normalize.js";

export { feeOf, formatFee, formatUnits, parseHuman };

export function foldedText(name) {
  return new TextDecoder().decode(fold(name));
}

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function when(seconds) {
  if (seconds == null) return "";
  return new Date(Number(seconds) * 1000).toISOString().replace(".000Z", "Z");
}

export function feeLine(amount, feeBps) {
  const fee = feeOf(BigInt(amount), feeBps);
  if (fee === 0n) return "Fee 0";
  return `Fee ${formatFee(fee)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The accountant-friendly form of the on-chain receipt. This is a local
// export: no API call, no database, no key.
export function receiptCsv(receipt) {
  const rows = [
    ["Invoice", receipt.id],
    ["Payee", receipt.payee],
    ["Payee address", receipt.payeeAddress],
    ["Payer", receipt.payer],
    ["Amount", receipt.amount],
    ["Fee", receipt.fee],
    ["Net to payee", receipt.net],
    ["Symbol", receipt.symbol],
    ["Reference", receipt.reference],
    ["Paid", receipt.paidAt],
    ["Network", receipt.chainId],
    ["Transaction", receipt.transactionHash],
  ];
  return ["Field,Value", ...rows.map(([name, value]) => `${csvCell(name)},${csvCell(value)}`)].join("\n") + "\n";
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
