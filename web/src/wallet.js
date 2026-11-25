import { decodeEventLog, decodeFunctionResult, encodeFunctionData, getAddress, parseAbiItem } from "viem";
import { ciroAbi } from "../../packages/api/src/abi.js";
import { chainName, deploymentFor, networkParams, rpcUrl, session } from "./session.js";
import { verifyStep } from "./tx-guard.js";

const created = parseAbiItem(
  "event InvoiceCreated(uint256 indexed id, address indexed payee, uint256 amount, uint64 due, string memo)",
);
const balanceOf = parseAbiItem("function balanceOf(address) view returns (uint256)");

const DISCONNECTED_KEY = "ciro.walletDisconnected";
let disconnectedInMemory = false;

// An explicit disconnect must survive navigation and reloads. Many wallets
// keep returning the same account from eth_accounts after a revoke (or do not
// support wallet_revokePermissions at all), so asking the wallet again is not
// enough. Only an explicit Connect clears this intent.
function walletWasDisconnected() {
  if (disconnectedInMemory) return true;
  try {
    return localStorage.getItem(DISCONNECTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markWalletDisconnected() {
  disconnectedInMemory = true;
  try {
    localStorage.setItem(DISCONNECTED_KEY, "1");
  } catch {
    // The in-memory flag still protects this page.
  }
}

function clearWalletDisconnected() {
  disconnectedInMemory = false;
  try {
    localStorage.removeItem(DISCONNECTED_KEY);
  } catch {
    // Nothing else to clear.
  }
}

export function provider() {
  return window.ethereum ?? null;
}

export async function refreshWallet() {
  if (walletWasDisconnected()) {
    session.account = null;
    session.chainId = null;
    session.payee = null;
    return;
  }
  const ethereum = provider();
  if (!ethereum) {
    session.account = null;
    session.chainId = null;
    session.payee = null;
    return;
  }
  const accounts = await ethereum.request({ method: "eth_accounts" });
  session.account = accounts[0] ? getAddress(accounts[0]) : null;
  if (!session.account) {
    session.chainId = null;
    return;
  }
  session.chainId = Number(await ethereum.request({ method: "eth_chainId" }));
}

export async function connect() {
  const ethereum = provider();
  if (!ethereum) throw new Error("This browser has no Ethereum wallet.");
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts[0]) throw new Error("The wallet did not share an account.");
  const chainId = Number(await ethereum.request({ method: "eth_chainId" }));
  clearWalletDisconnected();
  session.account = getAddress(accounts[0]);
  session.chainId = chainId;
  if (!ethereum.__ciroListening) {
    ethereum.__ciroListening = true;
    ethereum.on?.("accountsChanged", () => {
      refreshWallet().then(() => window.dispatchEvent(new Event("hashchange")));
    });
    ethereum.on?.("chainChanged", () => location.reload());
  }
}

export function disconnect() {
  // Mark first, even if the wallet ignores the revoke or the popup hangs.
  markWalletDisconnected();
  session.account = null;
  session.chainId = null;
  session.payee = null;
  try {
    const request = provider()?.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
    Promise.resolve(request).catch(() => {});
  } catch {
    // Some wallets have no revoke. The page still forgets the account.
  }
}

// Adds the Ciro network to the wallet without switching. Wallets that already
// know the chain return an error, which the caller can ignore.
export async function addNetwork() {
  const ethereum = provider();
  if (!ethereum) throw new Error("This browser has no Ethereum wallet.");
  const params = networkParams();
  await ethereum.request({ method: "wallet_addEthereumChain", params: [params] });
  session.chainId = Number(await ethereum.request({ method: "eth_chainId" }));
}

export async function switchTo(chainId) {
  const hex = `0x${chainId.toString(16)}`;
  const ethereum = provider();
  if (!ethereum) throw new Error("This browser has no Ethereum wallet.");
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err) {
    if (err?.code !== 4902) throw err;
    // The wallet does not know this chain yet. Adding it does not always
    // switch, so ask again once the chain is known.
    await addNetwork();
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  }
  session.chainId = Number(await ethereum.request({ method: "eth_chainId" }));
}

export async function rpc(method, params) {
  const url = rpcUrl();
  if (!url) throw new Error("Set the chain RPC on the Developers screen.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "The chain did not answer.");
  return json.result;
}

export async function nativeBalance(account) {
  const raw = await rpc("eth_getBalance", [account, "latest"]);
  return BigInt(raw);
}

export async function tokenBalance(token, account) {
  const data = encodeFunctionData({ abi: [balanceOf], functionName: "balanceOf", args: [account] });
  const raw = await rpc("eth_call", [{ to: token, data }, "latest"]);
  return BigInt(raw);
}

export async function readInvoiceOnChain(id, contract) {
  const data = encodeFunctionData({ abi: ciroAbi, functionName: "getInvoice", args: [BigInt(id)] });
  const raw = await rpc("eth_call", [{ to: contract, data }, "latest"]);
  const result = decodeFunctionResult({ abi: ciroAbi, functionName: "getInvoice", data: raw });
  return {
    payee: result[0],
    amount: result[1],
    payer: result[2],
    due: result[3],
    paidAt: result[4],
    chainId: result[5],
    memo: result[6],
    payeeName: result[7],
  };
}

export async function checkInvoiceOnChain(id, claimed, contract) {
  const data = encodeFunctionData({ abi: ciroAbi, functionName: "checkInvoice", args: [BigInt(id), claimed] });
  const raw = await rpc("eth_call", [{ to: contract, data }, "latest"]);
  const result = Number(decodeFunctionResult({ abi: ciroAbi, functionName: "checkInvoice", data: raw }));
  return result === 2 ? "exact" : result === 1 ? "close" : "none";
}

export async function chainNow() {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  return Number(BigInt(block.timestamp));
}

export async function broadcast(steps) {
  const ethereum = provider();
  if (!ethereum) throw new Error("This browser has no Ethereum wallet.");
  if (!session.account) throw new Error("Connect a wallet first.");
  const deployment = deploymentFor(session.meta?.chainId);
  for (const step of steps) verifyStep(step, deployment, step.expect ?? {});
  const receipts = [];
  for (const step of steps) {
    // A wallet on another chain will quote that chain's gas, often ETH on
    // Ethereum. Move it to the Ciro chain before the signature prompt.
    if (step.chainId && session.chainId !== step.chainId) {
      await switchTo(step.chainId);
      if (session.chainId !== step.chainId) {
        throw new Error(`The wallet is on ${chainName(session.chainId)}. Switch to ${chainName(step.chainId)} and try again.`);
      }
    }
    const params = {
      from: session.account,
      to: step.to,
      data: step.data,
      value: "0x0",
    };
    if (step.chainId) params.chainId = `0x${Number(step.chainId).toString(16)}`;
    const hash = await ethereum.request({ method: "eth_sendTransaction", params: [params] });
    receipts.push(await waitReceipt(hash));
  }
  return receipts;
}

async function waitReceipt(hash) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("The transaction reverted.");
      receipt.transactionHash = hash;
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The transaction was not mined.");
}

export function createdId(receipt) {
  for (const log of receipt.logs ?? []) {
    try {
      const decoded = decodeEventLog({ abi: [created], data: log.data, topics: log.topics });
      if (decoded.eventName === "InvoiceCreated") return decoded.args.id.toString();
    } catch {
      // Not this event.
    }
  }
  return null;
}
