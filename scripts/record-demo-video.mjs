// Records the real Ciro site with real Aevum testnet transactions and no audio.
// The payee is an ephemeral testnet key created for this recording. The payer is
// the deployer in .deploy-key, which funds the payee for gas before recording.
//
// Usage, from the repo root:
//   node scripts/record-demo-video.mjs
//
// Output:
//   demo/ciro-demo-silent.webm
//   demo/ciro-demo-silent.mp4
//   demo/video-cues.json
//
// The site is the live original at https://ciro-a9s.pages.dev. The recording is
// silent and contains a real cursor, a close-name refusal, an exact payment, and
// the on-chain receipt. No AI video, no generated UI.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseAbi,
  parseEther,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SCENES } from "./demo-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoDir = path.join(root, "demo");
const recordDir = path.join(demoDir, "recordings");
const outWebm = path.join(demoDir, "ciro-demo-silent.webm");
const outMp4 = path.join(demoDir, "ciro-demo-silent.mp4");
const outCues = path.join(demoDir, "video-cues.json");
const origin = process.env.CIRO_DEMO_URL ?? "https://ciro-a9s.pages.dev";
const rpcUrl = "https://rpc-test.qday.info";
const token = "0x456569838f1d43009A91ebA4263147Afd7233483";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chain = defineChain({
  id: 44005,
  name: "Aevum",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
const transport = http(rpcUrl, { timeout: 30_000 });
const publicClient = createPublicClient({ chain, transport });
const tokenAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const payerKey = (await readFile(path.join(root, ".deploy-key"), "utf8")).trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(payerKey)) throw new Error("no valid .deploy-key found");
const payer = privateKeyToAccount(payerKey);
const payee = privateKeyToAccount(generatePrivateKey());
const payerWallet = createWalletClient({ account: payer, chain, transport });
const payeeWallet = createWalletClient({ account: payee, chain, transport });

async function ensureFunds() {
  const payerGas = await publicClient.getBalance({ address: payer.address });
  if (payerGas < parseEther("0.02")) {
    throw new Error(`payer needs gas: ${formatEther(payerGas)} tQDAY`);
  }
  const payerToken = await publicClient.readContract({
    address: token,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [payer.address],
  });
  if (payerToken < 1_000_000n) {
    throw new Error(`payer needs at least 1.0 tUSD8, has ${payerToken} base units`);
  }
  const payeeGas = await publicClient.getBalance({ address: payee.address });
  if (payeeGas < parseEther("0.03")) {
    const hash = await payerWallet.sendTransaction({ to: payee.address, value: parseEther("0.1") });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("payee gas funding reverted");
  }
}

await ensureFunds();
process.stdout.write(`payee ${payee.address}\n`);
process.stdout.write(`payer ${payer.address}\n`);

const walletScript = `(() => {
  const accounts = ${JSON.stringify([payee.address, payer.address])};
  let connected = false;
  let index = 0;
  const listeners = {};
  function current() { return connected ? [accounts[index]] : []; }
  function emit(event, payload) { for (const fn of listeners[event] || []) fn(payload); }
  async function request({ method, params }) {
    if (method === "eth_accounts") return current();
    if (method === "eth_requestAccounts") { connected = true; return current(); }
    if (method === "eth_chainId") return "0xabe5";
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    if (method === "wallet_revokePermissions") { connected = false; return null; }
    if (method === "eth_sendTransaction") return window.__ciroSign(params[0]);
    throw new Error("Unsupported wallet method " + method);
  }
  window.ethereum = {
    request,
    on(event, fn) { (listeners[event] ||= []).push(fn); },
    removeListener(event, fn) {
      listeners[event] = (listeners[event] || []).filter((item) => item !== fn);
    },
  };
  window.__ciroDemo = {
    setAccount(next) { index = next; emit("accountsChanged", current()); },
  };
})();`;

const cursorScript = `(() => {
  const style = document.createElement("style");
  style.textContent = \`
    #__demo_cursor { position: fixed; z-index: 2147483647; width: 14px; height: 14px;
      margin: -7px 0 0 -7px; border-radius: 50%; background: #5b3df5;
      border: 2px solid #fff; pointer-events: none; opacity: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,.28); transition: opacity .2s linear; }
    #__demo_click { position: fixed; z-index: 2147483646; width: 26px; height: 26px;
      margin: -13px 0 0 -13px; border-radius: 50%; border: 2px solid #5b3df5;
      pointer-events: none; opacity: 0; }
  \`;
  document.head.appendChild(style);
  const dot = document.createElement("div");
  dot.id = "__demo_cursor";
  const ring = document.createElement("div");
  ring.id = "__demo_click";
  document.documentElement.append(dot, ring);
  addEventListener("mousemove", (event) => {
    dot.style.opacity = "1";
    dot.style.left = event.clientX + "px";
    dot.style.top = event.clientY + "px";
  });
  addEventListener("mousedown", (event) => {
    ring.style.left = event.clientX + "px";
    ring.style.top = event.clientY + "px";
    ring.getAnimations().forEach((animation) => animation.cancel());
    ring.animate(
      [
        { opacity: 0.9, transform: "scale(.4)" },
        { opacity: 0, transform: "scale(1.6)" },
      ],
      { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" },
    );
  });
})();`;

await rm(recordDir, { recursive: true, force: true });
await mkdir(recordDir, { recursive: true });
await mkdir(demoDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 1,
  recordVideo: { dir: recordDir, size: { width: 1440, height: 810 } },
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const recordingStart = Date.now();

await page.exposeFunction("__ciroSign", async ({ from, to, data, value }) => {
  const signer = String(from || "").toLowerCase();
  const wallet = signer === payee.address.toLowerCase()
    ? payeeWallet
    : signer === payer.address.toLowerCase()
      ? payerWallet
      : null;
  if (!wallet) throw new Error("unknown signer");
  const hash = await wallet.sendTransaction({ to, data, value: BigInt(value ?? "0") });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("transaction reverted");
  return hash;
});
await page.addInitScript({ content: walletScript + cursorScript });

const cues = [];
let sceneStart = 0;
let mouse = { x: 720, y: 405 };
const sceneTarget = new Map(SCENES.map((scene) => [scene.id, scene.target]));

function begin(id) {
  sceneStart = Date.now();
  cues.push({ id, target: sceneTarget.get(id), start: sceneStart - recordingStart });
}

async function holdTo(seconds) {
  const remaining = sceneStart + seconds * 1000 - Date.now();
  if (remaining > 0) await sleep(remaining);
  const cue = cues[cues.length - 1];
  cue.end = Date.now() - recordingStart;
  cue.actual = Math.round((cue.end - cue.start) / 1000);
}

async function pointAt(locator) {
  await locator.scrollIntoViewIfNeeded();
  await sleep(250);
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  for (let step = 1; step <= 14; step += 1) {
    await page.mouse.move(
      mouse.x + ((target.x - mouse.x) * step) / 14,
      mouse.y + ((target.y - mouse.y) * step) / 14,
    );
    await sleep(16);
  }
  mouse = target;
  return target;
}

async function click(locator) {
  const point = await pointAt(locator);
  await page.mouse.click(point.x, point.y);
  await sleep(380);
}

async function fill(locator, value) {
  await click(locator);
  await locator.fill(value);
  await sleep(280);
}

try {
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
  await sleep(1200);

  begin("landing");
  await holdTo(16);

  begin("register");
  await click(page.getByRole("link", { name: "Get started" }));
  await page.getByRole("button", { name: "Connect" }).waitFor();
  await click(page.getByRole("button", { name: "Connect" }));
  await page.locator("#name").waitFor();
  await fill(page.locator("#name"), "Ada Okonkwo");
  await click(page.getByRole("button", { name: "Register" }));
  await page.getByRole("heading", { name: "Open invoices" }).waitFor();
  await holdTo(20);

  begin("create");
  await click(page.getByRole("link", { name: "New invoice" }));
  await page.locator("#amount").waitFor();
  await fill(page.locator("#amount"), "1");
  await fill(page.locator("#reference"), "Studio deposit");
  await fill(page.locator("#due"), "2026-12-31");
  await click(page.getByRole("button", { name: "Create invoice" }));
  await page.getByRole("link", { name: "Open pay screen" }).waitFor();
  process.stdout.write(`invoice ${page.url()}\n`);
  await holdTo(24);

  begin("close");
  await page.evaluate(() => window.__ciroDemo.setAccount(1));
  await sleep(900);
  await page.getByRole("link", { name: "Open pay screen" }).waitFor();
  await click(page.getByRole("link", { name: "Open pay screen" }));
  await page.getByLabel("Name you were told").waitFor();
  await fill(page.locator("#claimed"), "Ada Okonkwa");
  await page.getByText("This is close to the name on the invoice.").waitFor();
  await holdTo(26);

  begin("pay");
  await fill(page.locator("#claimed"), "Ada Okonkwo");
  await page.getByText("The name matches.").waitFor();
  const pay = page.getByRole("button", { name: /^Pay / });
  await pay.waitFor();
  await sleep(1200);
  await click(pay);
  await page.getByText(/^Receipt \d+$/).waitFor();
  await holdTo(32);

  begin("receipt");
  await page.getByText("Verified on chain.").waitFor();
  await page.locator("[data-tx]").scrollIntoViewIfNeeded();
  await sleep(600);
  await holdTo(24);

  begin("tools");
  // The receipt page is still connected. Disconnect first so the public
  // developers page renders its "Build on Ciro" heading and package cards.
  await page.evaluate(async () => {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  });
  await page.goto(`${origin}/#/developers`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Build on Ciro" }).waitFor();
  await page.getByText("@getciro/sdk").first().scrollIntoViewIfNeeded();
  await sleep(900);
  await holdTo(28);
} finally {
  await context.close();
  await browser.close();
}

const files = await readdir(recordDir);
const recording = files.find((name) => name.endsWith(".webm"));
if (!recording) throw new Error("no recording produced");
await copyFile(path.join(recordDir, recording), outWebm);
execFileSync("ffmpeg", [
  "-y",
  "-i",
  outWebm,
  "-r",
  "30",
  "-c:v",
  "libx264",
  "-crf",
  "20",
  "-preset",
  "medium",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-an",
  outMp4,
], { stdio: "inherit" });
await rm(recordDir, { recursive: true, force: true });
await writeFile(outCues, `${JSON.stringify({ totalMs: Date.now() - recordingStart, scenes: cues }, null, 2)}\n`);
process.stdout.write(`Saved ${path.relative(root, outWebm)} and ${path.relative(root, outMp4)}\n`);
process.stdout.write(`Cues ${path.relative(root, outCues)}\n`);
