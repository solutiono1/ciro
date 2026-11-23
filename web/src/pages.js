import { api } from "./api.js";
import { esc, feeLine, foldedText, formatUnits, parseHuman, shortAddress, when } from "./format.js";
import { payDecision } from "./pay-state.js";
import {
  apiUrl,
  chainName,
  explorerAddress,
  explorerTx,
  faucetUrl,
  rpcUrl,
  session,
  setEndpoints,
} from "./session.js";
import {
  addNetwork,
  broadcast,
  connect,
  createdId,
  disconnect,
  nativeBalance,
  provider,
  switchTo,
  tokenBalance,
} from "./wallet.js";

const NAV = [
  ["/dashboard", "Dashboard", "dashboard"],
  ["/invoices", "Invoices", "invoices"],
  ["/history", "History", "history"],
  ["/wallet", "Wallet", "wallet"],
  ["/profile", "Profile", "profile"],
  ["/settings", "Settings", "settings"],
  ["/developers", "Developers", "developers"],
];

const TITLES = {
  "/dashboard": "Dashboard",
  "/invoices": "Invoices",
  "/history": "History",
  "/wallet": "Wallet",
  "/profile": "Profile",
  "/settings": "Settings",
  "/developers": "Developers",
  "/start": "Get started",
};

const ICONS = {
  dashboard:
    '<path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>',
  invoices:
    '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h6"/><path d="M9 16h4"/>',
  history:
    '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M12 7v5l3 2"/>',
  wallet:
    '<path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V6a2 2 0 0 1 2-2h11"/><path d="M17 13h.01"/>',
  profile:
    '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  settings:
    '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M9 6a2 2 0 1 0 0-.01"/><path d="M15 12a2 2 0 1 0 0-.01"/><path d="M7 18a2 2 0 1 0 0-.01"/>',
  developers:
    '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13 5l-2 14"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  copy: '<path d="M9 9h10v12H9z"/><path d="M5 15V3h10"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  more: '<path d="M6 12h.01"/><path d="M12 12h.01"/><path d="M18 12h.01"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/><path d="M8 7h8"/><path d="M8 11h6"/>',
  droplet: '<path d="M12 3s6 6.3 6 10a6 6 0 0 1-12 0c0-3.7 6-10 6-10z"/>',
  globe: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M3 12h18"/><path d="M12 3c2.4 2.4 3.6 5.4 3.6 9S14.4 18.6 12 21c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3z"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
};

function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
}

function arrow() {
  return icon("arrow", "arrow");
}

function netLabel() {
  if (!session.meta) return "Aevum testnet";
  return session.meta.chainId === 44005 ? "Aevum testnet" : chainName(session.meta.chainId);
}

function publicBar(withApp, minimal = false) {
  const links = minimal
    ? ""
    : `<nav class="pub-nav" aria-label="Site">
        <a href="#how">How it works</a>
        <a href="#faq">FAQ</a>
        <a href="#/docs">Docs</a>
      </nav>`;
  return `<header class="pub-bar">
    <div class="pub-inner">
      <a class="brand" href="#/">Ciro</a>
      ${links}
      <div class="pub-right">
        ${withApp ? `<a class="btn btn-primary btn-sm" href="#/start">Open app</a>` : ""}
      </div>
    </div>
  </header>`;
}

function publicShell(body, withApp = false, minimal = false) {
  return `<div class="pub">${publicBar(withApp, minimal)}${body}</div>`;
}

function docShell(body) {
  return publicShell(body, false, true);
}

function footer() {
  return `<footer class="pub-foot">
    <div class="foot-inner">
      <div class="foot-brand">
        <a class="brand" href="#/">Ciro</a>
        <p class="foot-line">Invoices that only pay the registered name.</p>
      </div>
      <div class="foot-cols">
        <div class="foot-col">
          <p class="foot-title">Product</p>
          <a href="#/start">Open app</a>
          <button type="button" data-scroll="how">How it works</button>
          <button type="button" data-scroll="faq">FAQ</button>
        </div>
        <div class="foot-col">
          <p class="foot-title">Build</p>
          <a href="#/docs">Docs</a>
          <a href="#/docs">API and CLI</a>
          <a href="#/docs">Contract</a>
        </div>
        <div class="foot-col">
          <p class="foot-title">Network</p>
          <a href="https://explorer-test.qday.info" rel="noopener">Explorer ${icon("external", "ic-16")}</a>
          <a href="https://faucet.qday.info/en" rel="noopener">tQDAY faucet ${icon("external", "ic-16")}</a>
          <a href="#/docs">Add network</a>
        </div>
      </div>
    </div>
    <div class="foot-base">
      <p>Testnet funds only. No real money moves.</p>
      <p class="mono">Ciro</p>
    </div>
  </footer>`;
}

function navLink([href, label, key], current) {
  const here = current === href ? ' aria-current="page"' : "";
  return `<a href="#${href}"${here}>${icon(key)}<span>${label}</span></a>`;
}

function tabBar(current) {
  const here = (path) => (current === path ? ' aria-current="page"' : "");
  return `<nav class="tabs" aria-label="App sections">
    <a href="#/dashboard"${here("/dashboard")}>${icon("dashboard", "ic-22")}<span>Dashboard</span></a>
    <a href="#/invoices"${here("/invoices")}>${icon("invoices", "ic-22")}<span>Invoices</span></a>
    <a class="new-tab" href="#/invoices/new" aria-label="New invoice">${icon("plus", "ic-22")}<span>New</span></a>
    <a href="#/history"${here("/history")}>${icon("history", "ic-22")}<span>History</span></a>
    <button type="button" id="tabs-more" aria-expanded="false" aria-controls="sheet">${icon("more", "ic-22")}<span>More</span></button>
  </nav>`;
}

function sheet() {
  return `<div class="sheet" id="sheet" hidden>
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="More sections">
      <a href="#/wallet">${icon("wallet")}Wallet</a>
      <a href="#/profile">${icon("profile")}Profile</a>
      <a href="#/settings">${icon("settings")}Settings</a>
      <a href="#/developers">${icon("developers")}Developers</a>
      <button type="button" id="sheet-faucet">${icon("droplet")}<span>Get test tUSD8</span></button>
      <button class="close" type="button" data-close-sheet>${icon("close")}Close</button>
    </div>
  </div>`;
}

function frame(body, current, title) {
  const who = session.payee?.registered
    ? esc(session.payee.name)
    : session.account
      ? esc(shortAddress(session.account))
      : "";
  const heading = esc(title || TITLES[current] || "Ciro");
  return `<div class="shell">
    <aside class="side">
      <div class="side-top"><a class="brand" href="#/">Ciro</a></div>
      <div class="side-new">
        <a class="new-invoice" href="#/invoices/new">${icon("plus", "ic-18")}<span>New invoice</span></a>
      </div>
      <nav class="side-nav" aria-label="App sections">
        ${NAV.map((item) => navLink(item, current)).join("")}
      </nav>
      ${session.account && session.meta?.feeBps === 0 ? `<div class="side-faucet">
        <button type="button" id="side-faucet">${icon("droplet", "ic-18")}<span>Get test tUSD8</span></button>
        <p class="side-faucet-status" id="side-faucet-status" role="status"></p>
      </div>` : ""}
      <div class="side-foot">
        <p class="net"><span class="dot"></span>${esc(netLabel())}</p>
        <p class="side-addr mono">${esc(shortAddress(session.account) || "No wallet connected")}</p>
      </div>
    </aside>
    <div class="app">
      <header class="bar">
        <a class="brand bar-brand" href="#/">Ciro</a>
        <h1 class="page">${heading}</h1>
        <div class="bar-right">
          <span class="net bar-net"><span class="dot"></span>${esc(netLabel())}</span>
          <span class="who">${who}</span>
        </div>
      </header>
      <main class="main">${body}</main>
    </div>
    ${tabBar(current)}
    ${sheet()}
  </div>`;
}

let shellBound = false;

