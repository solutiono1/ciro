export type CheckResult = "exact" | "close" | "none";
export type InvoiceStatus = "open" | "paid" | "past_due";

export interface Meta {
  chainId: number;
  contract: string;
  token: string;
  symbol: string;
  feeBps: number;
  nativeSymbol: string;
}

export interface Invoice {
  id: string;
  payee: string;
  payeeName: string;
  amount: string;
  amountDisplay: string;
  symbol: string;
  reference: string;
  due: string;
  payer: string;
  paidAt: string;
  chainId: number;
  status: InvoiceStatus;
}

export interface Receipt {
  id: string;
  payee: string;
  payeeName: string;
  payer: string;
  amount: string;
  amountDisplay: string;
  symbol: string;
  fee: string;
  feeDisplay: string;
  reference: string;
  paidAt: string;
  chainId: number;
  transactionHash: string | null;
}

export interface Payee {
  address: string;
  registered: boolean;
  name: string;
}

export interface Allowance {
  spender: string;
  remaining: string;
  expiry: string;
  revoked: boolean;
}

export interface Tx {
  chainId: number;
  to: string;
  data: string;
  value: string;
  summary: string;
}

export interface PayTx extends Tx {
  approvals?: Tx[];
}

export interface InvoiceList {
  invoices: Invoice[];
  truncated: boolean;
}

export interface ReceiptList {
  receipts: Receipt[];
}

export interface AllowanceList {
  allowances: Allowance[];
}

export interface CheckBody {
  result: CheckResult;
}

export interface ClientOptions {
  apiUrl?: string;
  fetch?: typeof fetch;
}

export class CiroError extends Error {
  status: number;
  code: string;
  body: unknown;
  constructor(status: number, code: string, body: unknown);
}

export class CiroClient {
  constructor(options?: ClientOptions);
  apiUrl: string;
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
  meta(): Promise<Meta>;
  invoice(id: string | number): Promise<Invoice>;
  checkInvoice(id: string | number, name: string): Promise<CheckBody>;
  receipt(id: string | number): Promise<Receipt>;
  payee(address: string): Promise<Payee>;
  payeeInvoices(address: string): Promise<InvoiceList>;
  payeeAllowances(address: string): Promise<AllowanceList>;
  payerReceipts(address: string): Promise<ReceiptList>;
  check(payee: string, name: string): Promise<CheckBody>;
  prepareRegister(name: string): Promise<Tx>;
  prepareInvoice(input: { amount: string; reference: string; due: string }): Promise<Tx>;
  preparePay(id: string | number, name: string, options?: { payer?: string }): Promise<PayTx>;
  preparePayFromAllowance(id: string | number, name: string, options?: { spender?: string }): Promise<PayTx>;
  prepareAllow(input: { spender: string; cap: string; expiry: string }): Promise<Tx>;
  prepareRevoke(spender: string): Promise<Tx>;
}

export function createClient(options?: ClientOptions): CiroClient;
