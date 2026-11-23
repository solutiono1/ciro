// Records a real click-through of the Ciro app for the landing backdrop.
//
// Usage, from the repo root:
//   node scripts/record-demo.mjs [output.webm]
//
// It boots an Anvil fixture and a Vite dev server, opens the app with a fake
// in-page wallet, and drives the real flow: register a name, create an invoice,
// open the pay screen, show a close name refuse, then pay with the exact name.
// The result is saved to web/public/media/ciro-demo.webm by default, which the
// landing page auto-plays over its drawn preview. Replace the file with any
// webm/mp4 recording of the app if you prefer your own take.
//
// Requirements: Foundry's `anvil` on PATH, `contracts/out/` built (`forge build`).

import { mkdir, readdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { startFixture } from "../packages/api/support/fixture.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "web");
const outArg = process.argv[2];
const outFile = path.resolve(root, outArg || "web/public/media/ciro-demo.webm");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A visible cursor that follows the scripted mouse so the recording reads as
// real usage, not a jump cut between screens.
const cursorScript = `(() => {
  const style = document.createElement("style");
  style.textContent = \`
    #__demo_cursor { position: fixed; z-index: 2147483647; width: 16px; height: 16px;
      margin: -8px 0 0 -8px; border-radius: 50%; background: #0e0e12;
      pointer-events: none; box-shadow: 0 0 0 2px rgba(255,255,255,0.9);
      transition: transform 90ms linear; }
    #__demo_cursor.ring::after { content: ""; position: absolute; inset: -7px;
      border: 1px solid #0e0e12; border-radius: 50%; opacity: 0; animation: __demo_ring 420ms ease-out; }
    @keyframes __demo_ring { 0% { transform: scale(0.4); opacity: 0.9; } 100% { transform: scale(1.6); opacity: 0; } }
  \`;
  document.head.appendChild(style);
  const dot = document.createElement("div");
  dot.id = "__demo_cursor";
  document.documentElement.appendChild(dot);
  addEventListener("mousemove", (e) => {
    dot.style.left = e.clientX + "px";
    dot.style.top = e.clientY + "px";
  });
  addEventListener("mousedown", () => dot.classList.add("ring"));
  addEventListener("mouseup", () => { dot.classList.remove("ring"); void dot.offsetWidth; dot.classList.add("ring"); });
})();`;

function walletSource(payee, payer) {
  return `(() => {
    const KEY = "ciro.demo.wallet";
    const accounts = ${JSON.stringify([payee, payer])};
    const listeners = {};
    function load() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
        if (saved && Array.isArray(saved.accounts)) return saved;
      } catch {}
      return { connected: false, accountIndex: 0, chainId: 31337, accounts };
    }
    let state = load();
    function save() { sessionStorage.setItem(KEY, JSON.stringify(state)); }
    function current() { return state.connected ? [state.accounts[state.accountIndex]] : []; }
    function emit(event, payload) { for (const fn of listeners[event] || []) fn(payload); }
    async function rpc(method, params) {
      const response = await fetch(localStorage.getItem("ciro.rpcUrl"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await response.json();
      if (json.error) { const e = new Error(json.error.message); e.code = json.error.code; throw e; }
      return json.result;
    }
    window.ethereum = {
      async request({ method, params }) {
        if (method === "eth_accounts") return current();
        if (method === "eth_requestAccounts") { state.connected = true; save(); return current(); }
        if (method === "eth_chainId") return "0x" + Number(state.chainId).toString(16);
        if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
          state.chainId = Number(params[0].chainId); save(); location.reload(); return null;
        }
        if (method === "wallet_revokePermissions") { state.connected = false; save(); return null; }
        if (method === "eth_sendTransaction") return rpc(method, params);
        throw new Error("Unsupported wallet method " + method);
      },
      on(event, fn) { (listeners[event] ||= []).push(fn); },
      removeListener() {},
    };
    window.__ciroE2E = {
      setAccount(index) { state.accountIndex = Number(index); state.connected = true; save(); emit("accountsChanged", current()); },
    };
  })();`;
}

async function moveTo(page, locator, steps = 14) {
  const box = await locator.boundingBox();
  if (!box) return;
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const from = await page.evaluate(() => ({ x: window.__lastMouseX ?? 0, y: window.__lastMouseY ?? 0 }));
  for (let step = 1; step <= steps; step += 1) {
    const x = from.x + ((target.x - from.x) * step) / steps;
    const y = from.y + ((target.y - from.y) * step) / steps;
    await page.mouse.move(x, y);
    await page.evaluate(([mx, my]) => { window.__lastMouseX = mx; window.__lastMouseY = my; }, [x, y]);
    await sleep(16);
  }
  await page.mouse.move(target.x, target.y);
}

async function click(page, locator) {
  await moveTo(page, locator);
  await locator.click();
  await sleep(220);
}

const fx = await startFixture();
const payee = fx.accounts[1].address;
const payer = fx.accounts[2].address;
await fx.mint(2, 10_000_000n); // 10 tUSD8 for the payer, gas stays on Anvil dev ETH

const vite = await createServer({
  root: webRoot,
  configFile: path.join(webRoot, "vite.config.js"),
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 0,
    fs: { allow: [path.resolve(webRoot, "..")] },
    proxy: { "/rpc": { target: fx.rpcUrl, changeOrigin: true, rewrite: () => "/" } },
  },
});
await vite.listen();
const bound = vite.httpServer.address();
const origin = `http://127.0.0.1:${bound.port}`;

