import { formatFee, formatUnits } from "../../shared/src/money.js";

export function paySummary(id, amount, fee, symbol) {
  return `Pay invoice ${id.toString()}, ${formatUnits(amount)} ${symbol}, fee ${formatFee(fee)}`;
}

export function approveSummary(amount, symbol) {
  if (amount === 0n) return `Reset ${symbol} approval to 0`;
  return `Approve ${formatUnits(amount)} ${symbol} for this invoice`;
}

export function isoFromSeconds(seconds) {
  return new Date(Number(seconds) * 1000).toISOString().replace(".000Z", "Z");
}
