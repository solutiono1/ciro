// Records the real Ciro site with real Aevum testnet transactions and no audio.
// The payee is the demo payee in .demo-payee-key*, already registered as
// Elena Rossi. The payer is the deployer in .deploy-key. Fund the payer with one
// 0.2 tUSD8 faucet claim before recording.
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
// silent and contains a real cursor, a taken-name refusal, a close-name
// refusal, an exact payment, the on-chain receipt, and the Control Room.
// No AI video, no generated UI.

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
import { privateKeyToAccount } from "viem/accounts";
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

const payerKey = process.env.CIRO_DEMO_PAYER_KEY
  || (await readFile(process.env.CIRO_DEMO_PAYER_KEY_FILE || path.join(root, ".deploy-key"), "utf8")).trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(payerKey)) throw new Error("no valid payer key found");

async function demoPayeeKey() {
  if (process.env.CIRO_DEMO_PAYEE_KEY && /^0x[0-9a-fA-F]{64}$/.test(process.env.CIRO_DEMO_PAYEE_KEY.trim())) {
    return process.env.CIRO_DEMO_PAYEE_KEY.trim();
  }
  const files = (await readdir(root)).filter((name) => name.startsWith(".demo-payee-key"));
  for (const file of files) {
    const key = (await readFile(path.join(root, file), "utf8")).trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(key)) return key;
  }
  throw new Error("no .demo-payee-key* found; set CIRO_DEMO_PAYEE_KEY to the demo payee key");
}

const NAME = "Elena Rossi";
const CLOSE_NAME = "Elena Rossa";
const AMOUNT = "0.2";
const REFERENCE = "Studio deposit";
const DUE = "2028-12-31";

const payer = privateKeyToAccount(payerKey);
const payee = privateKeyToAccount(await demoPayeeKey());
const payerWallet = createWalletClient({ account: payer, chain, transport });
const payeeWallet = createWalletClient({ account: payee, chain, transport });

async function ensureFunds() {
  const payerGas = await publicClient.getBalance({ address: payer.address });
  if (payerGas < parseEther("0.005")) {
    throw new Error(`payer needs gas: ${formatEther(payerGas)} tQDAY`);
  }
  const payerToken = await publicClient.readContract({
    address: token,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: [payer.address],
  });
  if (payerToken < 200_000n) {
    throw new Error(`payer needs at least 0.2 tUSD8, has ${payerToken} base units`);
  }
  const payeeGas = await publicClient.getBalance({ address: payee.address });
  if (payeeGas < parseEther("0.003")) {
    const hash = await payerWallet.sendTransaction({ to: payee.address, value: parseEther("0.005") });
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

// A route render can finish after a click, replacing an input and dropping the
// value. Fill, verify, and retry against the current element.
async function fillStable(locator, value, attempts = 5) {
  await locator.waitFor();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await locator.fill(value);
    await sleep(250);
    if ((await locator.inputValue().catch(() => null)) === value) return;
  }
  throw new Error(`field did not keep ${JSON.stringify(value)}`);
}

async function fillAllStable(fields, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const [locator, value] of fields) await locator.fill(value);
    await sleep(400);
    let kept = true;
    for (const [locator, value] of fields) {
      if ((await locator.inputValue().catch(() => null)) !== value) {
        kept = false;
        break;
      }
    }
    if (kept) return;
  }
  throw new Error("the create form did not keep its values");
}

// The testnet edge can drop a navigation while DNS or the network changes.
// Retry a full page load; the app is stateless between loads.
async function goto(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      return;
    } catch (err) {
      lastError = err;
      await sleep(2000);
    }
  }
  throw lastError;
}

try {
  await goto(origin);
  await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
  await sleep(1200);

  begin("landing");
  await holdTo(16);

  begin("register");
  await click(page.getByRole("link", { name: "Get started" }));
  await page.getByRole("button", { name: "Connect" }).waitFor();
  await click(page.getByRole("button", { name: "Connect" }));
  // The demo payee is already registered, so the app redirects to the
  // dashboard. Wait for it before opening the profile; clicking during the
  // redirect can be lost under the next render.
  await page.getByRole("heading", { name: "Open invoices" }).waitFor();
  await page.locator('.side a[href="#/profile"]').waitFor();
  await click(page.locator('.side a[href="#/profile"]'));
  await page.locator("#name").waitFor();
  // Show the app-level name rule first: a taken name is refused with
  // available suggestions. Then re-register the demo name, which this address
  // already owns, so the registration transaction is real.
  await fill(page.locator("#name"), "solution kanu");
  await page.getByText("Name unavailable").waitFor();
  await sleep(2400);
  await fillStable(page.locator("#name"), NAME);
  await page.getByText("You own this name").waitFor();
  await page.waitForFunction(() => {
    const button = document.querySelector('#rename button[type="submit"]');
    return Boolean(button && !button.disabled);
  });
  await click(page.getByRole("button", { name: "Change name" }));
  await sleep(4500);
  await page.locator("#name").waitFor();
  await holdTo(20);

  begin("create");
  await page.locator('.side a[href="#/invoices/new"]').waitFor();
  await click(page.locator('.side a[href="#/invoices/new"]'));
  await page.locator("#amount").waitFor();
  await click(page.locator("#amount"));
  await fillAllStable([
    [page.locator("#amount"), AMOUNT],
    [page.locator("#reference"), REFERENCE],
    [page.locator("#due"), DUE],
  ]);
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
  await fill(page.locator("#claimed"), CLOSE_NAME);
  await page.getByText("This is close to the name on the invoice.").waitFor();
  await holdTo(26);

  begin("pay");
  await fillStable(page.locator("#claimed"), NAME);
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
  await goto(`${origin}/#/developers`);
  await page.getByRole("heading", { name: "Build on Ciro" }).waitFor();
  await page.getByText("@getciro/sdk").first().scrollIntoViewIfNeeded();
  await sleep(2200);
  await goto(`${origin}/#/stats`);
  await page.getByRole("heading", { name: "The state of Ciro." }).waitFor();
  await page.getByRole("heading", { name: "Live health" }).scrollIntoViewIfNeeded();
  await sleep(2600);
  await goto(`${origin}/#/names`);
  await page.getByRole("heading", { name: "Names registered on Ciro." }).waitFor();
  await sleep(2200);
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
