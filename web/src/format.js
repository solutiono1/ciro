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

export function when(seconds) {
  if (seconds == null) return "";
  return new Date(Number(seconds) * 1000).toISOString().replace(".000Z", "Z");
}

export function feeLine(amount, feeBps) {
  const fee = feeOf(BigInt(amount), feeBps);
  if (fee === 0n) return "Fee 0";
  return `Fee ${formatFee(fee)}`;
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
