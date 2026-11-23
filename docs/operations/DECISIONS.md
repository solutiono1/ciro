# Decisions

Locked unless a later entry strikes one. Dates are UTC.

## 2026-11-21 — Name is Ciro

Due is a dictionary word and a crowded brand. Quittance is a live product (Fluidlabs OÜ) that reads invoices and does not pay them. Counterfoil is already a hackathon project for agent refunds. Allonge is the right legal object, a slip attached to a note, but AllScale already sends stablecoin invoices and the names collide in search.

The long form is chirograph: a deed written once and cut in two. Each party keeps a half. The halves match, or the deed is not genuine. That is the product. The public name is **Ciro**, the short form. **Chiro** was the other short form. It loses search and speech to chiropractic, so it is not the brand.

Repo folder, contract, CLI, and MCP prefix: `ciro`. If a handle or domain is taken, record the collision here. Do not fall back to Due.

## 2026-11-21 — What we will not build in v1, and why

These are not insults to the products. They are the wrong first company, and the wrong first demo.

### Talise's card and 36-country cash-out

Talise can cash out to banks and mobile money in 36 countries, and it can top up a card, because licensed partners issue the card and pay the banks. Talise says so: it is not a bank, and the card balance sits with the card provider.

Doing that ourselves means a money-transmitter license, a card BIN sponsor, KYC, and payout partners in each country. A screen that pretends the cash-out exists is a false product. A hackathon demo of it would be a mock.

Year two means a partner who already has the license. Ciro hands them a paid invoice and a receipt. They hand the person local currency. We do not become the bank to ship the invoice.

### Comparta's yield buckets and payroll suite

Comparta is a financial operating system: usernames, invoices, payment links, payroll schedules, and automatic splits into Operating, Tax, Payroll, and Savings, on one custodial Circle wallet on Arc with a ledger beside it.

That suite is a year of product. The pain we are solving is narrower: a stablecoin payment does not know which invoice it is, and it does not check the name before it is final. A tax bucket does not fix a payment sent to the wrong name. Cloning the suite would be a thin copy of Comparta, and the contest scores one flow.

What we do take from them is in the PRD: an invoice that marks itself paid only when the settlement matches. Splits, payroll batches, and yield are a later module on top of a receipt that already reconciles.

### Maren's Bitcoin loan

Maren Finance lets a person borrow Mezo's dollar against bitcoin and pay an @handle without selling the coin. It runs on Mezo testnet. It is pre-audit. The honest risk is liquidation of collateral, including a pooled trove.

That is a different chain, a different asset, and a different job. Aevum Builder Challenge #1 counts settlement on Aevum in tUSD8. A bitcoin vault does not satisfy that, and building a lender inside a payments contest adds liquidation risk we would have to explain to judges and to users.

Year two, a credit line can fund a Ciro invoice so someone can pay a bill without selling what they hold. Maren, or any lender, would be that partner. We do not lend bitcoin to prove an invoice.

### What "year-two partners" means

We integrate a licensed ramp, a card issuer, a payroll tool, or a lender. We do not rebuild their regulated core or their chain-specific core to enter a contest.

## 2026-11-21 — The first customer is the person who gets paid

A freelancer, contractor, or small supplier who is paid in stablecoins and then has to prove it. The payer is the other side of the same invoice. We write the story from the payee's desk. A business checking a supplier name before it releases money uses the same object. We do not build a second product for that desk.

## 2026-11-21 — One chain for the contest, more than one for the company

Contest settlement is tUSD8 on Aevum (chain 44005). The invoice object does not hard-code Aevum as the only network it will ever speak. A network id is a field on the invoice. v1 deploys one network. A second network is after the demo, where a real ramp exists. An Aevum-only app does not become the company.

## 2026-11-21 — No custody, no paymaster, no shielded pool in v1

The contract pulls tUSD8 with the payer's approval. Ciro never holds a withdrawal key. Gas is tQDAY, paid by the signer. QDay's marketing says a paymaster and session keys are live. The starter kit says there is no supported bundler or paymaster, and the named paymaster on the sandbox facilitator had no balance when it was checked on 2026-11-21. We do not depend on it.

Privacy in v1 is "do not publish more than the receipt." A selective proof, in the sense Gloam ships, is a later add. We will not stand up a Groth16 pool for this deadline.

Account abstraction and ERC-8004 are not required by the kit. ERC-8004 was not found at the usual registry addresses on Aevum. The payee record is our own.

## 2026-11-21 — Fee

A raw transfer a person does in their own wallet stays outside Ciro and is free. A settled invoice can carry a fee of 50 basis points (0.5%), taken in the same transfer, shown before the payer confirms. That is the same band Gloam charges to leave a vault, and it is the number we defend against a wire or a 3–5% collection app.

