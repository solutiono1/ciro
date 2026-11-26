# DoraHacks submission copy

Use this page as the project description and the judge handout for the Aevum
Builder Challenge. It mirrors the live product, the README, and the audit.

## One line

**Ciro is a stablecoin invoice that will not pay the wrong name.** The amount is
locked by the invoice; the payer's only decision is the name they were told; the
contract settles only on an exact name match.

## Track

- **Invoice Payments**
- **Confirmation of Payee**

Ciro also exposes the same flow to agents through MCP, without giving an agent a
key that can move funds.

## Live links

| What | Link |
|---|---|
| App | <https://ciro-a9s.pages.dev> |
| API | <https://ciro-a9s.pages.dev/api/v1/meta> |
| Contract | [`0x4AceB37ecAce160B4363111460020c2d088C529C`](https://explorer-test.qday.info/address/0x4AceB37ecAce160B4363111460020c2d088C529C?tab=contract) |
| Demo video | <https://ciro-a9s.pages.dev/media/ciro-demo-final.mp4> |
| Feature supplement (23s) | <https://ciro-a9s.pages.dev/media/ciro-v1-supplement.mp4> |
| Open demo | <https://ciro-a9s.pages.dev/#/demo> |
| MCP agent example | [examples/mcp-agent.mjs](../../examples/mcp-agent.mjs) |
| Source | <https://github.com/solutiono1/ciro> |
| Audit | [docs/security/REVIEW.md](../security/REVIEW.md) |
| Architecture | [docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) |
| v2 plan | [docs/product/V2_PLAN.md](../product/V2_PLAN.md) |

Deployed on **QDay Aevum testnet, chain 44005**, settling in **tUSD8**
(`0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals). Fee is **0** on this
deployment. The source is verified on the Aevum explorer.

## The problem

A stablecoin transfer carries a sender, a receiver, and an amount. It does not
carry the invoice, it does not check the name the payer was given, and it leaves
no receipt an accountant can file. When the amount is short, the name is wrong,
the network is wrong, or the payment is late, a person repairs it by hand. The
wrong network often cannot be repaired. The transfer is final.

Freelancers, contractors, and small suppliers already pay 3–5% to collect an
invoice, or $25–$80 and one to three days for a contractor wire. The chain fee is
the cheap part. The missing record and the wrong-name risk are the product.

## The solution

1. The payee registers a name against their address. Capitals and extra spaces
   still match, because the contract folds the name before hashing it. The app
   keeps one current owner per folded name: a claimed name is refused with
   available suggestions. The v1 contract stores a name per address but cannot
   enforce global uniqueness; v2 moves the rule on chain.
2. The payee creates an invoice with an amount, reference, due time, and network.
   The name, amount, due time, and network are locked on the invoice. Only a
   registered payee can create one, so every payment goes to a name registered
   on Ciro.
3. The payer opens the link and types the name they were told. The screen shows
   the registered name, the amount, the network, the fee, and the due time.
4. The contract compares the typed name to the **invoice's name snapshot**.
   Exact settles. Close and unknown show no pay button and the contract refuses
   them.
5. Both sides read a receipt: invoice id, amount, payer, payee name, network,
   transaction hash, and time. The receipt is read from the chain, not from a
   database.

## What is live

- **Contract:** name registry, invoices with a name snapshot, exact-amount
  payment, capped and revocable allowances, zero fee. 20 Foundry tests pass,
  including reentrancy, close name, late payment, double payment, and allowance
  accounting.
- **Web app:** landing, onboarding, register with live name availability and
  suggestions, create invoice, public pay link, close-name refusal, exact-name
  pay, receipt, wallet, history, profile, settings, developers/docs.
- **Control Room:** public stats at `/#/stats` (paid volume, invoice conversion,
  registered names, new users, repeat payees, fee, faucet, API latency, live
  chain health), a public name directory at `/#/names`, and a signed-in
  operations console at `/#/ops` with diagnostics, safe fixes, and a support
  bundle.
- **HTTP API:** reads and unsigned transactions, plus `/v1/names`,
  `/v1/names/check`, `/v1/stats`, and `/v1/diagnostics`. The invoice API holds
  no key and no invoice database. A separate `/v1/faucet` endpoint sends fixed
  testnet tUSD8/tQDAY from a dedicated treasury.
- **CLI:** `@getciro/cli@0.1.2`, signs locally with a key file the operator owns.
- **MCP:** `@getciro/mcp@0.1.0`, four tools (`ciro_check`,
  `ciro_prepare_invoice`, `ciro_prepare_pay`, `ciro_receipt`). It prepares; it
  never signs.
- **SDK:** `@getciro/sdk@0.1.0`, a typed client. It holds no wallet.

## Core workflows

### Payee

`connect wallet → register name → create invoice → copy link → see open invoice
→ watch receipt arrive`

### Payer

`open link → see locked amount and registered name → type the name → exact match
shows Pay → wallet approves the exact amount → contract settles → receipt`

### Agent

`MCP client calls ciro_prepare_invoice or ciro_prepare_pay → the API returns an
unsigned transaction → a human wallet signs, or an allowance holder signs inside
the cap and expiry → the chain settles`

MCP and the SDK never receive a private key. The allowance is a budget, not a
wallet: it can only pay that payee's invoices, it has a cap and an expiry, and
the owner can revoke it.

## Edge cases the demo shows

- **Close name:** initials and word count match, length differs by at most two.
  No pay button; the contract refuses it.
- **Unknown name:** no pay button; the contract refuses it.
- **Short amount:** the invoice amount is fixed; the contract pulls the exact
  amount, not what the payer types.
- **Late invoice:** the contract refuses after the due time.
- **Double payment:** the paid flag refuses a second settlement.
- **Wrong network:** the client pins chain 44005, the contract, and the token
  before the wallet signs.
- **Revoked or expired allowance:** the allowance path refuses; the owner's own
  wallet can still pay.

## Architecture

```text
Payee wallet ─┐
Payer wallet ─┼─> Web / CLI / MCP / SDK ─> HTTP API (reads + unsigned tx)
Agent key ────┘                                  │
                                                 ├─> index / event scan
                                                 └─> Ciro contract ─> tUSD8
Wallet / CLI ───────────────────────────────────────> sign and send
```

The invoice API and MCP hold no key. Money never sits in Ciro. Only the wallet or
the CLI signs. The web app reads the invoice and the name check from the chain
before it shows a pay button, so a compromised API cannot move a signature to
another contract, token, chain, invoice, name, or amount. The testnet faucet is
a separate endpoint with a dedicated testnet-only key; it cannot sign invoices
or touch user funds.

## Aevum integration

- Chain 44005, `https://rpc-test.qday.info`.
- tUSD8 `0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals.
- Source verified on `explorer-test.qday.info`.
- Faucet: `https://faucet.qday.info/en` (tQDAY and tUSD8).
- Test transactions are linked in the README proof table.

**ERC-8004:** the canonical registry was not deployed on Aevum at build time.
Ciro implements the same confirmation-of-payee primitive natively: a name hash,
initials, word count, length, an invoice-level snapshot, and an exact-match
rule. A v2 adapter reads the canonical registry when it is published, without
weakening the exact-name check.

**ERC-4337 / paymaster:** QDay's ERC-4337 paymaster docs and addresses were not
published at build time. Ciro uses plain EOAs and a capped, expiring allowance
for delegated payments. A smart-account path is on the v2 roadmap, not a
dependency of the core flow.

## Safety, trust, and controls

- **Non-custodial:** the invoice API, MCP, and SDK hold no key; the contract holds
  no user balance. The testnet faucet is a separate convenience with a dedicated
  testnet-only treasury key and fixed amounts.
- **Pinned signing:** the web client decodes every returned transaction against
  the pinned contract, token, chain, invoice, name, and amount before the wallet
  signs.
- **Exact amount and exact name:** no partial settlement, no close-name
  settlement.
- **Least privilege:** allowances have a spender, a cap, an expiry, and an
  instant revoke.
- **Auditable:** every payment is an event and a transaction hash; the receipt is
  read from the chain.
- **Audited:** the first review is in [REVIEW.md](../security/REVIEW.md). No
  Critical or High finding in the contract. Client-trust findings were fixed.
- **Transparent limits:** ASCII-only folding, one current owner per folded name
  in the app (the v1 contract cannot enforce it on chain), no cancel in v1,
  immutable contract, testnet only. These are in the README, not hidden.

## Testnet faucet

The app has a small Ciro faucet, separate from the invoice API. It sends **0.2 tUSD8 + 0.01 tQDAY** from a dedicated treasury (`0x09257929772176E9c832fC8056A0d9913Ef77a13`), with a 24-hour per-address claim history and a 2-minute global throttle. The user stays on Ciro; there is no redirect and no mainnet-balance check. If the treasury is empty, the app points to the [QDay Discord faucet](https://discord.gg/bYPhjmrSfK) first, then shows the treasury address for voluntary testnet contributions. The official QDay faucet is the fallback.

The faucet key is a Cloudflare secret (`CIRO_FAUCET_KEY`). It can only send fixed testnet amounts to an address. It cannot sign invoices, move user funds, or run on mainnet. The key is not in the repository or its history.

## Real-world utility and path to mainnet

The first user is a freelancer, contractor, or small supplier who is paid in
stablecoins and has to prove the payment. The payer is the client who opens the
link. A marketplace, payroll tool, or agent runtime is a later API caller, not a
separate screen.

Revenue is a settlement fee on paid invoices. The testnet deployment is zero
fee; a mainnet deployment can set a fee at deploy, capped at 1%, with 0.2–0.5%
as the planned range. Reads, the SDK, the CLI, and MCP stay free. A team plan can
charge for API keys, webhooks, exports, and support.

Distribution starts with QDay builders, small agencies that already invoice in
stablecoins, and accountant/bookkeeper referrals. QDay mainnet is scheduled for
Q1 2027; the v2 plan covers migration, the fee, stablecoin support, and the
design-partner program.

The fuller founder memo, including the non-custodial payment path, unit
economics, risks, and honest mainnet-readiness gaps, is in
[docs/product/BUSINESS.md](../product/BUSINESS.md).

## Tech stack

- Solidity 0.8.x, Foundry, OpenZeppelin-style patterns.
- viem for chain reads, wallet clients, and transaction decoding.
- Vanilla ES modules and Vite for the web app; no framework lock-in.
- Cloudflare Pages Functions for the API; the invoice API has no database and no key. The testnet faucet uses a Cloudflare secret with a dedicated testnet-only key.
- Node.js for the CLI and MCP; npm packages for the SDK, CLI, and MCP.
- Playwright for the end-to-end flow; Foundry for contract tests.

## How the API works

The API is a **Cloudflare Pages Function** at `/api/*` over the same core the
Node server uses. Reads call the Aevum RPC and return JSON; writes return an
unsigned transaction for the wallet or CLI to sign. There is **no invoice
database** because the chain is the record: the invoice, the name snapshot, the
paid flag, and the `Paid` event are all on chain. There is **no API key** because
the API never signs and never holds funds. The only keyed endpoint is
`/v1/faucet`, which uses a Cloudflare secret for a dedicated testnet treasury and
can only send fixed testnet amounts. Stats and the name directory read contract
events; request telemetry is an optional Cloudflare KV binding, not an invoice
store.

## Try it in 60 seconds

You do not need an account, an API key, or real money.

1. Open the live demo: <https://ciro-a9s.pages.dev/#/demo>. It resolves to the
   newest open **0.2 tUSD8** demo invoice for **Elena Rossi**.
2. Connect a wallet on Aevum testnet (chain 44005). If the wallet is empty,
   press **Get test funds**. Ciro sends **0.2 tUSD8 + 0.01 tQDAY** from its own
   testnet treasury without leaving the site. If the treasury is empty, the page
   links to the QDay Discord faucet first.
3. Type **Elena Rossa**. The page says the name is close, shows no pay button,
   and nothing moves.
4. Type **Elena Rossi**. The Pay button appears with the locked 0.2 tUSD8 and
   fee 0.
5. Sign. The receipt shows the payer, payee, amount, transaction hash, and
   `Verified on chain`.
6. Read the same invoice at `/api/v1/invoices/<id>` and the receipt at
   `/api/v1/receipts/<id>`; there is no key.
7. Open <https://ciro-a9s.pages.dev/#/stats> and
   <https://ciro-a9s.pages.dev/#/names> to see the payment and the name in the
   public Control Room.

To create your own invoice, connect a wallet, register a name (a claimed name
shows available suggestions), create an invoice, and open its link in a second
wallet.

## Reproduce it

The README has the full quickstart, environment variables, and test commands.
The short version:

```bash
git clone https://github.com/solutiono1/ciro
cd ciro
npm install
npm test
cd contracts && forge test
```

## Demo video

<https://ciro-a9s.pages.dev/media/ciro-demo-final.mp4> — 1:51.6, no login,
narrated. It shows the landing page, registration, invoice creation, the
close-name refusal, the exact-name payment, the verified receipt with a real
transaction hash, and the API/CLI/MCP/SDK documentation.

A 23-second supplement shows the post-demo v1 additions: the in-app faucet,
Docs copy buttons, receipt CSV/print, and the disconnect that survives a reload —
<https://ciro-a9s.pages.dev/media/ciro-v1-supplement.mp4>.

## Team

Solo builder: **Solution Kanu**. All work was developed during the build window
(first commit 23 November 2026).

## Submission checklist

- [x] Public GitHub repository, opens logged out.
- [x] No private keys, `.env` files, or API keys in the repo or history.
- [x] README lets a stranger run the project.
- [x] Contract and app deployed on the official Aevum testnet, test tokens only.
- [x] Demo video link works without login.
- [ ] DoraHacks project submitted and team listed (owner action).
- [ ] Top-5 live demo rehearsal (owner action if selected).

Key-material note: the repository has no real keys, `.env` files, or API keys. The only key-like strings are Anvil's published development mnemonic and its derived accounts in `packages/api/support/fixture.js`; they are public, unfunded, local-test-only, and never used on Aevum. The deployer and demo payee keys are outside the repo and gitignored.

## Judge test script

1. Open <https://ciro-a9s.pages.dev> and connect a wallet on Aevum.
2. Register a name. The contract writes it; the app shows the folded name. A
   claimed name shows **Name unavailable** plus available suggestions.
3. Create an invoice for **0.2 tUSD8** with a reference and a due date.
4. Copy the pay link. Open it in another wallet or a private window.
5. Type a close name. There is no pay button; the contract would refuse.
6. Type the exact name. The Pay button appears with the locked amount and fee.
7. Sign. The receipt shows the payer, payee name, amount, transaction hash, and
   `Verified on chain`.
8. Open the API at `/api/v1/receipts/:id` and the transaction on the explorer.

## Known limits

- Aevum testnet only; no mainnet yet.
- tUSD8 only in v1; no USDC/USDT.
- ASCII-only name folding. The app keeps one current owner per folded name and
  refuses a duplicate registration with suggestions. The v1 contract stores a
  name per address but cannot enforce global uniqueness, so a direct contract
  call can still duplicate one; v2 moves the rule on chain. The pay page and
  receipt always show the payee address.
- No cancel or void in v1; a mistyped invoice stays payable until due. v2 adds
  payee-only cancel/void.
- The v1 contract is immutable; a logic or fee change needs a new deployment.
- No fiat on-ramp, card, or bank payout.
- No canonical ERC-8004 registry on Aevum at build time; the native confirmation
  layer is implemented, with a v2 adapter planned.

## What is next

The Control Room, public name directory, and operations console are live. The v2
plan covers on-chain name uniqueness, account deletion, pause and suspension, the
contract v2 items, the indexer, the fee, and the mainnet path:
[docs/product/V2_PLAN.md](../product/V2_PLAN.md).
