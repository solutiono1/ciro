# Ciro

**A stablecoin invoice that will not pay the wrong name.**

Ciro locks the amount, the reference, the due time, and the network on an invoice, then asks the payer one question: type the name you were told. The contract settles only on an exact match. A close name or an unknown name shows no pay button and moves no funds. No custody, no account, and no key held by the app.

- Live on **QDay Aevum testnet** (chain `44005`)
- Settlement asset: **tUSD8**
- Fee: **0** on this deployment

## Live deployment

| | |
|---|---|
| Ciro | [`0x4AceB37ecAce160B4363111460020c2d088C529C`](https://explorer-test.qday.info/address/0x4AceB37ecAce160B4363111460020c2d088C529C) |
| Deploy tx | [`0x48cb3cd4…8b6e`](https://explorer-test.qday.info/tx/0x48cb3cd4640ac251430de2f71fbcf8559236ab8cd3947c37c7ac5a872d0a8b6e) |
| tUSD8 | [`0x456569838f1d43009A91ebA4263147Afd7233483`](https://explorer-test.qday.info/address/0x456569838f1d43009A91ebA4263147Afd7233483) |
| Network | QDay Aevum testnet, chain `44005` |
| RPC | `https://rpc-test.qday.info` |
| Explorer | `https://explorer-test.qday.info` |

## On-chain proof

| What | Transaction |
|---|---|
| Deploy Ciro | [`0x48cb3cd4…8b6e`](https://explorer-test.qday.info/tx/0x48cb3cd4640ac251430de2f71fbcf8559236ab8cd3947c37c7ac5a872d0a8b6e) |
| Register "Ada Okonkwo" | [`0xe4bde111…9d05`](https://explorer-test.qday.info/tx/0xe4bde11146715b4f95bb7f5b8b79e9ffdfdb963310e8d18e990757ce64a99d05) |
| Create invoice 1 (1 tUSD8) | [`0xddef8ca9…04de`](https://explorer-test.qday.info/tx/0xddef8ca9ee32f55a3196a5c41457625ff8657c9a5101a2bbe294f70ff3b304de) |
| Approve Ciro | [`0x197ca12d…b5d7`](https://explorer-test.qday.info/tx/0x197ca12d454e26f166d4a6bbcf1c6cb90449bd6a993f69e248aa83708914b5d7) |
| Exact name pays | [`0xfb5abc43…fe96`](https://explorer-test.qday.info/tx/0xfb5abc4355a35693fb25c3d8fa2516f31213ef276eed02bb28fdcb4c124bfe96) |
| Wrong name is refused | [`0xe4c01ead…54db`](https://explorer-test.qday.info/tx/0xe4c01ead88c8c56632332222fa920d4f7823d09d45737e8f499cdd904a6554db) (reverted) |

## How it works

1. The payee registers a name. It is folded (case and spacing do not matter).
2. The payee creates an invoice: amount, reference, and due time. The name, amount, due time, and network are locked on the invoice.
3. The payer opens the link, types the name they were told, and signs.
4. The contract compares the folded name to the snapshot on the invoice and settles only on an exact match.
5. A receipt records the amount, payer, payee name, network, transaction hash, and time.

## Why a name

A wallet address is easy to copy wrong and hard to check. A registered name is something two people can agree on out loud. Ciro treats the name as the check, not as a label:

| Result | What the payer sees | Button |
|---|---|---|
| Exact | The name matches the invoice | Pay the exact amount |
| Close | One letter or space off | No pay button |
| Unknown | Not the registered name | No pay button |

## Architecture

- `contracts/` — Solidity. `Ciro` holds payees, invoices, and allowances. `MockUSD8` is a local test token. EVM Shanghai, solc 0.8.28.
- `packages/api` — HTTP API over `/v1`. Reads the chain and returns unsigned transactions. Holds no key.
- `packages/cli` — the `ciro` CLI. Signs locally with a key file and refuses a close name before it signs.
- `packages/mcp` — an MCP server. Prepares payments; never signs.
- `web/` — the web app. Vite and vanilla JS, built on the Maren Finance design system.
- `shared/` — name folding and money formatting.

The chain is the source of truth. The API reads it and prepares calls; only a wallet or the CLI signs.

## Quickstart

```bash
npm install
cd contracts && forge test && cd ..
npm test
```

Run the web app and API locally:

```bash
npm run dev -w @ciro/web       # web app on Vite
npm start -w @ciro/api         # API; set CIRO_RPC_URL, CIRO_ADDRESS, CIRO_CHAIN_ID
```

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
| POST | `/v1/tx/faucet` | unsigned testnet mint (local chains) |

Writes return `{ chainId, to, data, value, summary }` for the caller to sign. Errors are stable codes such as `name_mismatch`, `already_paid`, and `past_due`.

## CLI

```bash
ciro register "Ada Okonkwo"
ciro invoice --amount 100 --reference "March design" --due 2026-12-01
ciro pay 4 --name "Ada Okonkwo"
ciro receipt 4
```

Config lives at `~/.ciro/config.json` or the path in `CIRO_CONFIG`. The key file is mode `0600` and is never printed.

## Tests

- `cd contracts && forge test` — 11 passed.
- `npm test` — shared, API, CLI, MCP, and web unit tests.
- `npm run e2e -w @ciro/web` — the pay flow and the public pages.

## Security

- Non-custodial. The API and MCP never hold a key; only the wallet or the CLI signs.
- The contract enforces the exact amount, the exact name, and the due time.
- Allowances are capped and revocable, and a spender can only pay that payee's invoices.
- The in-app faucet is a local-test convenience. On Aevum, tUSD8 comes from the official QDay faucet.

## Status

The contract, API, CLI, MCP, and web app are built and tested. A TypeScript SDK is next. The product is live on Aevum testnet.

## License

MIT. See [LICENSE](LICENSE).