async function requestTestToken(button, statusEl) {
  // On Aevum, tUSD8 is the network's token and has no public mint. Send the
  // user to the official QDay faucet instead of building a mint that reverts.
  if (session.meta?.chainId === 44005) {
    const href = faucetUrl();
    if (href) window.open(href, "_blank", "noopener");
    if (statusEl) statusEl.textContent = "tUSD8 comes from the QDay faucet. It opened in a new tab.";
    return false;
  }
  if (!session.account) {
    location.hash = "#/start";
    return false;
  }
  const label = button?.querySelector("span");
  const original = label ? label.textContent : "";
  if (button) button.disabled = true;
  if (label) label.textContent = "Minting 1,000 tUSD8";
  try {
    const tx = await api("POST", "/v1/tx/faucet", { address: session.account });
    await broadcast([tx]);
    if (statusEl) statusEl.textContent = "Minted 1,000 tUSD8.";
    if (label) label.textContent = "Minted 1,000 tUSD8";
    return true;
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || "The mint failed.";
    if (label) label.textContent = "Mint failed";
    return false;
  } finally {
    if (button) button.disabled = false;
    if (label) setTimeout(() => { label.textContent = original; }, 2400);
  }
}

export function bindShell() {
  const more = document.querySelector("#tabs-more");
  const panel = document.querySelector("#sheet");
  document.querySelector("#side-faucet")?.addEventListener("click", (event) =>
    requestTestToken(event.currentTarget, document.querySelector("#side-faucet-status")),
  );
  document.querySelector("#sheet-faucet")?.addEventListener("click", (event) =>
    requestTestToken(event.currentTarget, null),
  );
  if (!more || !panel) return;
  const setOpen = (open) => {
    panel.hidden = !open;
    more.setAttribute("aria-expanded", String(open));
    if (open) panel.querySelector("a")?.focus();
  };
  more.addEventListener("click", () => setOpen(panel.hidden));
  panel.addEventListener("click", (event) => {
    if (event.target === panel || event.target.closest("[data-close-sheet]")) setOpen(false);
  });
  panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  if (!shellBound) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const open = document.querySelector("#sheet");
      if (!open || open.hidden) return;
      open.hidden = true;
      document.querySelector("#tabs-more")?.setAttribute("aria-expanded", "false");
    });
    shellBound = true;
  }
}

/* Landing */

function appStage() {
  return `<section class="stage-wrap" aria-label="A preview of the Ciro app">
    <!-- The screen recording (web/public/media/ciro-demo.webm) plays over this
         drawn preview when it exists. Until then the preview below holds the
         space, so the landing never shows a broken video. -->
    <div class="wallpaper">
      <div class="stage" data-preview>
        <div class="stage-bar">
          <span class="stage-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="stage-title">Ciro · dashboard</span>
          <span class="stage-tag">Screen recording</span>
        </div>
        <div class="stage-frame">
          <video class="stage-video" data-demo src="/media/ciro-demo.webm" muted loop playsinline autoplay aria-hidden="true" tabindex="-1"></video>
          <div class="stage-app" aria-hidden="true">
        <aside class="stage-side">
          <p class="stage-brand">Ciro</p>
          <div class="stage-new">${icon("plus", "ic-16")}<span>New invoice</span></div>
          <div class="stage-nav">
            <span class="is-on">${icon("dashboard")}<span>Dashboard</span></span>
            <span>${icon("invoices")}<span>Invoices</span></span>
            <span>${icon("history")}<span>History</span></span>
            <span>${icon("wallet")}<span>Wallet</span></span>
          </div>
          <div class="stage-side-foot">
            <span class="net"><span class="dot"></span>Aevum testnet</span>
            <p class="mono">Ada Okonkwo</p>
          </div>
        </aside>
        <div class="stage-main">
          <div class="stage-head"><p>Dashboard</p><span>Ada Okonkwo</span></div>
          <div class="stage-body">
            <div class="stage-quick">
              <span>${icon("link")}<b>Copy latest link</b></span>
              <span>${icon("history")}<b>History</b></span>
              <span>${icon("wallet")}<b>Wallet</b></span>
            </div>
            <p class="stage-label">Open invoices</p>
            <div class="stage-list">
              <div class="stage-row">
                <span class="stage-row-main"><b>1.000000 tUSD8</b><em>March design</em></span>
                <span class="status status-open">Open</span>
              </div>
              <div class="stage-row">
                <span class="stage-row-main"><b>2.400000 tUSD8</b><em>Retainer, April</em></span>
                <span class="status status-open">Open</span>
              </div>
            </div>
            <p class="stage-label">Latest receipts</p>
            <div class="stage-list">
              <div class="stage-row">
                <span class="stage-row-main"><b>850.000000 tUSD8</b><em>Studio deposit</em></span>
                <span class="status status-paid">Paid</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
    </div>
  </section>`;
}

const FAQ = [
  [
    "What is Ciro?",
    "An invoice on Aevum testnet. The payee registers a name, creates an invoice, and sends a link. The payer confirms the name and pays the exact amount.",
  ],
  [
    "Why does the payer type a name?",
    "A name is easier to check than a hex address. The contract compares the typed name to the registered name and refuses anything that is not exact.",
  ],
  [
    "What happens when the name is close?",
    "Nothing is sent. The screen says it is close and shows no pay button. Edit the name or ask the payee.",
  ],
  [
    "Does Ciro hold my money?",
    "No. Ciro prepares an unsigned transaction. Your wallet signs it, and the token moves from your wallet to the payee.",
  ],
  [
    "Which network does it use?",
    "Aevum testnet, chain 44005. If your wallet does not know the network, the app adds it before it switches.",
  ],
  [
    "What does it cost?",
    "This deployment charges a zero fee. A later priced deployment charges 0.5%, shown before the payer confirms. Gas is paid in tQDAY.",
  ],
  [
    "Can I pay without an account?",
    "Yes. Open the link, connect a wallet, type the name, and pay. You do not need a profile.",
  ],
  [
    "What happens after the due date?",
    "The invoice closes unpaid. The pay screen shows the due time and no pay button.",
  ],
  [
    "Is this real money?",
    "No. This build uses testnet tokens. Do not send funds you would miss.",
  ],
];

function faq() {
  return `<section class="section faq" id="faq" aria-labelledby="faq-title">
    <div class="section-head">
      <p class="bracket">[ FAQ ]</p>
      <h2 class="h2" id="faq-title">Questions before the first invoice.</h2>
    </div>
    <div class="faq-list card">
      ${FAQ.map(([q, a], index) => `<details class="faq-item"${index === 0 ? " open" : ""}>
        <summary><span>${q}</span><span class="faq-mark" aria-hidden="true"></span></summary>
        <div class="faq-a"><p>${a}</p></div>
      </details>`).join("")}
    </div>
  </section>`;
}

function docsTeaser() {
  return `<section class="section" id="build" aria-labelledby="build-title">
    <div class="section-head">
      <p class="bracket">[ Build ]</p>
      <h2 class="h2" id="build-title">The API, the CLI, and an MCP server.</h2>
      <p class="lede">Read an invoice without a key. Prepare a payment without signing it. Every route and both contract addresses are in the docs.</p>
    </div>
    <div class="build-grid">
      <a class="card build-card" href="#/docs">
        <span class="build-icon">${icon("globe")}</span>
        <span class="build-title">API</span>
        <code>GET /v1/invoices/1</code>
        <span class="build-link">Read the routes ${arrow()}</span>
      </a>
      <a class="card build-card" href="#/docs">
        <span class="build-icon">${icon("developers")}</span>
        <span class="build-title">CLI</span>
        <code>ciro pay 4 --name "Ada Okonkwo"</code>
        <span class="build-link">See the commands ${arrow()}</span>
      </a>
      <a class="card build-card" href="#/docs">
        <span class="build-icon">${icon("book")}</span>
        <span class="build-title">MCP</span>
        <code>node packages/mcp/bin/ciro-mcp.js</code>
        <span class="build-link">Connect an agent ${arrow()}</span>
      </a>
    </div>
  </section>`;
}

function lookup() {
  return `<section class="section" id="lookup" aria-labelledby="lookup-title">
    <div class="link-card card">
      <div class="card-pad">
        <p class="bracket">[ Have a link? ]</p>
        <h2 class="h2" id="lookup-title">Open an invoice.</h2>
        <p class="lede">Paste the link or the invoice number. You do not need an account to look.</p>
        <form id="open-invoice" class="link-form">
          <label class="sr-only" for="link">Invoice link or number</label>
          <input id="link" name="link" autocomplete="off" placeholder="Invoice number or link" />
          <button class="btn btn-primary" type="submit">Open</button>
        </form>
        <p id="link-error" class="bad"></p>
      </div>
    </div>
  </section>`;
}

