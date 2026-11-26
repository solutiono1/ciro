// Checks the Ciro faucet treasury and exits non-zero when it is running low.
// Run it from cron, a GitHub Action, or by hand:
//
//   node scripts/faucet-monitor.mjs
//   node scripts/faucet-monitor.mjs --json
//
// Environment overrides:
//   CIRO_FAUCET_ADDRESS       treasury (default 0x0925…7a13)
//   CIRO_RPC_URL              Aevum RPC
//   CIRO_FAUCET_TOKEN_ADDRESS tUSD8
//   CIRO_FAUCET_TOKEN_AMOUNT  base units per claim (default 200000)
//   CIRO_MONITOR_MIN_CLAIMS   alert threshold (default 3)
//   CIRO_MONITOR_MIN_GAS      alert threshold in tQDAY (default 0.02)
//   CIRO_FAUCET_ENDPOINT      optional live endpoint health check
//
// Exit codes: 0 healthy, 1 low balance or unhealthy endpoint, 2 check failed.

import { createPublicClient, defineChain, formatEther, formatUnits, http, parseAbi, parseEther } from "viem";

const TREASURY = process.env.CIRO_FAUCET_ADDRESS ?? "0x09257929772176E9c832fC8056A0d9913Ef77a13";
const RPC = process.env.CIRO_RPC_URL ?? "https://rpc-test.qday.info";
const TOKEN = process.env.CIRO_FAUCET_TOKEN_ADDRESS ?? "0x456569838f1d43009A91ebA4263147Afd7233483";
const CLAIM = BigInt(process.env.CIRO_FAUCET_TOKEN_AMOUNT ?? "200000");
const MIN_CLAIMS = Number(process.env.CIRO_MONITOR_MIN_CLAIMS ?? "3");
const MIN_GAS = parseEther(process.env.CIRO_MONITOR_MIN_GAS ?? "0.02");
const ENDPOINT = process.env.CIRO_FAUCET_ENDPOINT ?? "https://ciro-a9s.pages.dev/api/v1/faucet";
const asJson = process.argv.includes("--json");

const chain = defineChain({
  id: 44005,
  name: "Aevum",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const client = createPublicClient({ chain, transport: http(RPC, { timeout: 20_000, retryCount: 2 }) });
const tokenAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

async function endpointHealth() {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: TREASURY }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => ({}));
    const state = body.status ?? body.error ?? "unknown";
    // A 429 with a faucet error still proves the endpoint and its limits are
    // alive. The balance check below is what decides whether funds are low.
    const reachable = response.ok
      || (response.status === 429 && (state === "faucet_rate_limited" || state === "faucet_already_claimed"));
    return {
      ok: reachable,
      status: response.status,
      state,
    };
  } catch (error) {
    return { ok: false, status: 0, state: error.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

let report;
try {
  const [token, gas, health] = await Promise.all([
    client.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [TREASURY] }),
    client.getBalance({ address: TREASURY }),
    ENDPOINT ? endpointHealth() : Promise.resolve(null),
  ]);
  const claimsLeft = Number(token / CLAIM);
  const lowToken = claimsLeft < MIN_CLAIMS;
  const lowGas = gas < MIN_GAS;
  const staleEndpoint = health ? !health.ok : false;
  report = {
    ok: !lowToken && !lowGas && !staleEndpoint,
    treasury: TREASURY,
    token: token.toString(),
    tokenDisplay: formatUnits(token, 6),
    claim: CLAIM.toString(),
    claimsLeft,
    minClaims: MIN_CLAIMS,
    gas: gas.toString(),
    gasDisplay: formatEther(gas),
    minGas: formatEther(MIN_GAS),
    lowToken,
    lowGas,
    endpoint: health,
    checkedAt: new Date().toISOString(),
  };
} catch (error) {
  report = {
    ok: false,
    treasury: TREASURY,
    error: error.shortMessage ?? error.message ?? String(error),
    checkedAt: new Date().toISOString(),
  };
}

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else if (report.error) {
  process.stdout.write(`faucet check failed: ${report.error}\n`);
} else {
  process.stdout.write(`faucet ${report.ok ? "ok" : "ALERT"} — ${report.treasury}\n`);
  process.stdout.write(`tUSD8 ${report.tokenDisplay} (${report.claimsLeft} claims of ${formatUnits(CLAIM, 6)} left; alert below ${report.minClaims})\n`);
  process.stdout.write(`tQDAY ${report.gasDisplay} (alert below ${report.minGas})\n`);
  if (report.endpoint) {
    process.stdout.write(`endpoint ${report.endpoint.status} ${report.endpoint.state}\n`);
  }
  if (report.lowToken) process.stdout.write("refill tUSD8: send test tokens to the treasury\n");
  if (report.lowGas) process.stdout.write("refill tQDAY: send test gas to the treasury\n");
  if (report.endpoint && !report.endpoint.ok) process.stdout.write("faucet endpoint is not healthy\n");
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = report.error
    ? `## Faucet check failed\n\n${report.error}\n`
    : `## Faucet ${report.ok ? "ok" : "alert"}\n\n`
      + `- Treasury: \`${report.treasury}\`\n`
      + `- tUSD8: **${report.tokenDisplay}** (${report.claimsLeft} claims left)\n`
      + `- tQDAY: **${report.gasDisplay}**\n`
      + `- Endpoint: ${report.endpoint ? `${report.endpoint.status} ${report.endpoint.state}` : "not checked"}\n`
      + `- Checked: ${report.checkedAt}\n`;
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}

process.exit(report.error ? 2 : report.ok ? 0 : 1);
