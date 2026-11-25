import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { startFixture } from "../../packages/api/support/fixture.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walletSource(payee, payer) {
  return `(() => {
    const KEY = "ciro.e2e.wallet";
    const accounts = ${JSON.stringify([payee, payer])};
    const listeners = {};
    function load() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
        if (saved && Array.isArray(saved.accounts)) return saved;
      } catch { /* keep the default */ }
      return { connected: false, accountIndex: 0, chainId: 31337, accounts };
    }
    let state = load();
    function save() { sessionStorage.setItem(KEY, JSON.stringify(state)); }
    function current() { return state.connected ? [state.accounts[state.accountIndex]] : []; }
    function emit(event, payload) {
      for (const fn of listeners[event] || []) fn(payload);
    }
    async function rpc(method, params) {
      const response = await fetch(localStorage.getItem("ciro.rpcUrl"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await response.json();
      if (json.error) {
        const error = new Error(json.error.message || "The chain did not answer.");
        error.code = json.error.code;
        throw error;
      }
      return json.result;
    }
    window.ethereum = {
      async request({ method, params }) {
        if (method === "eth_accounts") return current();
        if (method === "eth_requestAccounts") {
          state.connected = true;
          save();
          return current();
        }
        if (method === "eth_chainId") return "0x" + Number(state.chainId).toString(16);
        if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
          state.chainId = Number(params[0].chainId);
          save();
          location.reload();
          return null;
        }
        if (method === "wallet_revokePermissions") {
          state.connected = false;
          save();
          return null;
        }
        if (method === "eth_sendTransaction") return rpc(method, params);
        throw new Error("Unsupported wallet method " + method);
      },
      on(event, fn) { (listeners[event] ||= []).push(fn); },
      removeListener() {},
    };
    window.__ciroE2E = {
      setChain(id) {
        state.chainId = Number(id);
        save();
        location.reload();
      },
      setAccount(index) {
        state.accountIndex = Number(index);
        state.connected = true;
        save();
        emit("accountsChanged", current());
      },
    };
  })();`;
}

async function overflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

async function payButtonCount(page) {
  return page.getByRole("button", { name: /^Pay / }).count();
}

