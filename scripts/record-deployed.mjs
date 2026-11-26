// Records the deployed Ciro app (https://ciro-a9s.pages.dev) with real Aevum
// testnet transactions.
//
// The page gets a fake wallet whose eth_sendTransaction calls back into Node,
// where viem signs with the testnet deployer key from .deploy-key. The key is
// never injected into the page.
//
// Usage, from the repo root:
//   node scripts/record-deployed.mjs
//
// Overwrites web/public/media/ciro-demo.webm and ciro-demo.mp4.

import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outWebm = path.join(root, "web/public/media/ciro-demo.webm");
const outMp4 = path.join(root, "web/public/media/ciro-demo.mp4");
const recordDir = path.join(root, ".ciro-record");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const key = (await readFile(path.join(root, ".deploy-key"), "utf8")).trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("no valid .deploy-key found");
const account = privateKeyToAccount(key);

const chain = defineChain({
  id: 44005,
  name: "Aevum",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-test.qday.info"] } },
});
const transport = http("https://rpc-test.qday.info");
const wallet = createWalletClient({ account, chain, transport });
const publicClient = createPublicClient({ chain, transport });

const cursorScript = `(() => {
  const style = document.createElement("style");
  style.textContent = \`
    #__demo_cursor { position: fixed; z-index: 2147483647; width: 14px; height: 14px;
      margin: -7px 0 0 -7px; border-radius: 50%; background: #0e0e12;
      pointer-events: none; box-shadow: 0 0 0 2px rgba(255,255,255,0.9); }
  \`;
  document.head.appendChild(style);
  const dot = document.createElement("div");
  dot.id = "__demo_cursor";
  document.documentElement.appendChild(dot);
  addEventListener("mousemove", (e) => {
    dot.style.left = e.clientX + "px";
    dot.style.top = e.clientY + "px";
  });
})();`;

const walletScript = `(() => {
  const account = ${JSON.stringify(account.address)};
  let connected = false;
  async function request({ method, params }) {
    if (method === "eth_accounts") return connected ? [account] : [];
    if (method === "eth_requestAccounts") { connected = true; return [account]; }
    if (method === "eth_chainId") return "0xabe5";
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    if (method === "wallet_revokePermissions") { connected = false; return null; }
    if (method === "eth_sendTransaction") return window.__ciroSign(params[0]);
    throw new Error("Unsupported wallet method " + method);
  }
  window.ethereum = { request, on() {}, removeListener() {} };
})();`;

async function moveTo(page, locator, steps = 12) {
  const box = await locator.boundingBox();
  if (!box) return;
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const from = { x: 640, y: 400 };
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      from.x + ((target.x - from.x) * i) / steps,
      from.y + ((target.y - from.y) * i) / steps,
    );
    await sleep(16);
  }
}

async function click(page, locator) {
  await moveTo(page, locator);
  await locator.click();
  await sleep(350);
}

await rm(recordDir, { recursive: true, force: true });
await mkdir(recordDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: recordDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
page.setDefaultTimeout(40_000);

await page.exposeFunction("__ciroSign", async ({ to, data, value }) => {
  const hash = await wallet.sendTransaction({ to, data, value: BigInt(value ?? "0") });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("transaction reverted");
  return hash;
});
await page.addInitScript({ content: walletScript + cursorScript });

const origin = "https://ciro-a9s.pages.dev";
const due = "2026-12-31";

try {
  await page.goto(origin);
  await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
  await sleep(1600);

  await click(page, page.getByRole("link", { name: "Get started" }));
  await click(page, page.getByRole("button", { name: "Connect" }));
  await page.getByRole("heading", { name: "Open invoices" }).waitFor();
  await sleep(700);

  await click(page, page.getByRole("link", { name: "Invoices" }));
  await click(page, page.getByRole("link", { name: "New invoice" }));
  await click(page, page.locator("#amount"));
  await page.locator("#amount").fill("0.2");
  await page.locator("#reference").fill("Studio deposit");
  await page.locator("#due").fill(due);
  await click(page, page.getByRole("button", { name: "Create invoice" }));
  await page.getByRole("link", { name: "Open pay screen" }).waitFor();
  await sleep(500);

  await click(page, page.getByRole("link", { name: "Open pay screen" }));
  await page.getByLabel("Name you were told").waitFor();
  await click(page, page.locator("#claimed"));
  await page.locator("#claimed").fill("Elena Rossi");
  const pay = page.getByRole("button", { name: /^Pay / });
  await pay.waitFor();
  await sleep(900);
  await click(page, pay);
  await page.getByText(/^Receipt \d+$/).waitFor();
  await sleep(1600);
} finally {
  await context.close();
  await browser.close();
}

const files = await readdir(recordDir);
const recording = files.find((name) => name.endsWith(".webm"));
if (!recording) throw new Error("no recording produced");
await mkdir(path.dirname(outWebm), { recursive: true });
await copyFile(path.join(recordDir, recording), outWebm);
execFileSync("ffmpeg", [
  "-y", "-i", outWebm, "-c:v", "libx264", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-an", outMp4,
], { stdio: "ignore" });
await rm(recordDir, { recursive: true, force: true });
console.log(`Saved ${path.relative(root, outWebm)} and ciro-demo.mp4`);