const recordDir = path.join(root, ".ciro-record");
await rm(recordDir, { recursive: true, force: true });
await mkdir(recordDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: recordDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);

const boot = `
  localStorage.setItem("ciro.apiUrl", ${JSON.stringify(fx.apiUrl)});
  localStorage.setItem("ciro.rpcUrl", ${JSON.stringify(`${origin}/rpc`)});
  ${walletSource(payee, payer)}
  ${cursorScript}
`;
await page.addInitScript({ content: boot });

try {
  await page.goto(`${origin}/#/`);
  await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
  await sleep(900);

  // Land on the app and register.
  await click(page, page.getByRole("link", { name: "Get started" }));
  await click(page, page.getByRole("button", { name: "Connect" }));
  await click(page, page.locator("#name"));
  await page.locator("#name").fill("Ada Okonkwo");
  await page.waitForFunction(() => document.querySelector("#preview")?.textContent?.includes("ada okonkwo"));
  await click(page, page.getByRole("button", { name: "Register" }));
  await page.getByRole("heading", { name: "Open invoices" }).waitFor();
  await sleep(600);

  // Create an invoice and copy its link.
  await click(page, page.getByRole("link", { name: "Invoices" }));
  await page.getByRole("heading", { name: "Invoices" }).waitFor();
  await click(page, page.getByRole("link", { name: "New invoice" }));
  await click(page, page.locator("#amount"));
  await page.locator("#amount").fill("1");
  await page.locator("#reference").fill("March design");
  await page.locator("#due").fill("2026-12-31");
  await click(page, page.getByRole("button", { name: "Create invoice" }));
  await page.getByRole("link", { name: "Open pay screen" }).waitFor();
  await click(page, page.getByRole("button", { name: "Copy link" }));
  await sleep(500);

  // Open the pay screen and show a close name refuse.
  await click(page, page.getByRole("link", { name: "Open pay screen" }));
  await page.getByLabel("Name you were told").waitFor();
  await click(page, page.locator("#claimed"));
  await page.locator("#claimed").fill("Ada Okonkwa");
  await page.getByText("This is close to the name on the invoice.").waitFor();
  await sleep(800);

  // Switch to the payer and settle with the exact name.
  await page.evaluate(() => window.__ciroE2E.setAccount(1));
  await page.waitForFunction(() => document.querySelector("#claimed")?.value === "");
  await click(page, page.locator("#claimed"));
  await page.locator("#claimed").fill("Ada Okonkwo");
  const pay = page.getByRole("button", { name: "Pay 1.000000 tUSD8" });
  await pay.waitFor();
  await click(page, pay);
  await page.getByText("Receipt 1").waitFor();
  await sleep(1200);
} finally {
  await context.close();
  await browser.close();
  await vite.close();
  await fx.stop();
}

const files = await readdir(recordDir);
const recording = files.find((name) => name.endsWith(".webm"));
if (!recording) {
  console.error("No recording produced. The flow may have failed before the browser closed.");
  process.exit(1);
}
await mkdir(path.dirname(outFile), { recursive: true });
await copyFile(path.join(recordDir, recording), outFile);
await rm(recordDir, { recursive: true, force: true });
console.log(`Saved ${path.relative(root, outFile)} (${recording})`);
