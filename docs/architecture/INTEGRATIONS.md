# Integrations

Four surfaces. Two of them ship in the contest build. Two wait.

## Order

The build order is fixed: the backend first, then the web app.

| Order | Surface | State |
|---|---|---|
| 1 | Contract | Done. `forge test` passed |
| 2 | HTTP API | Done. Live on Cloudflare Pages Functions |
| 3 | CLI | Done |
| 4 | MCP | Done in the backend pass, because the owner named it there |
| 5 | Web app | Done. Specified in UX.md. Land, onboard, invoice, pay, receipt, history, wallet, profile, settings, developers |
| 6 | SDK | After the routes stop changing |

The web app is the product a person finishes. It calls this API. It is not a second encoder.

## API

Base path `/v1`. JSON. Errors are `{ "error": "name_mismatch" }` with a stable code, not a paragraph.

Public:

- `GET /v1/invoices/:id`
- `GET /v1/receipts/:id` — 404 `not_paid` until the invoice is paid. The body then includes `transactionHash` from the `Paid` log when that log is found.
- `POST /v1/check` `{ "payee": "0x…", "name": "Elena Rossi" }` → `{ "result": "exact" | "close" | "none" }` against the payee's current registration.
- `POST /v1/invoices/:id/check` `{ "name": "Elena Rossi" }` against the snapshot locked on that invoice. `pay` uses the snapshot. This route exists so a client can refuse the right name.
- `GET /v1/payees/:address` → `{ "address", "registered", "name" }`. The name is public by design.
- `GET /v1/payees/:address/invoices` — at most 100 invoices, with `truncated` if there are more.

Prepare, unsigned:

- `POST /v1/tx/register` `{ "name" }`
- `POST /v1/tx/invoice` `{ "amount", "reference", "due" }`
- `POST /v1/tx/pay` `{ "id", "name", "payer"? }`
- `POST /v1/tx/pay-from-allowance` `{ "id", "name", "spender"? }`
- `POST /v1/tx/allow` `{ "spender", "cap", "expiry" }`
- `POST /v1/tx/revoke` `{ "spender" }`

`amount` and `cap` are base-unit strings. Six decimals. `"100000000"` is 100 tUSD8. `due` and `expiry` are unix seconds or `YYYY-MM-DD`, which means 23:59:59 UTC.

Response: `{ "chainId": 44005, "to": "0x…", "data": "0x…", "value": "0", "summary": "Pay invoice 4, 100.000000 tUSD8, fee 0" }`. The summary is what the CLI prints before it signs.

Testnet faucet:

- `POST /v1/faucet` `{ "address": "0x…" }` sends a fixed **0.2 tUSD8 + 0.01 tQDAY** from a dedicated testnet treasury, with a 24-hour per-address claim history and a 2-minute global throttle. It returns `{ status: "sent", tokenTx, gasTx, tokenAmount, gasAmount }` or `{ status: "already_funded" }`. The claim history is read from the explorer's token transfers, so the per-address limit survives isolate restarts.
- It is separate from the invoice API and uses a dedicated testnet-only key in a Cloudflare secret. It cannot sign invoices or touch user funds.
- On a local test chain the app uses `POST /v1/tx/faucet` (the fixture mint) instead.
- Treasury: `0x09257929772176E9c832fC8056A0d9913Ef77a13`. Send test tUSD8 or tQDAY there to refill.

When the snapshot is not an exact match, pay returns 409 `{ "error": "name_mismatch", "result": "close" }` or `"none"`, and the body has no `data`. Already paid, past due, and a missing, revoked, expired, or too-small allowance are separate codes (`already_paid`, `past_due`, `no_allowance`, `allowance_revoked`, `allowance_expired`, `cap_exceeded`). Those bodies have no `data` either. The allowance codes are returned only when `spender` was sent, because the API does not know who will sign until then. The contract still enforces them.

When `payer` or `spender` is sent, the success body may include `approvals`: zero or more unsigned `approve` transactions for the exact invoice amount. A non-zero but insufficient allowance is reset to zero first. The CLI sends those, waits, then sends the pay.

Stable error codes include `bad_request`, `bad_address`, `bad_amount`, `bad_due`, `empty_name`, `unknown_invoice`, `not_paid`, `name_mismatch`, `already_paid`, `past_due`, `no_allowance`, `allowance_expired`, `allowance_revoked`, `cap_exceeded`, `chain_mismatch`, `chain_unavailable`, `not_found`.

No private keys. No "we broadcast for you" in v1.

Price, later: creating an invoice through the API can be free under a monthly count and metered after that. A settlement fee is set at deploy and capped at 1% by the contract; 0.5% is a planned setting, not a live one. Document the meter when it exists. Do not invent a billing system in the contest.

## CLI

Binary name `ciro`.

```
ciro register "Elena Rossi"
ciro invoice --amount 100 --reference "March design" --due 2026-12-01
ciro check --payee 0x… --name "Elena Rossi"
ciro pay 4 --name "Elena Rossi"
ciro receipt 4
ciro allow 0x… --cap 500 --expiry 2026-12-31
ciro revoke 0x…
```

`pay` asks the API, which checks the invoice snapshot, and refuses to sign on close or none. The contract checks again.

`--amount` and `--cap` are human tUSD8, not base units. `--due` and `--expiry` are `YYYY-MM-DD`. `--from-allowance` on `pay` calls `payFromAllowance`. `--yes` signs without a prompt. Without `--yes`, a terminal asks once. A non-terminal must pass `--yes`.

Config file: `CIRO_CONFIG`, or `~/.ciro/config.json`. Fields: `apiUrl`, `rpcUrl`, `chainId`, `keyPath`. There is no default API URL until a deployment exists. The key file is mode 0600. The CLI broadcasts through `rpcUrl`. The API does not.

## MCP

The server is `packages/mcp/bin/ciro-mcp.js`. Newline-delimited JSON-RPC on stdin. `CIRO_API_URL` is required. Tools:

- `ciro_check` — `name` plus `payee`, or `name` plus `invoiceId` for the snapshot.
- `ciro_prepare_invoice` — `amount` is a base-unit string, plus `reference` and `due`.
- `ciro_prepare_pay` — `id` and `name`. Optional `fromAllowance`, `payer`, and `spender`.
- `ciro_receipt`

`ciro_prepare_pay` returns the unsigned transaction only when the match is exact. Otherwise the tool result is the API error and there is no `data`. It does not sign. A `privateKey` argument is ignored and not copied into the result. An agent pays only if the owner has set an allowance, and the signing key for that allowance is the owner's choice, not a key inside the MCP server. The server that held a paying key would be custody.

This matches the safety line we want judges to see: the agent can prepare, and the chain enforces the cap.

## SDK

A small typed client of `/v1` in TypeScript first. Other languages wait until someone asks. Methods are the routes above. No wallet inside the SDK. The caller signs.

## Who would call this

- A wallet that wants "pay this bill" without inventing reconciliation.
- A payroll tool that wants a name check before a batch. The batch itself is not v1.
- An agent runtime, through MCP, that must not hold the treasury.
- QDay, as the invoice their testnet does not have.

We do not promise those callers in the contest. We build the surface they would call.