export function landing() {
  return publicShell(`
    <main class="container landing pub-main">
      <section class="hero">
        <div class="hero-copy">
          <h1 class="display">An invoice that will not pay the wrong name.</h1>
          <p class="lede">The payer types the name they were told. The amount is locked, and it only moves when the name matches.</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/start"><span>Get started</span>${arrow()}</a>
            <button class="btn btn-lg" type="button" data-scroll="lookup"><span>I have a link</span>${arrow()}</button>
          </div>
        </div>
      </section>
      ${appStage()}
      <section class="section" id="how" aria-labelledby="how-title">
        <div class="section-head">
          <p class="bracket">[ How it works ]</p>
          <h2 class="h2" id="how-title">Three steps, one name.</h2>
        </div>
        <ol class="card steps">
          <li class="step">
            <span class="step-icon" aria-hidden="true">${icon("profile")}</span>
            <p class="bracket">01</p>
            <h3 class="h3">Register a name</h3>
            <p>The name you want to be paid under. It is folded, so capitals and extra spaces still match.</p>
          </li>
          <li class="step">
            <span class="step-icon" aria-hidden="true">${icon("invoices")}</span>
            <p class="bracket">02</p>
            <h3 class="h3">Send the invoice</h3>
            <p>Amount, reference, due date. The network is fixed and the fee is shown before anyone signs.</p>
          </li>
          <li class="step">
            <span class="step-icon" aria-hidden="true">${icon("check")}</span>
            <p class="bracket">03</p>
            <h3 class="h3">The payer confirms</h3>
            <p>They type the name they were told. Close or unknown shows no pay button. Exact shows one.</p>
          </li>
        </ol>
      </section>
      <section class="section split-why" aria-labelledby="why-title">
        <div class="why-media">
          <div class="slides" data-slides aria-hidden="true">
            <img src="/img/paperwork-desk.jpg" alt="" width="960" height="640" loading="lazy" decoding="async" />
            <img src="/img/finance-flatlay.jpg" alt="" width="960" height="640" loading="lazy" decoding="async" />
            <img src="/img/calculator-numbers.jpg" alt="" width="960" height="640" loading="lazy" decoding="async" />
            <img src="/img/accounting-finance.jpg" alt="" width="960" height="640" loading="lazy" decoding="async" />
            <img src="/img/macbook-laptop.jpg" alt="" width="960" height="640" loading="lazy" decoding="async" />
          </div>
          <div class="slides-dots" data-slides-dots aria-hidden="true"></div>
        </div>
        <div class="why-copy">
          <p class="bracket">[ Why a name ]</p>
          <h2 class="h2" id="why-title">The name is the check, not a label.</h2>
          <p class="lede">A wallet address is easy to copy wrong and hard to check. A registered name is something two people can agree on out loud.</p>
          <dl class="why-facts">
            <div><dt>Exact</dt><dd>The name matches the invoice. The pay button appears.</dd></div>
            <div><dt>Close</dt><dd>One letter or one space off. No pay button.</dd></div>
            <div><dt>Unknown</dt><dd>Not the registered name. No pay button.</dd></div>
          </dl>
        </div>
      </section>
      ${faq()}
      ${docsTeaser()}
      ${lookup()}
    </main>
    ${footer()}
  `, true);
}

