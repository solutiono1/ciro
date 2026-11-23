// Some stablecoin contracts revert when approve changes a non-zero allowance
// straight to another non-zero value. Reset to zero first in that case.
export function approvalAmounts(current, needed) {
  if (current >= needed) return [];
  if (current === 0n) return [needed];
  return [0n, needed];
}
