// The public demo account. #/demo resolves to its newest open 0.2 tUSD8
// invoice, so the onboarding link becomes a receipt only if every demo invoice
// is paid. Keeping the address here means the client never trusts the API to
// choose a different payee.
export const DEMO_PAYEE = "0xF69e6400b9c93B36d0730B3643f82fE54810498C";
export const DEMO_AMOUNT = "200000";
export const DEMO_REFERENCE = "Demo invoice";

export function pickDemoInvoice(invoices) {
  if (!Array.isArray(invoices)) return null;
  return invoices.find((invoice) => invoice.status === "open"
    && invoice.amount === DEMO_AMOUNT
    && invoice.reference === DEMO_REFERENCE) ?? null;
}