export function bindLanding() {
  for (const trigger of document.querySelectorAll("[data-scroll]")) {
    trigger.addEventListener("click", () => {
      document.querySelector(`#${trigger.dataset.scroll}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  // The demo video plays over the drawn preview once it loads. When the file
  // is missing, the error removes the video and the preview stays visible.
  const video = document.querySelector(".stage-video[data-demo]");
  if (video) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.remove();
    } else {
      video.addEventListener("loadeddata", () => video.classList.add("is-on"));
      video.addEventListener("error", () => video.remove(), { once: true });
    }
  }
  // The why-section photos crossfade on their own, each with a progress dot
  // that fills over the slide's duration. One slide visible at a time;
  // reduced motion keeps the first still.
  const slides = document.querySelector("[data-slides]");
  const dotsBox = document.querySelector("[data-slides-dots]");
  if (slides) {
    const imgs = [...slides.querySelectorAll("img")];
    if (imgs.length) {
      imgs[0].classList.add("is-on");
      if (dotsBox) {
        imgs.forEach(() => dotsBox.appendChild(Object.assign(document.createElement("span"), { className: "slide-dot" })));
      }
      if (imgs.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const SLIDE_MS = 4000;
        dotsBox?.style.setProperty("--slide-ms", `${SLIDE_MS}ms`);
        let index = 0;
        const paint = () => {
          [...(dotsBox?.children ?? [])].forEach((dot, i) => {
            dot.classList.toggle("is-done", i < index);
            dot.classList.toggle("is-on", i === index);
          });
        };
        paint();
        setInterval(() => {
          index = (index + 1) % imgs.length;
          imgs.forEach((img, i) => img.classList.toggle("is-on", i === index));
          paint();
        }, SLIDE_MS);
      }
    }
  }
  document.querySelector("#open-invoice")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = document.querySelector("#link").value.trim();
    const match = raw.match(/(\d+)\s*$/);
    const error = document.querySelector("#link-error");
    if (error) error.textContent = "";
    if (!match) {
      if (error) error.textContent = "Paste an invoice link or a number.";
      return;
    }
    location.hash = `#/pay/${match[1]}`;
  });
}

/* Docs */

function docsRow(method, path, note) {
  return `<div class="docs-row"><span class="docs-method">${method}</span><code>${path}</code><span class="docs-note">${note}</span></div>`;
}

export function docsPage() {
  const meta = session.meta;
  const contract = meta?.contract;
  const token = meta?.token;
  const contractHref = explorerAddress(contract);
  const tokenHref = explorerAddress(token);
  const address = (value, href) => value
    ? href
      ? `<a class="mono" href="${esc(href)}" rel="noopener">${esc(value)} ${icon("external", "ic-16")}</a>`
      : `<span class="mono">${esc(value)}</span>`
    : `<span class="muted">Start the API to load this address.</span>`;
  return publicShell(`
    <main class="container docs pub-main">
      <header class="docs-head">
        <p class="bracket">[ Documentation ]</p>
        <h1 class="h1">Build on Ciro</h1>
        <p class="lede">One contract, one HTTP API, a CLI, and an MCP server. The API reads the chain and returns unsigned transactions. It holds no key.</p>
        <div class="actions">
          <a class="btn btn-primary" href="#/start">Open the app ${arrow()}</a>
          <a class="btn" href="${esc(apiUrl())}/v1/meta" rel="noopener">API status ${icon("external", "ic-16")}</a>
        </div>
      </header>
      <div class="docs-grid">
        <aside class="docs-side card">
          <p class="docs-side-title">On this page</p>
          <nav aria-label="Documentation sections">
            <button type="button" data-doc="overview">Overview</button>
            <button type="button" data-doc="api">API</button>
            <button type="button" data-doc="cli">CLI</button>
            <button type="button" data-doc="mcp">MCP</button>
            <button type="button" data-doc="contract">Contract</button>
            <button type="button" data-doc="network">Network</button>
          </nav>
        </aside>
        <div class="docs-body">
          <section class="docs-section" id="doc-overview">
            <h2 class="h2">Overview</h2>
            <p>A payee registers a name and creates an invoice. The invoice fixes the amount, the reference, the due time, and the network. The payer opens the link, types the name, and signs. The contract pays only on an exact name.</p>
            <ol class="docs-steps">
              <li><span class="mono">01</span><p>Register a name with <code>register</code>.</p></li>
              <li><span class="mono">02</span><p>Create an invoice with <code>create</code>.</p></li>
              <li><span class="mono">03</span><p>Pay with <code>pay</code> and the exact name.</p></li>
            </ol>
          </section>
          <section class="docs-section" id="doc-api">
            <h2 class="h2">API</h2>
            <p>All reads are public. Writes return an unsigned transaction for a wallet to sign.</p>
            <div class="docs-table">
              ${docsRow("GET", "/v1/meta", "Chain, token, contract, fee")}
              ${docsRow("GET", "/v1/invoices/:id", "One invoice")}
              ${docsRow("POST", "/v1/invoices/:id/check", "Compare a name")}
              ${docsRow("GET", "/v1/receipts/:id", "One receipt")}
              ${docsRow("GET", "/v1/payees/:address", "Registered name")}
              ${docsRow("GET", "/v1/payees/:address/invoices", "Invoices by payee")}
              ${docsRow("GET", "/v1/payees/:address/allowances", "Allowances by payee")}
              ${docsRow("GET", "/v1/payers/:address/receipts", "Receipts by payer")}
              ${docsRow("POST", "/v1/check", "Compare a name by payee")}
              ${docsRow("POST", "/v1/tx/register", "Unsigned register")}
              ${docsRow("POST", "/v1/tx/invoice", "Unsigned create")}
              ${docsRow("POST", "/v1/tx/pay", "Unsigned pay")}
              ${docsRow("POST", "/v1/tx/pay-from-allowance", "Unsigned allowance pay")}
              ${docsRow("POST", "/v1/tx/allow", "Unsigned allowance")}
              ${docsRow("POST", "/v1/tx/revoke", "Unsigned revoke")}
              ${docsRow("POST", "/v1/tx/faucet", "Unsigned testnet mint")}
            </div>
            <pre>curl ${esc(apiUrl())}/v1/invoices/1</pre>
          </section>
          <section class="docs-section" id="doc-cli">
            <h2 class="h2">CLI</h2>
            <p>The CLI talks to the same API and prints the transaction for a wallet to sign.</p>
            <pre>ciro register "Ada Okonkwo"
ciro invoice --amount 100 --reference "March design" --due 2026-12-01
ciro pay 4 --name "Ada Okonkwo"
ciro receipt 4</pre>
          </section>
          <section class="docs-section" id="doc-mcp">
            <h2 class="h2">MCP</h2>
            <p>The MCP server exposes the same reads and prepares a payment. It does not sign.</p>
            <pre>CIRO_API_URL=${esc(apiUrl())} node packages/mcp/bin/ciro-mcp.js</pre>
          </section>
          <section class="docs-section" id="doc-contract">
            <h2 class="h2">Contract</h2>
            <dl class="facts">
              <div class="fact-row"><dt>Ciro</dt><dd>${address(contract, contractHref)}</dd></div>
              <div class="fact-row"><dt>Token</dt><dd>${address(token, tokenHref)}</dd></div>
              <div class="fact-row"><dt>Network</dt><dd>${esc(chainName(meta?.chainId))}</dd></div>
              <div class="fact-row"><dt>Fee</dt><dd>${meta ? `${meta.feeBps / 100}%` : "Not loaded"}</dd></div>
              <div class="fact-row"><dt>Symbol</dt><dd>${esc(meta?.symbol || "tUSD8")}</dd></div>
            </dl>
            <p class="fineprint">The contract is the record. The API reads its events and holds no key.</p>
          </section>
          <section class="docs-section" id="doc-network">
            <h2 class="h2">Network</h2>
            <dl class="facts">
              <div class="fact-row"><dt>Chain</dt><dd class="mono">${esc(meta?.chainId ?? "44005")}</dd></div>
              <div class="fact-row"><dt>RPC</dt><dd class="mono">${esc(rpcUrl() || "Not set")}</dd></div>
              <div class="fact-row"><dt>Currency</dt><dd>tQDAY</dd></div>
              <div class="fact-row"><dt>Explorer</dt><dd><a href="https://explorer-test.qday.info" rel="noopener">explorer-test.qday.info ${icon("external", "ic-16")}</a></dd></div>
            </dl>
            <div class="actions mt-16">
              <button class="btn" type="button" id="docs-add-network">${icon("globe", "ic-16")}Add Aevum to wallet</button>
              <button class="btn btn-primary" type="button" id="docs-faucet">${icon("droplet", "ic-16")}Get 1,000 tUSD8</button>
            </div>
            <p id="docs-status" class="fineprint" role="status"></p>
            <p class="fineprint">On Aevum, tUSD8 comes from the QDay faucet, which opens in a new tab. On a local test chain the app mints it. It is for testnet only.</p>
          </section>
        </div>
      </div>
    </main>
    ${footer()}
  `, true);
}

export function bindDocs() {
  for (const button of document.querySelectorAll("[data-doc]")) {
    button.addEventListener("click", () => {
      document.querySelector(`#doc-${button.dataset.doc}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  const status = document.querySelector("#docs-status");
  document.querySelector("#docs-add-network")?.addEventListener("click", async () => {
    if (status) status.textContent = "Asking the wallet to add Aevum.";
    try {
      await addNetwork();
      if (status) status.textContent = "Aevum is in the wallet.";
    } catch (err) {
      if (status) status.textContent = err.message || "The wallet refused the network.";
    }
  });
  document.querySelector("#docs-faucet")?.addEventListener("click", async (event) => {
    if (session.meta?.chainId !== 44005 && !session.account) {
      try {
        await connect();
      } catch (err) {
        if (status) status.textContent = err.message || "The wallet did not connect.";
        return;
      }
    }
    const ok = await requestTestToken(event.currentTarget, status);
    if (ok && status) status.textContent = "Minted 1,000 tUSD8 to this wallet.";
  });
}

/* Onboarding */

export async function startPage() {
  if (!provider()) {
    return frame(`
      <div class="page-head">
        <p class="bracket">[ Onboarding ]</p>
        <h2 class="h2">Connect a wallet</h2>
        <p class="lede">Install a wallet in this browser, then reload the page.</p>
      </div>
    `, "/start");
  }
  if (!session.account) {
    return frame(`
      <div class="page-head">
        <p class="bracket">[ Onboarding ]</p>
        <h2 class="h2">Connect a wallet</h2>
        <p class="lede">Ciro holds no key. Your wallet signs. A payer who only has a link can connect later, on the invoice.</p>
      </div>
      <div class="card form">
        <div class="form-foot">
          <button class="btn btn-primary" id="connect" type="button">Connect ${arrow()}</button>
          <p id="form-error" class="bad"></p>
        </div>
      </div>
    `, "/start");
  }
  if (session.meta && session.chainId !== session.meta.chainId) {
    return frame(`
      <div class="page-head">
        <p class="bracket">[ Network ]</p>
        <h2 class="h2">Switch network</h2>
        <p class="lede">This wallet is on ${esc(chainName(session.chainId))}. Ciro here is on ${esc(chainName(session.meta.chainId))}. If the wallet does not have that network, it is added before the switch.</p>
      </div>
      <div class="card form">
        <div class="form-foot">
          <button class="btn btn-primary" id="switch" type="button">Switch to ${esc(chainName(session.meta.chainId))}</button>
          <p id="form-error" class="bad"></p>
        </div>
      </div>
    `, "/start");
  }
  const gas = await readGas();
  if (gas.known && !gas.enough) {
    return frame(`
      <div class="page-head">
        <p class="bracket">[ Gas ]</p>
        <h2 class="h2">Get tQDAY</h2>
        <p class="lede">You need tQDAY to pay gas. Creating an invoice does not move tUSD8.</p>
      </div>
      <div class="card card-pad">${faucetBlock("tQDAY", "You need tQDAY to pay gas. Creating an invoice does not move tUSD8.")}</div>
    `, "/start");
  }
  if (!session.payee?.registered) return registerBlock();
  return null;
}

function registerBlock() {
  return frame(`
    <div class="page-head">
      <p class="bracket">[ Your name ]</p>
      <h2 class="h2">Register your name</h2>
      <p class="lede">This is the name a payer must type. It is shown folded before you sign. The name lives in the contract, so registering is one write and the wallet signs it. Gas is tQDAY on ${esc(chainName(session.meta?.chainId ?? 44005))}, not ETH on mainnet.</p>
    </div>
    <form id="register" class="card form">
      <div class="form-body">
        <div class="field">
          <label class="label" for="name">Name</label>
          <input id="name" name="name" autocomplete="name" placeholder="Ada Okonkwo" />
        </div>
        <p id="preview" class="label"></p>
      </div>
      <div class="form-foot">
        <button class="btn btn-primary" type="submit">Register ${arrow()}</button>
        <p id="form-error" class="bad"></p>
      </div>
    </form>
  `, "/start");
}

function formMessage(err) {
  if (err?.message === "bad_amount") return "Enter an amount like 100 or 100.50.";
  return err?.message || "The request failed.";
}

export function bindStart(go) {
  document.querySelector("#connect")?.addEventListener("click", async () => {
    const error = document.querySelector("#form-error");
    try {
      await connect();
      await go();
    } catch (err) {
      if (error) error.textContent = formMessage(err);
    }
  });
  document.querySelector("#switch")?.addEventListener("click", async () => {
    const error = document.querySelector("#form-error");
    try {
      await switchTo(session.meta.chainId);
      await go();
    } catch (err) {
      if (error) error.textContent = formMessage(err);
    }
  });
  const form = document.querySelector("#register");
  const input = document.querySelector("#name");
  input?.addEventListener("input", () => {
    const folded = foldedText(input.value);
    document.querySelector("#preview").textContent = folded
      ? `Stored as “${folded}”. Capitals and extra spaces still match.`
      : "This name is empty once punctuation and extra spaces are removed.";
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("#form-error");
    error.textContent = "";
    try {
      const tx = await api("POST", "/v1/tx/register", { name: input.value });
      document.querySelector("#preview").textContent = tx.summary;
      await broadcast([tx]);
      await loadPayee();
      location.hash = "#/dashboard";
    } catch (err) {
      error.textContent = formMessage(err);
    }
  });
}

/* Signed in */

export async function dashboard() {
  const invoices = await myInvoices();
  const open = invoices.filter((invoice) => invoice.status === "open");
  const paid = invoices.filter((invoice) => invoice.status === "paid").slice(0, 3);
  const latest = open[0];
  return frame(`
    <div class="card quick">
      ${latest
        ? `<button type="button" id="copy-latest" data-id="${esc(latest.id)}">
            ${icon("link")}
            <span><span class="quick-title">Copy latest link</span><span class="quick-sub">Share the open invoice</span></span>
          </button>`
        : `<a href="#/invoices">
            ${icon("invoices")}
            <span><span class="quick-title">Invoice list</span><span class="quick-sub">Every invoice you created</span></span>
          </a>`}
      <a href="#/history">
        ${icon("history")}
        <span><span class="quick-title">History</span><span class="quick-sub">Created, paid, closed</span></span>
      </a>
      <a href="#/wallet">
        ${icon("wallet")}
        <span><span class="quick-title">Wallet</span><span class="quick-sub">Balances and network</span></span>
      </a>
    </div>
    <h2 class="h2 section-title">Open invoices</h2>
    ${invoiceList(open, "No invoices yet.")}
    <h2 class="h2 section-title">Latest receipts</h2>
    ${invoiceList(paid, "No receipts yet.")}
  `, "/dashboard");
}

export function bindCopy() {
  document.querySelector("#copy-latest")?.addEventListener("click", (event) => {
    copyLink(event.currentTarget.dataset.id);
    event.currentTarget.querySelector(".quick-title").textContent = "Copied";
  });
}

export async function invoicesPage() {
  const invoices = await myInvoices();
  return frame(`
    <div class="page-head">
      <p class="bracket">[ Ledger ]</p>
      <p class="lede">Every invoice you created, open or closed. The payer opens one from a link.</p>
    </div>
    ${invoiceList(invoices, "No invoices yet.")}
  `, "/invoices");
}

export function newInvoice() {
  return frame(`
    <div class="page-head">
      <p class="bracket">[ New invoice ]</p>
      <p class="lede">Network: ${esc(chainName(session.meta?.chainId))}. ${(session.meta?.feeBps ?? 0) === 0 ? "Fee on this deployment is 0." : "The fee is taken when they pay, and they see it first."} A transfer that does not go through an invoice is not charged.</p>
    </div>
    <form id="create" class="card form">
      <div class="form-body">
        <div class="field"><label class="label" for="amount">Amount in tUSD8</label><input id="amount" inputmode="decimal" placeholder="100" /></div>
        <div class="field"><label class="label" for="reference">Reference</label><input id="reference" maxlength="256" placeholder="March design" /></div>
        <div class="field"><label class="label" for="due">Due</label><input id="due" type="date" /></div>
      </div>
      <div class="form-foot">
        <button class="btn btn-primary" type="submit">Create invoice ${arrow()}</button>
        <p id="form-error" class="bad"></p>
      </div>
    </form>
  `, "/invoices", "New invoice");
}

export function bindCreate() {
  document.querySelector("#create")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("#form-error");
    error.textContent = "";
    try {
      const tx = await api("POST", "/v1/tx/invoice", {
        amount: parseHuman(document.querySelector("#amount").value.trim()).toString(),
        reference: document.querySelector("#reference").value,
        due: document.querySelector("#due").value,
      });
      error.className = "muted";
      error.textContent = tx.summary;
      const receipts = await broadcast([tx]);
      const id = createdId(receipts[0]);
      await refreshInvoices();
      location.hash = id ? `#/invoices/${id}` : "#/invoices";
    } catch (err) {
      error.className = "bad";
      error.textContent = formMessage(err);
    }
  });
}

export async function invoiceDetail(id) {
  const invoice = await api("GET", `/v1/invoices/${id}`);
  const closed = invoice.status !== "open";
  return frame(`
    <div class="card deed">
      <div class="doc-head">
        <div class="doc-top">
          <p class="bracket">Invoice ${esc(invoice.id)}</p>
          <span class="status ${statusClass(invoice.status)}">${statusLabel(invoice.status)}</span>
        </div>
        <p class="amount">${esc(invoice.amountDisplay)}</p>
        <p class="symbol">${esc(invoice.symbol)}</p>
      </div>
      <div class="cut"></div>
      <div class="doc-facts">
        <dl class="facts">
          <div class="fact-row"><dt>Payee</dt><dd>${esc(invoice.payeeName)}</dd></div>
          <div class="fact-row"><dt>Reference</dt><dd>${esc(invoice.reference || "No reference")}</dd></div>
          <div class="fact-row"><dt>Due</dt><dd>${esc(when(invoice.due))}</dd></div>
          <div class="fact-row"><dt>Network</dt><dd>${esc(chainName(invoice.chainId))}</dd></div>
        </dl>
      </div>
      <div class="doc-body">
        <div class="actions">
          <button class="btn" type="button" id="copy-link" data-id="${esc(invoice.id)}">${icon("copy", "ic-16")}Copy link</button>
          ${closed ? "" : `<a class="btn btn-primary" href="#/pay/${esc(invoice.id)}">Open pay screen ${arrow()}</a>`}
        </div>
        ${invoice.status === "past_due" ? `<p class="fineprint warn">This invoice is unpaid and closed. The due time has passed.</p>` : ""}
      </div>
    </div>
  `, "/invoices", "Invoice");
}

/* Pay */

export async function payPage(id) {
  const invoice = await api("GET", `/v1/invoices/${id}`);
  if (invoice.status === "paid") return null;
  if (invoice.status === "past_due") {
    return docShell(`
      <main class="doc-wrap pub-main">
        <div class="card deed">
          <div class="doc-head">
            <div class="doc-top">
              <p class="bracket">Invoice ${esc(invoice.id)}</p>
              <span class="status status-closed">Unpaid and closed</span>
            </div>
            <p class="amount">${esc(invoice.amountDisplay)}</p>
            <p class="symbol">${esc(invoice.symbol)}</p>
          </div>
          <div class="cut"></div>
          <div class="doc-facts">
            <dl class="facts">
              <div class="fact-row"><dt>Payee</dt><dd>${esc(invoice.payeeName)}</dd></div>
              <div class="fact-row"><dt>Reference</dt><dd>${esc(invoice.reference || "No reference")}</dd></div>
              <div class="fact-row"><dt>Due</dt><dd>${esc(when(invoice.due))}</dd></div>
            </dl>
          </div>
          <div class="doc-body">
            <p class="warn-block">The due time was ${esc(when(invoice.due))}. This invoice cannot be paid.</p>
          </div>
        </div>
      </main>
    `);
  }
  return docShell(`
    <main class="doc-wrap pub-main">
      <div class="card deed">
        <div class="doc-head">
          <div class="doc-top">
            <p class="bracket">Invoice ${esc(invoice.id)}</p>
            <span class="status status-open">Open</span>
          </div>
          <p class="amount">${esc(invoice.amountDisplay)}</p>
          <p class="symbol">${esc(invoice.symbol)}</p>
        </div>
        <div class="cut"></div>
        <div class="doc-facts">
          <dl class="facts">
            <div class="fact-row"><dt>Pay</dt><dd>${esc(invoice.payeeName)}</dd></div>
            <div class="fact-row"><dt>Reference</dt><dd>${esc(invoice.reference || "No reference")}</dd></div>
            <div class="fact-row"><dt>Due</dt><dd>${esc(when(invoice.due))}</dd></div>
            <div class="fact-row"><dt>Network</dt><dd>${esc(chainName(invoice.chainId))}</dd></div>
            <div class="fact-row"><dt>Fee</dt><dd>${esc(feeLine(invoice.amount, session.meta?.feeBps ?? 0))}</dd></div>
          </dl>
        </div>
        <div class="doc-body">
          <form id="pay-form" data-invoice="${esc(id)}">
            <label class="label" for="claimed">Name you were told</label>
            <input id="claimed" autocomplete="off" placeholder="${esc(invoice.payeeName)}" />
            <p id="match"></p>
            <div id="action"></div>
          </form>
          <p class="fineprint">A wrong name does not start a payment. A finished payment cannot be pulled back.</p>
        </div>
      </div>
    </main>
  `);
}

export function bindPay(id) {
  const input = document.querySelector("#claimed");
  if (!input) return;
  let timer = 0;
  const run = () => refreshPay(id, input.value);
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
}

let payTicket = 0;

function payForm(id) {
  const form = document.querySelector("#pay-form");
  if (!form || form.dataset.invoice !== String(id)) return null;
  return form;
}

async function refreshPay(id, name) {
  const mine = ++payTicket;
  const match = document.querySelector("#match");
  const action = document.querySelector("#action");
  if (!payForm(id) || !match || !action) return;
  let result = null;
  if (name.trim()) {
    try {
      const body = await api("POST", `/v1/invoices/${id}/check`, { name });
      result = body.result;
    } catch (err) {
      if (mine !== payTicket || !payForm(id)) return;
      match.className = "bad";
      match.textContent = err.message;
      action.innerHTML = "";
      return;
    }
  }
  if (mine !== payTicket || !payForm(id)) return;
  const invoice = await api("GET", `/v1/invoices/${id}`);
  const funds = await fundsFor(invoice.amount);
  if (mine !== payTicket || !payForm(id)) return;
  const decision = payDecision({
    status: invoice.status,
    result,
    connected: Boolean(session.account),
    chainMatches: !session.meta || !session.account || session.chainId === session.meta.chainId,
    ...funds,
  });
  match.className = decision.action === "close" || decision.action === "none" ? "warn" : decision.action === "pay" ? "ok" : "muted";
  match.textContent = matchCopy(decision.action, invoice);
  action.innerHTML = actionHtml(decision.action, invoice);
  document.querySelector("#do-connect")?.addEventListener("click", async () => {
    try {
      await connect();
      await refreshPay(id, name);
    } catch (err) {
      action.innerHTML = `<p class="bad">${esc(err.message)}</p>`;
    }
  });
  document.querySelector("#do-switch")?.addEventListener("click", async () => {
    try {
      await switchTo(session.meta.chainId);
      await refreshPay(id, name);
    } catch (err) {
      action.innerHTML = `<p class="bad">${esc(err.message)}</p>`;
    }
  });
  document.querySelector("#do-pay")?.addEventListener("click", () => submitPay(id, name, invoice));
  document.querySelector("#do-faucet")?.addEventListener("click", async (event) => {
    const ok = await requestTestToken(event.currentTarget, action);
    if (ok) await refreshPay(id, name);
  });
}

function matchCopy(action, invoice) {
  if (action === "type") return "Type the name you were told. The amount stays locked.";
  if (action === "close") return "This is close to the name on the invoice. It will not pay. Edit the name.";
  if (action === "none") return "This is not the name on the invoice.";
  if (action === "pay" || action === "connect" || action === "switch" || action === "need-gas" || action === "need-token") {
    return "The name matches.";
  }
  if (action === "closed") return "This invoice is closed.";
  return "";
}

function actionHtml(action, invoice) {
  if (action === "connect") return `<div class="actions"><button class="btn btn-primary btn-block" id="do-connect" type="button">Connect wallet to pay ${arrow()}</button></div>`;
  if (action === "switch") return `<div class="actions"><button class="btn btn-primary btn-block" id="do-switch" type="button">Switch to ${esc(chainName(session.meta.chainId))}</button></div>`;
  if (action === "need-gas") return faucetBlock("tQDAY", "The wallet has no tQDAY for gas.");
  if (action === "need-token") {
    return `<div class="warn-block">
      <p>The wallet does not hold ${esc(invoice.amountDisplay)} ${esc(invoice.symbol)}.</p>
      <div class="actions mt-12">
        <button class="btn btn-primary" id="do-faucet" type="button">${icon("droplet", "ic-16")}Get 1,000 ${esc(invoice.symbol)}</button>
      </div>
      <p class="fineprint">Testnet only. The token contract mints to this wallet.</p>
    </div>`;
  }
  if (action === "pay") return `<div class="actions"><button class="btn btn-primary btn-block" id="do-pay" type="button">Pay ${esc(invoice.amountDisplay)} ${esc(invoice.symbol)}</button></div>`;
  return "";
}

async function submitPay(id, name, invoice) {
  const action = document.querySelector("#action");
  action.innerHTML = `<p class="fineprint">Preparing the payment.</p>`;
  try {
    const tx = await api("POST", "/v1/tx/pay", { id, name, payer: session.account });
    const lines = [...(tx.approvals ?? []), tx].map((step) => `<p class="fineprint">${esc(step.summary)}</p>`).join("");
    action.innerHTML = `${lines}<p class="fineprint">Confirm in the wallet.</p>`;
    await broadcast([...(tx.approvals ?? []), tx]);
    location.hash = `#/receipt/${invoice.id}`;
  } catch (err) {
    action.innerHTML = `<p class="bad">${esc(err.message)}</p>`;
  }
}

/* Receipt */

export async function receiptPage(id) {
  let receipt;
  try {
    receipt = await api("GET", `/v1/receipts/${id}`);
  } catch (err) {
    if (err.code === "not_paid") {
      return docShell(`
        <main class="doc-wrap pub-main">
          <div class="page-head">
            <p class="bracket">[ Receipt ]</p>
            <h2 class="h2">No receipt yet</h2>
            <p class="lede">Invoice ${esc(id)} is not paid.</p>
          </div>
          <p><a class="btn" href="#/pay/${esc(id)}">Back to the invoice ${arrow()}</a></p>
        </main>
      `);
    }
    throw err;
  }
  const href = explorerTx(receipt.transactionHash);
  return docShell(`
    <main class="doc-wrap pub-main">
      <div class="card deed">
        <div class="doc-head">
          <div class="doc-top">
            <p class="bracket">Receipt ${esc(receipt.id)}</p>
            <span class="status status-paid">Paid</span>
          </div>
          <p class="amount">${esc(receipt.amountDisplay)}</p>
          <p class="symbol">${esc(receipt.symbol)}</p>
        </div>
        <div class="cut"></div>
        <div class="doc-facts">
          <dl class="facts">
            <div class="fact-row"><dt>Payee</dt><dd>${esc(receipt.payeeName)}</dd></div>
            <div class="fact-row"><dt>Payer</dt><dd class="mono">${esc(receipt.payer)}</dd></div>
            <div class="fact-row"><dt>Reference</dt><dd>${esc(receipt.reference || "No reference")}</dd></div>
            <div class="fact-row"><dt>Fee</dt><dd>${esc(receipt.feeDisplay)}</dd></div>
            <div class="fact-row"><dt>Paid</dt><dd>${esc(when(receipt.paidAt))}</dd></div>
            <div class="fact-row"><dt>Network</dt><dd>${esc(chainName(receipt.chainId))}</dd></div>
            <div class="fact-row"><dt>Transaction</dt><dd class="mono">${href ? `<a href="${esc(href)}" rel="noopener">${esc(receipt.transactionHash)}</a>` : esc(receipt.transactionHash || "Not indexed")}</dd></div>
          </dl>
        </div>
      </div>
    </main>
  `);
}

/* History */

export async function historyPage() {
  const mine = session.account ? await myInvoices() : [];
  const receiptPromise = session.account
    ? api("GET", `/v1/payers/${session.account}/receipts`).catch(() => ({ receipts: [] }))
    : null;
  if (receiptPromise) {
    receiptPromise.then((body) => {
      const node = document.querySelector("#payer-receipts");
      if (node) node.innerHTML = receiptList(body.receipts);
    }).catch(() => {});
  }
  return frame(`
    <div class="page-head">
      <p class="bracket">[ History ]</p>
      <p class="lede">Created, paid, and closed invoices for this wallet, as payee or as payer.</p>
    </div>
    <h2 class="h2 section-title">Your invoices</h2>
    ${invoiceList(mine, "You have not created an invoice.")}
    <h2 class="h2 section-title">Invoices you paid</h2>
    <div id="payer-receipts">${receiptList([])}</div>
    <p class="fineprint">A name you refused never reached the chain, so it is not listed here.</p>
  `, "/history");
}

/* Wallet */

export async function walletPage() {
  const gas = await readGas();
  const token = await readToken();
  const faucet = faucetUrl();
  const low = [];
  if (gas.known && !gas.enough) low.push("tQDAY");
  if (token.known && token.raw === 0n) low.push(session.meta?.symbol || "tUSD8");
  return frame(`
    <div class="card deed">
      <div class="doc-head">
        <p class="bracket">Balance</p>
        <p class="amount">${esc(token.known ? formatUnits(token.raw) : "n/a")}</p>
        <p class="symbol">${esc(session.meta?.symbol || "tUSD8")}</p>
      </div>
      <div class="cut"></div>
      <div class="doc-facts">
        <dl class="facts">
          <div class="fact-row"><dt>Address</dt><dd class="mono">${esc(session.account)}</dd></div>
          <div class="fact-row"><dt>Network</dt><dd>${esc(chainName(session.chainId))}</dd></div>
          <div class="fact-row"><dt>Gas</dt><dd>${esc(gas.known ? gas.display : "n/a")} ${esc(session.meta?.chainId === 44005 ? "tQDAY" : "gas")}</dd></div>
        </dl>
      </div>
      <div class="doc-body">
        ${low.length ? `<p class="warn-block">Missing ${esc(low.join(" and "))}.${faucet ? ` <a href="${esc(faucet)}">Get it from the faucet.</a>` : ""}</p>` : ""}
        <p class="fineprint">These are the wallet's balances. Ciro does not keep a second balance.</p>
        <div class="actions mt-16">
          <button class="btn" type="button" id="copy-address">${icon("copy", "ic-16")}Copy address</button>
          <button class="btn" type="button" id="add-network">${icon("globe", "ic-16")}Add network</button>
          ${session.meta && session.chainId !== session.meta.chainId ? `<button class="btn btn-primary" type="button" id="switch">Switch to ${esc(chainName(session.meta.chainId))}</button>` : ""}
          <button class="btn" type="button" id="disconnect">Disconnect</button>
        </div>
        <p id="wallet-status" class="fineprint" role="status"></p>
        <p id="form-error" class="bad"></p>
      </div>
    </div>
  `, "/wallet");
}

export function bindWallet(go) {
  document.querySelector("#copy-address")?.addEventListener("click", (event) => {
    navigator.clipboard?.writeText(session.account);
    event.currentTarget.textContent = "Copied";
  });
  document.querySelector("#switch")?.addEventListener("click", async () => {
    const error = document.querySelector("#form-error");
    try {
      await switchTo(session.meta.chainId);
      await go();
    } catch (err) {
      if (error) error.textContent = formMessage(err);
    }
  });
  document.querySelector("#add-network")?.addEventListener("click", async () => {
    const status = document.querySelector("#wallet-status");
    try {
      await addNetwork();
      if (status) status.textContent = "The network is in the wallet.";
    } catch (err) {
      if (status) status.textContent = err.message || "The wallet refused the network.";
    }
  });
  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    await disconnect();
    location.hash = "#/";
  });
}

/* Profile */

export function profilePage() {
  const name = session.payee?.registered ? session.payee.name : "No name yet";
  return frame(`
    <div class="page-head">
      <p class="bracket">[ Registered name ]</p>
    </div>
    <p class="name">${esc(name)}</p>
    <p class="mono muted">${esc(session.account)}</p>
    <p class="note mt-20">Open invoices keep the name they had when you created them. Paying one still requires that name. Changing the name signs register again.</p>
    <form id="rename" class="card form mt-24">
      <div class="form-head"><p class="bracket">[ Change name ]</p></div>
      <div class="form-body">
        <div class="field"><label class="label" for="name">New name</label><input id="name" /></div>
        <p id="preview" class="label"></p>
      </div>
      <div class="form-foot">
        <button class="btn btn-primary" type="submit">Change name ${arrow()}</button>
        <p id="form-error" class="bad"></p>
      </div>
    </form>
  `, "/profile");
}

export function bindProfile(go) {
  const input = document.querySelector("#name");
  input?.addEventListener("input", () => {
    const folded = foldedText(input.value);
    document.querySelector("#preview").textContent = folded ? `Stored as “${folded}”.` : "This name is empty.";
  });
  document.querySelector("#rename")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("#form-error");
    try {
      const tx = await api("POST", "/v1/tx/register", { name: input.value });
      error.className = "muted";
      error.textContent = tx.summary;
      await broadcast([tx]);
      await loadPayee();
      await go();
    } catch (err) {
      error.className = "bad";
      error.textContent = formMessage(err);
    }
  });
}

