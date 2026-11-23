import { parseAbi } from "viem";

export const ciroAbi = parseAbi([
  "function register(string name)",
  "function create(uint256 amount, string memo, uint64 due) returns (uint256 id)",
  "function check(address payee, string claimed) view returns (uint8)",
  "function checkInvoice(uint256 id, string claimed) view returns (uint8)",
  "function pay(uint256 id, string claimed)",
  "function payFromAllowance(uint256 id, string claimed)",
  "function allow(address spender, uint256 cap, uint64 expiry)",
  "function revoke(address spender)",
  "function getInvoice(uint256 id) view returns (address payee, uint256 amount, address payer, uint64 due, uint64 paidAt, uint256 chainId, string memo, string payeeName)",
  "function invoicesOf(address payee) view returns (uint256[])",
  "function displayName(address) view returns (string)",
  "function payees(address) view returns (bytes32 nameHash, bytes8 initials, uint8 words, uint16 length, bool active)",
  "function allowances(address payee, address spender) view returns (uint256 remaining, uint64 expiry, bool set, bool revoked)",
  "function feeBps() view returns (uint16)",
  "function token() view returns (address)",
  "event Paid(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount, uint256 fee)",
  "error UnknownInvoice()",
  "error AlreadyPaid()",
  "error PastDue()",
  "error NameMismatch(uint8 result)",
  "error NoAllowance()",
  "error AllowanceExpired()",
  "error AllowanceIsRevoked()",
  "error CapExceeded()",
  "error EmptyName()",
  "error NotRegistered()",
]);

export const tokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount)",
]);

export const RESULTS = ["none", "close", "exact"];
