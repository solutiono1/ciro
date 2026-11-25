<div align="center">

<img src="docs/screens/landing.png" width="880" alt="Ciro - a stablecoin invoice that will not pay the wrong name" />

# Ciro

**A stablecoin invoice that will not pay the wrong name.**

The amount is locked by the invoice. The payer's only decision is the name they were told.
The contract settles only when that name matches the name registered when the invoice was created.
A close name or an unknown name shows no pay button and moves no funds.

[ciro-a9s.pages.dev](https://ciro-a9s.pages.dev) · [GitHub](https://github.com/solutiono1/ciro)

Live on QDay Aevum testnet (chain 44005) · Ciro `0x4AceB37ecAce160B4363111460020c2d088C529C` · Fee 0 · [Source verified](https://explorer-test.qday.info/address/0x4AceB37ecAce160B4363111460020c2d088C529C?tab=contract)

</div>

---

## Demo

[Watch the 45 second app flow](https://ciro-a9s.pages.dev/media/ciro-demo-v3.mp4). The same clip plays on the landing.

The UI screenshots use a local test chain. The live Aevum deployment is linked above, and the transactions in the proof table are from it.

---

## The idea

A stablecoin transfer carries a sender, a receiver, and an amount. It does not carry the invoice, it does not check the name the payer was given, and it leaves no receipt an accountant can file. When the amount is short, the name is wrong, or the payment is late, a person repairs it by hand. The transfer is final.

Ciro makes the name the check. The payee registers a name and creates an invoice with a locked amount, a reference, a due time, and a network. The payer opens the link and types the name they were told. The contract compares the folded name to the snapshot on the invoice. Exact settles. Close and unknown do not.

The chain is the record. The API reads it and prepares unsigned transactions. Only the payer's wallet signs, or the CLI with a local key. Ciro never holds a key and never holds funds.

## How it works

1. **Register a name.** The payee publishes the name they want to be paid under. It is folded, so capitals and extra spaces still match.
2. **Create an invoice.** Amount, reference, and due time. The name, amount, due time, and network are locked on the invoice.
3. **Pay the name.** The payer opens the link, types the name, and signs. The contract settles only on an exact match.
4. **Keep the receipt.** Amount, payer, payee name, network, transaction hash, and time. The screenshot an accountant gets.

## Why a name

A wallet address is easy to copy wrong and hard to check. A registered name is something two people can agree on out loud. Ciro treats the name as the check, not as a label.

<div align="center">
<img src="docs/screens/pay.png" width="880" alt="Ciro pay screen - the amount is locked and the name is the only input" />
</div>

| Result | What the payer sees | Button |
|---|---|---|
| Exact | The name matches the invoice | Pay the exact amount |
| Close | Initials and word count match, length within two characters | No pay button |
| Unknown | Not the registered name | No pay button |

## Dashboard

The payee's dashboard is the invoices they can collect and the receipts that came back. There is no fake portfolio balance. The only balances live under Wallet, and they are the wallet's own tUSD8 and tQDAY.

<div align="center">
<img src="docs/screens/dashboard.png" width="880" alt="Ciro dashboard - open invoices and latest receipts" />
</div>

## Receipt

The receipt is the record. It carries the amount, the payer, the payee name, the reference, the network, and a link to the transaction on the explorer.

<div align="center">
<img src="docs/screens/receipt.png" width="880" alt="Ciro receipt - amount, payer, payee name, and transaction" />
</div>

## Build on it

The API, CLI, MCP, and SDK are built and published. Every write returns an unsigned transaction; the caller signs.

```bash
npm i @getciro/sdk
npm i -g @getciro/cli
npx @getciro/mcp
```

```js
import { createClient } from "@getciro/sdk";

const ciro = createClient({ apiUrl: "https://ciro-a9s.pages.dev/api" });
const invoice = await ciro.invoice(1);
const tx = await ciro.preparePay(1, "Elena Rossi"); // unsigned; you sign it
```

Published packages:

| Package | What it is |
|---|---|
| [`@getciro/sdk`](https://www.npmjs.com/package/@getciro/sdk) | Typed client of the API. No wallet. |
| [`@getciro/cli`](https://www.npmjs.com/package/@getciro/cli) | The `ciro` terminal tool. Signs locally with your key file. |
| [`@getciro/mcp`](https://www.npmjs.com/package/@getciro/mcp) | MCP server for agents. Prepares payments; never signs. |

The live API URL, the two contract addresses, and every package command are on the [developers page](https://ciro-a9s.pages.dev/#/developers). It reads without a wallet.

<div align="center">
<img src="docs/screens/docs.png" width="880" alt="Ciro docs - API, CLI, MCP, SDK, contract, and network" />
</div>

## Architecture

```mermaid
flowchart LR
  Payee[Payee wallet] -->|register, create| Ciro[(Ciro contract)]
  Payer[Payer wallet] -->|approve, pay exact name| Ciro
  Ciro -->|tUSD8 net of fee| Payee
  Ciro -->|Registered, InvoiceCreated, Paid| API[HTTP API]
  API --> Web[Web app]
  API --> CLI[CLI]
  API --> MCP[MCP server]
  API --> SDK[SDK]
  Web -->|unsigned transaction| Payer
  CLI -->|signed transaction| Ciro
  MCP -->|unsigned transaction| Caller[Agent or caller]
```

| Package | What it is |
|---|---|
| `contracts/` | `Ciro` (Solidity, Shanghai) holds payees, invoices, and allowances. `MockUSD8` is a local test token. |
| `packages/api` | HTTP API over `/v1`. Reads the chain and returns unsigned transactions. Holds no key. |
| `packages/cli` | The `ciro` binary. Signs locally with a key file and refuses a close name before it signs. |
| `packages/sdk` | `@getciro/sdk`, the typed client of the API. No wallet. |
| `packages/mcp` | An MCP server. Prepares payments; never signs. |
| `web/` | The web app. Vite and vanilla JS, built on the Maren Finance design system. |
| `packages/shared` | Name folding and money formatting, shared by the API and the tests. |

The chain is the source of truth. The API reads it and prepares calls; only a wallet or the CLI signs.

## API

| Method | Route | |
|---|---|---|
| GET | `/v1/meta` | chain, token, contract, fee |
| GET | `/v1/invoices/:id` | one invoice |
| POST | `/v1/invoices/:id/check` | compare a name to the invoice snapshot |
| GET | `/v1/receipts/:id` | one receipt |
| GET | `/v1/payees/:address` | registered name |
| GET | `/v1/payees/:address/invoices` | invoices by payee |
| GET | `/v1/payees/:address/allowances` | allowances by payee |
| GET | `/v1/payers/:address/receipts` | receipts by payer |
| POST | `/v1/check` | compare a name to the current registration |
| POST | `/v1/tx/register` | unsigned register |
| POST | `/v1/tx/invoice` | unsigned create |
| POST | `/v1/tx/pay` | unsigned pay |
| POST | `/v1/tx/pay-from-allowance` | unsigned allowance pay |
| POST | `/v1/tx/allow` | unsigned allowance |
| POST | `/v1/tx/revoke` | unsigned revoke |

Writes return `{ chainId, to, data, value, summary }` for the caller to sign. Errors are stable codes such as `name_mismatch`, `already_paid`, and `past_due`.

## CLI

Install with `npm i -g @getciro/cli` (or run `npx @getciro/cli`).

```bash
ciro register "Elena Rossi"
ciro invoice --amount 100 --reference "March design" --due 2026-12-01
ciro check --payee 0x... --name "Elena Rossi"
ciro pay 4 --name "Elena Rossi"
ciro receipt 4
```

Config lives at `~/.ciro/config.json` or the path in `CIRO_CONFIG`. The key file is mode `0600` and is never printed. The CLI signs and broadcasts itself; the API never sees the key.

## MCP

The MCP server exposes the same reads and prepares a payment. It does not sign.

```bash
CIRO_API_URL=http://127.0.0.1:8787 npx @getciro/mcp
```

From the repo, the same server is `node packages/mcp/bin/ciro-mcp.js`.

Tools: `ciro_check`, `ciro_prepare_invoice`, `ciro_prepare_pay`, `ciro_receipt`. A close or unknown name returns no transaction.

## Quickstart

```bash
npm install
cd contracts && forge test && cd ..
npm test
```

Run the web app and API locally:

```bash
npm run dev -w @getciro/web       # web app on Vite
npm start -w @getciro/api         # API; set CIRO_RPC_URL, CIRO_ADDRESS, CIRO_CHAIN_ID
```

## Configuration

| Where | Variable | Purpose |
|---|---|---|
| API | `CIRO_RPC_URL` | Aevum RPC endpoint. Required. |
| API | `CIRO_ADDRESS` | Ciro contract address. Required. |
| API | `CIRO_CHAIN_ID` | Expected chain ID. Defaults to `44005`. |
| API | `CIRO_START_BLOCK` | First block scanned for events. Defaults to `0`; set it to the deploy block on a long chain. |
| API | `CIRO_EXPLORER_URL` | Optional Blockscout URL. When set, receipts and allowances use the explorer's indexed logs instead of one RPC call per 1,000 blocks. |
| API | `PORT` | HTTP port. Defaults to `8787`. |
| API | `HOST` | Bind address. Defaults to `127.0.0.1`; the container sets `0.0.0.0`. |
| Web | `VITE_API_URL` | API base URL baked into the build. |
| Web | `VITE_RPC_URL` | Chain RPC used for balances and receipts. |
| Contracts | `CIRO_TOKEN` | tUSD8 address passed to the constructor. |
| Contracts | `CIRO_FEE_RECIPIENT` | Fee receiver passed to the constructor. |
| Contracts | `CIRO_FEE_BPS` | Fee in basis points, `0` to `100`. This deployment uses `0`. |
| CLI | `CIRO_CONFIG` | Config path. Defaults to `~/.ciro/config.json`. |

## Tests

- `cd contracts && forge test` - 11 passed.
- `npm test` - shared, API, CLI, MCP, and web unit tests.
- `npm run e2e -w @getciro/web` - the pay flow and the public pages. A close name has no pay button; an exact name pays.

## On-chain proof

Ciro is deployed on QDay Aevum testnet at `0x4AceB37ecAce160B4363111460020c2d088C529C`, settling in tUSD8 (`0x456569838f1d43009A91ebA4263147Afd7233483`) with a zero fee.

| What | Transaction |
|---|---|
| Deploy | [`0x48cb3cd4`](https://explorer-test.qday.info/tx/0x48cb3cd4640ac251430de2f71fbcf8559236ab8cd3947c37c7ac5a872d0a8b6e) |
| Register "Ada Okonkwo" | [`0xe4bde111`](https://explorer-test.qday.info/tx/0xe4bde11146715b4f95bb7f5b8b79e9ffdfdb963310e8d18e990757ce64a99d05) |
| Create invoice 1 | [`0xddef8ca9`](https://explorer-test.qday.info/tx/0xddef8ca9ee32f55a3196a5c41457625ff8657c9a5101a2bbe294f70ff3b304de) |
| Exact name pays | [`0xfb5abc43`](https://explorer-test.qday.info/tx/0xfb5abc4355a35693fb25c3d8fa2516f31213ef276eed02bb28fdcb4c124bfe96) |
| Wrong name is refused | [`0xe4c01ead`](https://explorer-test.qday.info/tx/0xe4c01ead88c8c56632332222fa920d4f7823d09d45737e8f499cdd904a6554db) (reverted) |

## Known limits

- tUSD8 has 6 decimals. The API and web format base units with that assumption.
- Name folding is ASCII-only. Characters outside `a-z`, `0-9`, and spaces are dropped before matching. The app and API reject non-ASCII registrations; a direct contract call can still make one, and the app will not pay it.
- A name is a confirmation check, not a global identity. Two payees can register the same name. Check the payee address on the invoice and the receipt.
- The allowance cap limits `payFromAllowance`. A spender can always pay with `pay` from its own wallet, so the cap is a budget control, not a hard wallet limit.
- There is no cancel. An invoice stays payable until its due time; use a short due date for a typo.
- Invoice memos and payee names are public on chain.
- Aevum tUSD8 has no public mint. The in-app faucet is local-only; on Aevum it links to the official QDay faucet.
- Invoice and receipt lists cap at 100 rows. There is no indexer; the API scans contract events from `CIRO_START_BLOCK`.
- The contract is immutable. A fee change or a logic change needs a new deployment.
- The API holds no key and no database. It can build a transaction, but it cannot sign or recover a payment.

## Roadmap

- Publish the audit report and add invariant and fuzz tests for name folding, allowance accounting, and fee rounding.
- Replace the event scan with an indexer so receipts load in one query and invoice lists paginate.
- Add a small configurable settlement fee on mainnet, with the zero-fee testnet deployment kept as the reference.
- Add session keys and per-invoice spend caps for agent payments, so an MCP client can prepare a payment under a bounded authority.
- Ship a hosted invoice dashboard for small teams, with the SDK and CLI as the integration path.

Revenue comes from the settlement fee on paid invoices. Reads, the SDK, and the CLI stay free. The first distribution is QDay builders and small agencies that invoice in stablecoins; the SDK and MCP are the path into agent workflows.

## Security

The first review is in [docs/security/REVIEW.md](docs/security/REVIEW.md). It records the scope, the four independent review lanes, the findings, the fixes, the residual risks, and the v2 items. The contract has no Critical or High finding. Two client trust findings were fixed: the pay page now reads the invoice and the name check from the chain, and every returned transaction is decoded against the pinned contract, token, chain, invoice, name, and amount before the wallet signs.

- Non-custodial. The API and MCP never hold a key; only the wallet or the CLI signs.
- The contract enforces the exact amount, the exact name, and the due time.
- Allowances are capped and revocable, and a spender can only pay that payee's invoices.
- The in-app faucet is a local-test convenience. On Aevum, tUSD8 comes from the QDay faucet; if the site says not eligible, use the QDay Discord `#faucet` channel.

## License

MIT. See [LICENSE](LICENSE).