/* Settings */

export async function settingsPage() {
  const body = await api("GET", `/v1/payees/${session.account}/allowances`);
  const rows = body.allowances.map((row) => `
    <div class="allow-row">
      <div class="allow-main">
        <p class="mono">${esc(row.spender)}</p>
        <p class="muted">${esc(formatUnits(BigInt(row.remaining)))} ${esc(session.meta?.symbol || "tUSD8")} left until ${esc(when(row.expiry))}${row.revoked ? ", revoked" : ""}</p>
      </div>
      ${row.revoked ? "" : `<button class="btn btn-sm revoke" type="button" data-spender="${esc(row.spender)}">Revoke</button>`}
    </div>`).join("");
  const priced = (session.meta?.feeBps ?? 0) === 0
    ? "This deployment charges 0. A later priced deployment charges 0.5%, shown before the payer confirms."
    : `This deployment charges ${session.meta.feeBps / 100}%. It is shown before the payer confirms.`;
  return frame(`
    <div class="page-head">
      <p class="bracket">[ Allowances ]</p>
      <p class="lede">A spender can pay your invoices up to a cap until the expiry. They cannot send the tokens somewhere else. You can revoke.</p>
    </div>
    <h2 class="h2 section-title">Allowances</h2>
    ${rows ? `<div class="card">${rows}</div>` : `<p class="empty">No allowances yet.</p>`}
    <form id="allow" class="card form mt-24">
      <div class="form-body">
        <div class="field"><label class="label" for="spender">Spender</label><input id="spender" placeholder="0x" /></div>
        <div class="field"><label class="label" for="cap">Cap in tUSD8</label><input id="cap" inputmode="decimal" /></div>
        <div class="field"><label class="label" for="expiry">Expiry</label><input id="expiry" type="date" /></div>
      </div>
      <div class="form-foot">
        <button class="btn btn-primary" type="submit">Allow ${arrow()}</button>
        <p id="form-error" class="bad"></p>
      </div>
    </form>
    <h2 class="h2 section-title">Fee</h2>
    <p class="note">${esc(priced)} A transfer that does not go through an invoice is not charged.</p>
  `, "/settings");
}