test("a payer can pay the exact name and cannot pay a close one", async () => {
  const fx = await startFixture();
  await fx.mint(2, 10_000_000n);
  const payee = fx.accounts[1].address;
  const payer = fx.accounts[2].address;
  const vite = await createServer({
    root: webRoot,
    configFile: path.join(webRoot, "vite.config.js"),
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 0,
      fs: { allow: [path.resolve(webRoot, "..")] },
      proxy: {
        "/rpc": {
          target: fx.rpcUrl,
          changeOrigin: true,
          rewrite: () => "/",
        },
      },
    },
  });
  await vite.listen();
  const bound = vite.httpServer.address();
  const origin = `http://127.0.0.1:${bound.port}`;
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20_000);
  const boot = `
    localStorage.setItem("ciro.apiUrl", ${JSON.stringify(fx.apiUrl)});
    localStorage.setItem("ciro.rpcUrl", ${JSON.stringify(`${origin}/rpc`)});
    ${walletSource(payee, payer)}
  `;
  try {
    await page.addInitScript({ content: boot });
    await page.goto(`${origin}/#/`);

    await page.getByRole("heading", { name: "An invoice that will not pay the wrong name." }).waitFor();
    assert.equal(await overflows(page), false);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await overflows(page), false);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByRole("link", { name: "Get started" }).click();
    await page.getByRole("button", { name: "Connect" }).click();
    await page.locator("#name").fill("Elena Rossi");
    await page.waitForFunction(() => document.querySelector("#preview")?.textContent?.includes("elena rossi"));
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByRole("heading", { name: "Open invoices" }).waitFor();
    assert.equal(await page.locator(".who").innerText(), "Elena Rossi");

    await page.getByRole("link", { name: "Invoices" }).click();
    await page.getByRole("heading", { name: "Invoices" }).waitFor();
    await page.getByRole("link", { name: "New invoice" }).click();
    await page.locator("#amount").fill("1");
    await page.locator("#reference").fill("March design");
    await page.locator("#due").fill("2026-12-31");
    await page.getByRole("button", { name: "Create invoice" }).click();
    await page.getByRole("link", { name: "Open pay screen" }).waitFor();
    await page.getByRole("button", { name: "Copy link" }).click();
    assert.equal(await page.getByRole("button", { name: "Copied" }).count(), 1);

    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("heading", { name: "Allowances" }).waitFor();
    await page.locator("#spender").fill(payer);
    await page.locator("#cap").fill("10");
    await page.locator("#expiry").fill("2026-12-31");
    await page.getByRole("button", { name: "Allow" }).click();
    await page.getByText(payer).waitFor();
    await page.getByRole("button", { name: "Revoke" }).click();
    await page.getByText("revoked").waitFor();
    assert.equal(await page.getByRole("button", { name: "Revoke" }).count(), 0);
    assert.match(await page.locator("body").innerText(), /charges 0/);

    await page.getByRole("link", { name: "Wallet" }).click();
    await page.getByRole("heading", { name: "Wallet" }).waitFor();
    assert.match(await page.locator("body").innerText(), new RegExp(payee));
    await page.getByRole("link", { name: "Profile" }).click();
    assert.match(await page.locator(".name").innerText(), /Elena Rossi/);
    await page.getByRole("link", { name: "Developers" }).click();
    assert.match(await page.locator("pre").first().innerText(), new RegExp(fx.apiUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await page.getByRole("link", { name: "History" }).click();
    await page.getByRole("heading", { name: "Your invoices" }).waitFor();
    assert.match(await page.locator("body").innerText(), /March design/);
    assert.match(await page.locator("body").innerText(), /refused never reached the chain/);

    await page.getByRole("link", { name: "Invoices" }).click();
    await page.getByRole("link", { name: /March design/ }).click();
    await page.getByRole("link", { name: "Open pay screen" }).click();
    await page.getByLabel("Name you were told").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await overflows(page), false);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.locator("#claimed").fill("Elena Rossa");
    await page.getByText("This is close to the name on the invoice.").waitFor();
    assert.equal(await payButtonCount(page), 0);

    await page.locator("#claimed").fill("Elena Rossi");
    await page.getByText("The name matches.").waitFor();
    await page.getByText("does not hold 1.000000 tUSD8").waitFor();
    assert.equal(await payButtonCount(page), 0);

    await page.evaluate(() => window.__ciroE2E.setAccount(1));
    await page.waitForFunction(() => document.querySelector("#claimed")?.value === "");
    await page.locator("#claimed").fill("Elena Rossi");
    await page.getByRole("button", { name: "Pay 1.000000 tUSD8" }).waitFor();

    await Promise.all([
      page.waitForEvent("framenavigated"),
      page.evaluate(() => window.__ciroE2E.setChain(1)).catch(() => {}),
    ]);
    await page.getByLabel("Name you were told").waitFor();
    await page.locator("#claimed").fill("Elena Rossi");
    await page.getByRole("button", { name: "Switch to Chain 31337" }).waitFor();
    assert.equal(await payButtonCount(page), 0);

    await Promise.all([
      page.waitForEvent("framenavigated"),
      page.getByRole("button", { name: "Switch to Chain 31337" }).click().catch(() => {}),
    ]);
    await page.getByLabel("Name you were told").waitFor();
    await page.locator("#claimed").fill("Elena Rossi");
    await page.getByRole("button", { name: "Pay 1.000000 tUSD8" }).click();
    await page.getByText("Receipt 1").waitFor();
    assert.match(await page.locator("body").innerText(), /1\.000000/);
    assert.match(await page.locator("body").innerText(), /Elena Rossi/);
    assert.match(await page.locator("body").innerText(), /March design/);
    assert.match(await page.locator("body").innerText(), /0x[0-9a-fA-F]{8}…[0-9a-fA-F]{6}/);
    assert.match(await page.locator("[data-tx]").getAttribute("data-tx"), /^0x[0-9a-fA-F]{64}$/);

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await overflows(page), false);
    await page.evaluate(() => window.__ciroE2E.setAccount(0));
    await page.goto(`${origin}/#/dashboard`);
    await page.getByRole("heading", { name: "Latest receipts" }).waitFor();
    assert.match(await page.locator("body").innerText(), /Paid/);
    assert.equal(await overflows(page), false);

    await page.getByRole("button", { name: "More" }).click();
    await page.locator('#sheet a[href="#/wallet"]').click();
    await page.getByRole("heading", { name: "Wallet" }).waitFor();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Get test tUSD8" }).click();
    await page.getByRole("button", { name: "Minted 1,000 tUSD8" }).waitFor();
    assert.equal(await overflows(page), false);
  } catch (err) {
    await page.screenshot({ path: "/tmp/ciro-e2e.png", fullPage: true }).catch(() => {});
    const detail = await page.locator("#form-error").innerText().catch(() => "");
    const body = await page.locator("body").innerText().catch(() => "");
    throw new Error(`${err.message}\nform: ${detail}\npage: ${body.slice(0, 1200)}`);
  } finally {
    await browser.close();
    await vite.close();
    await fx.stop();
  }
});
