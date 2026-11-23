// The pay button exists only for an exact name, on the right chain, with funds.
// Close and unknown never produce a pay action.

export function payDecision(input) {
  if (input.status === "paid") return { action: "paid" };
  if (input.status === "past_due") return { action: "closed" };
  if (!input.result) return { action: "type" };
  if (input.result === "close") return { action: "close" };
  if (input.result !== "exact") return { action: "none" };
  if (!input.connected) return { action: "connect" };
  if (!input.chainMatches) return { action: "switch" };
  if (input.gasKnown && !input.gasEnough) return { action: "need-gas" };
  if (input.tokenKnown && !input.tokenEnough) return { action: "need-token" };
  return { action: "pay" };
}