export function bindSettings(go) {
  document.querySelector("#allow")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.querySelector("#form-error");
    try {
      const tx = await api("POST", "/v1/tx/allow", {
        spender: document.querySelector("#spender").value.trim(),
        cap: parseHuman(document.querySelector("#cap").value.trim()).toString(),
        expiry: document.querySelector("#expiry").value,
      });
      error.className = "muted";
      error.textContent = tx.summary;
      await broadcast([tx]);
      await go();
    } catch (err) {
      error.className = "bad";
      error.textContent = formMessage(err);
    }
  });
  for (const button of document.querySelectorAll(".revoke")) {
    button.addEventListener("click", async () => {
      const error = document.querySelector("#form-error");
      try {
        const tx = await api("POST", "/v1/tx/revoke", { spender: button.dataset.spender });
        await broadcast([tx]);
        await go();
      } catch (err) {
        if (error) error.textContent = formMessage(err);
      }
    });
  }
}

/* Developers */

export function developersPage(apiBase, rpc) {
  const meta = session.meta;
  const contractHref = explorerAddress(meta?.contract);
  const tokenHref = explorerAddress(meta?.token);
  const link = (value, href) => value && href
    ? `<a class="mono" href="${esc(href)}" rel="noopener">${esc(value)} ${icon("external", "ic-16")}</a>`
    : `<span class="mono">${esc(value || "Not loaded")}</span>`;
  return frame(`
    <div class="page-head">
      <p class="bracket">[ Developers ]</p>
      <p class="lede">Reads of an invoice are public. There is no API key. Writes return an unsigned transaction. This page does not hold a key.</p>
    </div>
    <h2 class="h2 section-title">Deployment</h2>
    <div class="card card-pad">
      <dl class="facts">
        <div class="fact-row"><dt>Ciro</dt><dd>${link(meta?.contract, contractHref)}</dd></div>
        <div class="fact-row"><dt>Token</dt><dd>${link(meta?.token, tokenHref)}</dd></div>
        <div class="fact-row"><dt>Network</dt><dd>${esc(chainName(meta?.chainId))}</dd></div>
        <div class="fact-row"><dt>Fee</dt><dd>${meta ? `${meta.feeBps / 100}%` : "Not loaded"}</dd></div>
      </dl>
    </div>
    <div class="actions mt-16">
      <button class="btn" type="button" id="dev-add-network">${icon("globe", "ic-16")}Add network</button>
      <a class="btn" href="#/docs">Full docs ${arrow()}</a>
    </div>
    <p id="dev-status" class="fineprint" role="status"></p>
    <p class="lede mt-24">The API, CLI, and MCP are built and wired in v1. The SDK comes after the routes freeze.</p>
    <h2 class="h2 section-title">API</h2>
    <p class="muted">The live base URL for this deployment. Reads are public; writes return an unsigned transaction.</p>
    <pre>${esc(apiBase)}</pre>
    <h2 class="h2 section-title">CLI</h2>
    <p class="muted">The <code>ciro</code> binary signs locally with a key file you own. It never sends the key to the server.</p>
    <pre>ciro register "Ada Okonkwo"
ciro invoice --amount 100 --reference "March design" --due 2026-12-01
ciro pay 4 --name "Ada Okonkwo"
ciro receipt 4</pre>
    <h2 class="h2 section-title">MCP</h2>
    <p class="muted">An agent runs this server to prepare a payment without holding the treasury. It does not sign.</p>
    <pre>CIRO_API_URL=${esc(apiBase)} node packages/mcp/bin/ciro-mcp.js</pre>
    <h2 class="h2 section-title">SDK</h2>
    <div class="card card-pad coming-soon">
      <p class="bracket">[ Coming soon ]</p>
      <p class="lede">A typed client of this API. It ships after the routes freeze, so it does not chase a moving target. It holds no wallet; the caller signs.</p>
    </div>
    <form id="endpoints" class="card form mt-24">
      <div class="form-body">
        <div class="field"><label class="label" for="api-url">API URL</label><input id="api-url" value="${esc(apiBase)}" /></div>
        <div class="field"><label class="label" for="rpc-url">Chain RPC</label><input id="rpc-url" value="${esc(rpc)}" /></div>
      </div>
      <div class="form-foot"><button class="btn btn-primary" type="submit">Save ${arrow()}</button></div>
    </form>
  `, "/developers");
}

