import { api } from "./api.js";
import { esc } from "./format.js";
import {
  bindCopy,
  bindCreate,
  bindDevelopers,
  bindLanding,
  bindPay,
  bindProfile,
  bindReceipt,
  bindSettings,
  bindShell,
  bindStart,
  bindWallet,
  bindDocs,
  dashboard,
  developersPage,
  docsPage,
  historyPage,
  invoiceDetail,
  invoicesPage,
  landing,
  loadPayee,
  newInvoice,
  payPage,
  profilePage,
  receiptPage,
  settingsPage,
  startPage,
  walletPage,
} from "./pages.js";
import { aevumDeployment, apiUrl, rpcUrl, session } from "./session.js";
import { DEMO_PAYEE, pickDemoInvoice } from "./demo.js";
import { refreshWallet } from "./wallet.js";

const app = document.querySelector("#app");

function draw(html) {
  app.innerHTML = html;
  bindShell();
}

function showError(err) {
  draw(`<div class="pub"><main class="doc-wrap pub-main"><p class="bad">${esc(err.message || "Something failed.")}</p></main></div>`);
}

let ticket = 0;

async function ensureMeta() {
  if (session.meta) return;
  const meta = await api("GET", "/v1/meta");
  if (import.meta.env.PROD && Number(meta.chainId) !== 44005) {
    throw new Error("This build only supports Aevum testnet.");
  }
  const pinned = aevumDeployment(meta.chainId);
  if (pinned) {
    const contract = String(meta.contract || "").toLowerCase();
    const token = String(meta.token || "").toLowerCase();
    if (contract !== pinned.contract || token !== pinned.token) {
      throw new Error("The API does not match the deployed Ciro contract.");
    }
  }
  session.meta = meta;
}

async function go() {
  const mine = ++ticket;
  let path = (location.hash.replace(/^#/, "") || "/").split("?")[0];
  let parts = path.split("/").filter(Boolean);
  try {
    await refreshWallet();
    if (mine !== ticket) return;
    if (path === "/demo") {
      // The public demo link points at this route, not a fixed invoice. It
      // follows the newest open 0.2 tUSD8 "Demo invoice", so paying the demo
      // does not turn the onboarding link into a receipt.
      await ensureMeta();
      const { invoices } = await api("GET", `/v1/payees/${DEMO_PAYEE}/invoices`);
      const demo = pickDemoInvoice(invoices);
      if (!demo) {
        throw new Error("No open demo invoice is available right now. Create an invoice to try the flow.");
      }
      path = `/pay/${demo.id}`;
      parts = ["pay", demo.id];
      history.replaceState(null, "", `#/pay/${demo.id}`);
    }
    if (path === "/history") {
      void loadPayee().catch(() => {});
      void ensureMeta().catch(() => {});
      draw(await historyPage());
      return;
    }
    if (session.account) await loadPayee();
    if (mine !== ticket) return;
    if (path === "/docs") {
      await ensureMeta().catch(() => {});
      if (mine !== ticket) return;
      draw(docsPage());
      bindDocs();
      return;
    }
    if (path === "/developers") {
      await ensureMeta().catch(() => {});
      if (mine !== ticket) return;
      draw(developersPage(apiUrl(), rpcUrl()));
      bindDevelopers(go);
      return;
    }
    if (parts[0] !== undefined && path !== "/") await ensureMeta();
    if (mine !== ticket) return;
    if (path === "how" || path === "faq") {
      draw(landing());
      bindLanding();
      document.querySelector(`#${path}`)?.scrollIntoView({ block: "start" });
      return;
    }
    if (path === "/" || path === "") {
      draw(landing());
      bindLanding();
      return;
    }
    if (path === "/start") {
      const html = await startPage();
      if (mine !== ticket) return;
      if (html == null) {
        location.hash = "#/dashboard";
        return;
      }
      draw(html);
      bindStart(go);
      return;
    }
    if (parts[0] === "pay" && parts[1]) {
      await ensureMeta();
      const html = await payPage(parts[1]);
      if (mine !== ticket) return;
      if (html == null) {
        location.hash = `#/receipt/${parts[1]}`;
        return;
      }
      draw(html);
      bindPay(parts[1]);
      return;
    }
    if (parts[0] === "receipt" && parts[1]) {
      draw(await receiptPage(parts[1]));
      bindReceipt();
      return;
    }
    if (!session.account) {
      location.hash = "#/start";
      return;
    }
    if (path === "/dashboard") {
      draw(await dashboard());
      bindCopy();
      return;
    }
    if (path === "/invoices/new") {
      draw(newInvoice());
      bindCreate();
      return;
    }
    if (path === "/invoices") {
      draw(await invoicesPage());
      return;
    }
    if (parts[0] === "invoices" && parts[1]) {
      draw(await invoiceDetail(parts[1]));
      bindCopy();
      document.querySelector("#copy-link")?.addEventListener("click", (event) => {
        const url = `${location.origin}${location.pathname}#/pay/${event.currentTarget.dataset.id}`;
        navigator.clipboard?.writeText(url);
        event.currentTarget.textContent = "Copied";
      });
      return;
    }
    if (path === "/wallet") {
      draw(await walletPage());
      bindWallet(go);
      return;
    }
    if (path === "/profile") {
      draw(profilePage());
      bindProfile(go);
      return;
    }
    if (path === "/settings") {
      draw(await settingsPage());
      bindSettings(go);
      return;
    }
    draw(landing());
    bindLanding();
  } catch (err) {
    if (mine !== ticket) return;
    showError(err);
  }
}

window.addEventListener("hashchange", () => {
  go();
});

ensureMeta().catch(() => {}).finally(go);
