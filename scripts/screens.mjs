// Captures real screenshots of the Ciro app for the README.
//
// Usage, from the repo root:
//   node scripts/screens.mjs
//
// Boots an Anvil fixture and a Vite dev server, opens the app with a fake
// in-page wallet, drives the real flow, and saves PNGs to docs/screens/.
// Requires Foundry's `anvil` on PATH and `contracts/out/` built.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { startFixture } from "../packages/api/support/fixture.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "web");
const outDir = path.join(root, "docs/screens");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function walletSource(payee, payer) {
  return `(() => {
    const KEY = "ciro.screens.wallet";
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

const fx = await startFixture();
const payee = fx.accounts[1].address;
const payer = fx.accounts[2].address;
await fx.mint(2, 10_000_000n);

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
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(25_000);

const boot = `
  localStorage.setItem("ciro.apiUrl", ${JSON.stringify(fx.apiUrl)});
  localStorage.setItem("ciro.rpcUrl", ${JSON.stringify(`${origin}/rpc`)});
  ${walletSource(payee, payer)}
`;
await page.addInitScript({ content: boot });

const shot = async (name, fullPage = false) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });
  console.log(`saved docs/screens/${name}.png`);
};

try {
  await page.goto(`${origin}/#/`);
  await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
  await page.waitForFunction(
    () => {
      const v = document.querySelector(".stage-video");
      return v && (v.classList.contains("is-on") || v.readyState >= 2);
    },
    null,
    { timeout: 15_000 },
  ).catch(() => {});
  await sleep(2500);
  await shot("landing");

  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Connect" }).click();
  await page.locator("#name").fill("Elena Rossi");
  await page.getByRole("button", { name: "Register" }).click();
  await page.getByRole("heading", { name: "Open invoices" }).waitFor();

  await page.getByRole("link", { name: "Invoices" }).click();
  await page.getByRole("link", { name: "New invoice" }).click();
  await page.locator("#amount").fill("0.2");
  await page.locator("#reference").fill("March design");
  await page.locator("#due").fill("2026-12-31");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.getByRole("link", { name: "Open pay screen" }).waitFor();

  await page.goto(`${origin}/#/dashboard`);
  await page.getByRole("heading", { name: "Open invoices" }).waitFor();
  await sleep(700);
  await shot("dashboard");

  await page.getByRole("link", { name: "Invoices" }).click();
  await page.getByRole("link", { name: /March design/ }).click();
  await page.getByRole("link", { name: "Open pay screen" }).click();
  await page.getByLabel("Name you were told").waitFor();
  await page.evaluate(() => window.__ciroE2E.setAccount(1));
  await page.waitForFunction(() => document.querySelector("#claimed")?.value === "");
  await page.locator("#claimed").fill("Elena Rossi");
  await page.getByRole("button", { name: "Pay 0.200000 tUSD8" }).waitFor();
  await sleep(500);
  await shot("pay");

  await page.getByRole("button", { name: "Pay 0.200000 tUSD8" }).click();
  await page.getByText("Receipt 1").waitFor();
  await sleep(700);
  await shot("receipt");

  await page.goto(`${origin}/#/docs`);
  await page.getByRole("heading", { name: "Build on Ciro" }).waitFor();
  await sleep(500);
  await shot("docs");
} finally {
  await context.close();
  await browser.close();
  await vite.close();
  await fx.stop();
}

console.log(`saved to ${path.relative(root, outDir)}`);