export function bindDevelopers(go) {
  document.querySelector("#dev-add-network")?.addEventListener("click", async () => {
    const status = document.querySelector("#dev-status");
    try {
      await addNetwork();
      if (status) status.textContent = "The network is in the wallet.";
    } catch (err) {
      if (status) status.textContent = err.message || "The wallet refused the network.";
    }
  });
  document.querySelector("#endpoints")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setEndpoints(document.querySelector("#api-url").value.trim(), document.querySelector("#rpc-url").value.trim());
    session.meta = null;
    await go();
  });
}

/* Shared bits */

function statusClass(status) {
  if (status === "paid") return "status-paid";
  if (status === "open") return "status-open";
  return "status-closed";
}

function invoiceList(invoices, empty) {
  if (!invoices.length) return `<p class="empty">${esc(empty)}</p>`;
  return `<ul class="card rows">${invoices.map((invoice) => `
    <li><a class="row" href="#/${invoice.status === "paid" ? "receipt" : "invoices"}/${esc(invoice.id)}">
      <span class="row-main">
        <span class="row-title">${esc(invoice.amountDisplay)} ${esc(invoice.symbol)}</span>
        <span class="row-sub">${esc(invoice.reference || "No reference")}</span>
      </span>
      <span class="row-meta"><span class="status ${statusClass(invoice.status)}">${statusLabel(invoice.status)}</span></span>
    </a></li>`).join("")}</ul>`;
}

