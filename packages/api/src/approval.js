// Some stablecoin contracts revert when approve changes a non-zero allowance
// straight to another non-zero value. Reset to zero first in that case.
export function approvalAmounts(current, needed) {
  if (current === needed) return [];
  if (current === 0n) return [needed];
  // Reset first. This also removes a standing allowance larger than this
  // invoice, so the payer does not leave Ciro with more authority than needed.
  return [0n, needed];
}