On Aevum testnet the fee is set to zero so a judge can pay without funding a fee on top of a faucet drip. The parameter exists in the contract from day one. Turning it on is a deployment choice, not a rewrite.

## 2026-11-21 — What ships in the contest build

In the build, in this order:

1. The contract and the web app. The app is the thing a person understands. UX and the demo are 25 of 100 judging points together.
2. The HTTP API, because the app, the CLI, and every later client call it. The API does not get a second product cycle.
3. The CLI, so a judge can reproduce the flow and so the first integration is a script.

MCP and the SDK wait until that path is solid. If the invoice, the app, the API, and the CLI are done before 11 December 2026, MCP is the next slice inside the window. The SDK waits until the API stops changing. See INTEGRATIONS and ROADMAP.

## 2026-11-21 — License and originality

MIT or Apache-2.0. We write the product inside the 16 November–11 December 2026 window. DoraHacks says the code is written in that window. qday.io allows licensed boilerplate, and the starter kit says DoraHacks wins. Ordinary libraries are fine. We do not rename their Checkout example.

## 2026-11-21 — The registered name is public

The architecture draft said a stranger could not read the display name. The PRD says the payer sees the registered name on the invoice. The PRD wins. `displayName(address)` is a public view. Close and none still refuse payment. They do not pretend the chain can hide a string that was stored to be shown.

## 2026-11-21 — Build the backend, then the web app

An earlier entry in this file put the web app beside the contract, then the API, then the CLI, and left MCP until that path was solid. The owner later asked for the backend first: smart contract, HTTP API, CLI, and MCP. The web app comes after that, designed from UX.md and wired to this API and the contract.

That changes the build sequence only. It does not add cards, cash-out, yield, payroll, or a loan. It does not deploy to Aevum. MCP shipped in the backend milestone because the owner named it there. The SDK still waits until the routes stop changing.

## 2026-11-21 — UI reference

Maren Finance (marenfinance.xyz) is the visual and writing reference: one job per screen, a large amount, the handle resolved before the button, status stated in short lines, risk written in plain sentences. We do not copy their layout file, copy, or assets. Where we depart is specified in UX.md. The payee match is the screen Maren does not have.

## 2026-11-22 — The wallet switches chain before it signs

A wallet on the wrong chain was offered mainnet gas for an Aevum testnet write. Now `broadcast` in `web/src/wallet.js` asks `wallet_switchEthereumChain` first, adds the chain on code 4902 and tries the switch again (adding does not always switch), and puts the chain id in the `eth_sendTransaction` params. `switchTo` returns the chain id it set. The API transactions already carry `chainId` (`txBody` takes the address argument). Decided: the app, not the contract, owns the chain check; the wallet owns the key.

## 2026-11-22 — Faucet and add network in the app

The faucet calls the public `mint` on the test token through the API (`POST /v1/tx/faucet`), testnet only, no API key. The pay-need-token state, the wallet page, and the docs page offer "Get test tUSD8" and mint 1,000 tUSD8. Add network uses `wallet_addEthereumChain` with the chain parameters from `session.meta` (RPC from `rpcUrl()`, explorer `https://explorer-test.qday.info`). Both are available on the wallet, pay, and docs pages.

## 2026-11-22 — Faucet hardening and the scope of add-network

The faucet is a testnet convenience, not a minting authority. It returns an unsigned `mint` the user's own wallet signs, so it can only fund an address the signer controls. It is disabled on a priced deployment (`feeBps !== 0` returns `not_found`, so it can never mint value that matters) and is rate-limited per address (60s, in-memory; there is no database by design). The real gate is the token itself: `MockUSD8.mint` is open, Aevum tUSD8 minting belongs to the official faucet.

Add-network is scoped to Aevum (44005). `networkParams()` refuses any other chain with a clear message, because a real wallet cannot join an `http://127.0.0.1` local RPC. The faucet button moved to the sidebar and the mobile sheet.

## 2026-11-23 — The landing keeps the brand and drops the gradient

The landing had a violet-to-teal radial wallpaper, a noise overlay, a large colored shadow, three Fluent 3D emoji PNGs, an auto-rotating five-photo carousel, and uppercase tracked bracket labels. Those were additions on top of the Maren direction, not part of it, and they are the standard AI-page look. Decided: keep the white canvas, near-black ink, violet accent, square corners, hairline borders, and the mono `[ bracket ]` label in sentence case. Put the one rich moment in the live name-check card in the hero, which UX.md already specified and the build had not shipped. The app preview is the drawn dashboard because the recorded webm showed the landing page itself. Deed corner ticks mark only invoice, pay, and receipt cards. Line icons replace the 3D PNGs.

This changes presentation only. It adds no product surface and no new route.