function receiptList(receipts) {
  if (!receipts?.length) return `<p class="empty">You have not paid an invoice from this wallet.</p>`;
  return `<ul class="card rows">${receipts.map((receipt) => `
    <li><a class="row" href="#/receipt/${esc(receipt.id)}">
      <span class="row-main">
        <span class="row-title">${esc(receipt.amountDisplay)} ${esc(receipt.symbol)}</span>
        <span class="row-sub">to ${esc(receipt.payeeName)}</span>
      </span>
      <span class="row-meta"><span class="status status-paid">Paid</span></span>
    </a></li>`).join("")}</ul>`;
}

function statusLabel(status) {
  if (status === "past_due") return "Unpaid and closed";
  if (status === "paid") return "Paid";
  return "Open";
}

function faucetBlock(token, sentence) {
  const href = faucetUrl();
  return `<p class="warn">${sentence}</p>${href ? `<p class="fineprint"><a href="${esc(href)}">Faucet for ${esc(token)}.</a></p>` : `<p class="fineprint">This network has no public faucet in the app.</p>`}`;
}

function copyLink(id) {
  const url = `${location.origin}${location.pathname}#/pay/${id}`;
  navigator.clipboard?.writeText(url);
}

let invoicesCache = null;
let invoicesAccount = null;
let invoicesAt = 0;

async function refreshInvoices() {
  const account = session.account;
  const body = await api("GET", `/v1/payees/${account}/invoices`);
  invoicesCache = body.invoices;
  invoicesAccount = account;
  invoicesAt = Date.now();
  return invoicesCache;
}

async function myInvoices() {
  if (!session.account) return [];
  if (invoicesAccount === session.account && invoicesCache && Date.now() - invoicesAt < 10_000) return invoicesCache;
  return refreshInvoices();
}

export async function loadPayee() {
  if (!session.account) {
    session.payee = null;
    return;
  }
  session.payee = await api("GET", `/v1/payees/${session.account}`);
}

async function readGas() {
  if (!session.account || !rpcReady()) return { known: false, enough: false, display: "" };
  try {
    const raw = await nativeBalance(session.account);
    const whole = raw / 10n ** 18n;
    const frac = (raw % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
    return { known: true, enough: raw > 0n, display: `${whole}.${frac}`, raw };
  } catch {
    return { known: false, enough: false, display: "" };
  }
}

async function readToken() {
  if (!session.account || !session.meta?.token || !rpcReady()) return { known: false, raw: 0n };
  try {
    const raw = await tokenBalance(session.meta.token, session.account);
    return { known: true, raw };
  } catch {
    return { known: false, raw: 0n };
  }
}

async function fundsFor(amount) {
  const gas = await readGas();
  const token = await readToken();
  return {
    gasKnown: gas.known,
    gasEnough: gas.enough,
    tokenKnown: token.known,
    tokenEnough: token.known && token.raw >= BigInt(amount),
  };
}

function rpcReady() {
  return Boolean(localStorage.getItem("ciro.rpcUrl") || import.meta.env.VITE_RPC_URL || session.meta?.chainId === 44005);
}
