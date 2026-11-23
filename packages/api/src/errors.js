export class ApiError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }

  body() {
    return { error: this.code, ...this.extra };
  }
}

const REVERT_CODES = {
  UnknownInvoice: ["unknown_invoice", 404],
  AlreadyPaid: ["already_paid", 409],
  PastDue: ["past_due", 409],
  NoAllowance: ["no_allowance", 409],
  AllowanceExpired: ["allowance_expired", 409],
  AllowanceIsRevoked: ["allowance_revoked", 409],
  CapExceeded: ["cap_exceeded", 409],
  EmptyName: ["empty_name", 400],
  NotRegistered: ["not_registered", 409],
};

export function apiErrorFromRevert(name) {
  const mapped = REVERT_CODES[name];
  if (!mapped) return null;
  return new ApiError(mapped[1], mapped[0]);
}
