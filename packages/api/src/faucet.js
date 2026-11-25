import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, getAddress, http, isAddress, parseAbi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// A small testnet faucet, separate from the invoice API. The key is a
// dedicated testnet treasury key; it never signs invoices and never touches
// user funds. On mainnet the endpoint is disabled.
const TOKEN = "0x456569838f1d43009A91ebA4263147Afd7233483";
const TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
]);
const DEFAULT_AMOUNT = 1_000_000n; // 1.0 tUSD8 for the testnet flow
const DEFAULT_GAS = parseEther("0.01");
const MAX_AMOUNT = 1_000_000n;
const COOLDOWN_MS = 10 * 60 * 1000;
const claims = new Map();

function result(status, body) {
  return { status, body };
}

function amountFromEnv(env) {
  if (!env.CIRO_FAUCET_TOKEN_AMOUNT) return DEFAULT_AMOUNT;
  const value = BigInt(env.CIRO_FAUCET_TOKEN_AMOUNT);
  if (value <= 0n || value > MAX_AMOUNT) return DEFAULT_AMOUNT;
  return value;
}

export async function handleFaucet(env, body) {
  if (env.CIRO_FAUCET_DISABLED === "1") return result(503, { error: "faucet_offline" });
  if (!env.CIRO_FAUCET_KEY) return result(503, { error: "faucet_offline" });
  const chainId = Number(env.CIRO_FAUCET_CHAIN_ID ?? "44005");
  if (chainId !== 44005) return result(503, { error: "faucet_offline" });
  const rpcUrl = env.CIRO_FAUCET_RPC_URL || env.CIRO_RPC_URL;
  if (!rpcUrl) return result(503, { error: "faucet_offline" });
  const address = body?.address;
  if (!address || !isAddress(address)) return result(400, { error: "bad_address" });
  const to = getAddress(address);

  const token = env.CIRO_FAUCET_TOKEN || TOKEN;
  const tokenAmount = amountFromEnv(env);
  const gasAmount = env.CIRO_FAUCET_GAS_AMOUNT ? BigInt(env.CIRO_FAUCET_GAS_AMOUNT) : DEFAULT_GAS;
  if (gasAmount <= 0n || gasAmount > parseEther("0.02")) return result(503, { error: "faucet_offline" });

  const last = claims.get(to.toLowerCase());
  if (last && Date.now() - last < COOLDOWN_MS) {
    return result(429, {
      error: "faucet_rate_limited",
      retryAfter: Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000),
    });
  }

  const account = privateKeyToAccount(env.CIRO_FAUCET_KEY);
  const chain = defineChain({
    id: chainId,
    name: "Aevum",
    nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const transport = http(rpcUrl, { timeout: 30_000, retryCount: 2 });
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  let tokenBalance;
  let gasBalance;
  let treasuryToken;
  let treasuryGas;
  try {
    [tokenBalance, gasBalance, treasuryToken, treasuryGas] = await Promise.all([
      publicClient.readContract({ address: token, abi: TOKEN_ABI, functionName: "balanceOf", args: [to] }),
      publicClient.getBalance({ address: to }),
      publicClient.readContract({ address: token, abi: TOKEN_ABI, functionName: "balanceOf", args: [account.address] }),
      publicClient.getBalance({ address: account.address }),
    ]);
  } catch {
    return result(502, { error: "faucet_failed" });
  }

  const needToken = tokenBalance < tokenAmount;
  const needGas = gasBalance < gasAmount;
  if (!needToken && !needGas) {
    return result(200, {
      status: "already_funded",
      token: tokenBalance.toString(),
      gas: gasBalance.toString(),
      chainId,
    });
  }
  if (needToken && treasuryToken < tokenAmount) return result(503, { error: "faucet_empty" });
  if (needGas && treasuryGas < gasAmount + parseEther("0.002")) return result(503, { error: "faucet_empty" });

  try {
    let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    const sent = { chainId };
    if (needGas) {
      sent.gasTx = await walletClient.sendTransaction({ to, value: gasAmount, nonce });
      nonce += 1;
    }
    if (needToken) {
      const data = encodeFunctionData({ abi: TOKEN_ABI, functionName: "transfer", args: [to, tokenAmount] });
      sent.tokenTx = await walletClient.sendTransaction({ to: token, data, nonce });
    }
    // Wait for the receipts so the page can refresh into the funded state
    // immediately after the response, instead of racing the indexer.
    for (const hash of [sent.gasTx, sent.tokenTx].filter(Boolean)) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 25_000 });
      if (receipt.status !== "success") throw new Error("faucet transaction reverted");
    }
    claims.set(to.toLowerCase(), Date.now());
    return result(200, {
      ...sent,
      status: "sent",
      tokenAmount: needToken ? tokenAmount.toString() : "0",
      gasAmount: needGas ? gasAmount.toString() : "0",
    });
  } catch {
    return result(502, { error: "faucet_failed" });
  }
}
