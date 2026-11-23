const SCALE = 1_000_000n;

export function formatUnits(amount) {
  if (typeof amount !== "bigint" || amount < 0n) {
    throw new Error("bad_amount");
  }
  const whole = amount / SCALE;
  const frac = (amount % SCALE).toString().padStart(6, "0");
  return `${whole.toString()}.${frac}`;
}

export function parseHuman(input) {
  if (typeof input !== "string" || !/^\d+(\.\d{1,6})?$/.test(input)) {
    throw new Error("bad_amount");
  }
  const [whole, frac = ""] = input.split(".");
  return BigInt(whole) * SCALE + BigInt(frac.padEnd(6, "0"));
}

export function parseBaseUnits(value) {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw new Error("bad_amount");
}

export function feeOf(amount, bps) {
  return (amount * BigInt(bps)) / 10_000n;
}

export function formatFee(fee) {
  if (fee === 0n) return "0";
  return formatUnits(fee);
}
